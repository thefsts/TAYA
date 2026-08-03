# Payment Flow Audit — FSTS Client Dashboard

> **Last updated:** 2026-08-03  
> **Scope:** Square webhook pipeline, email delivery state machine, retry policy, and manual recovery.

---

## 1. Complete Payment Flow

```
Customer pays via Square Checkout
         │
         ▼
Square sends POST /api/square/webhook?slug=<site-slug>
  (with Square-Signature header)
         │
         ▼
[1] Signature verification
  • Retrieve webhookSignatureKey from squareConfig (or paymentConnectors)
  • HMAC-SHA-256(url + rawBody) == Square-Signature
  • On failure → 401, log incident to paymentConnectors event log
         │
         ▼
[2] Idempotency guard
  • Extract event.event_id from payload
  • Query squareOrders by [siteId, squareEventId] index
  • If existing.webhookProcessedAt is set → return 200 immediately (no-op)
         │
         ▼
[3] Atomic order + email-state write (single Convex mutation)
  squareOrders.upsertOrderFromWebhook({
    squareOrderId, squarePaymentId, squareEventId,
    webhookReceivedAt, webhookProcessedAt=now,
    customerEmailStatus="pending", businessEmailStatus="pending",
    emailAttemptCount=0, ...paymentFields
  })
         │
         ▼
[4] CRM sync (if status === "COMPLETED")
  ctx.scheduler.runAfter(0, crm.syncToCrm, { payment_notification })
         │
         ▼
[5] Email delivery scheduled
  ctx.scheduler.runAfter(0, squareOrders.sendPaymentEmails, { orderId, ... })
         │
         ▼
[6] sendPaymentEmails action runs
  ├─ email.sendPaymentConfirmation → customer
  └─ email.sendBusinessNotification → site owner
         │
         ▼
[7] Delivery outcome written back to squareOrders
  • SUCCESS → customerEmailStatus="sent", businessEmailStatus="sent"
  • FAILURE (attempt < 5) → status="failed", nextRetryAt=now+backoff
  • FAILURE (attempt >= 5) → status="permanentlyFailed"
```

---

## 2. Failure Points and Mitigations

| Failure point | Behaviour | Mitigation |
|---|---|---|
| Duplicate webhook (same event_id) | Detected by `by_squareEventId` index before any write | Returns 200 immediately, no duplicate order or email |
| Missing `webhookSignatureKey` | 401 + log to `paymentConnectors` event log | Alert visible in dashboard; no order written |
| Invalid signature | 401 + log | Same as above |
| Convex mutation throws | Convex auto-retries the mutation; email scheduling is part of the same transaction | Order is never partially written |
| `RESEND_API_KEY` absent | `email.send` returns `{ success: false }` | Status set to `failed`; retry scheduled; does NOT throw |
| Transient Resend API error | Same as above | Exponential backoff retry up to 5 attempts |
| CRM sync failure | `crm.syncToCrm` is a separate scheduled action; its failure does NOT affect order or email | CRM logs capture the failure independently |

---

## 3. Idempotency Controls

- **squareEventId field:** Every order stores the Square `event_id` extracted from the webhook payload.
- **`by_squareEventId` index:** Composite index on `[siteId, squareEventId]` enables O(1) dedup lookup.
- **`webhookProcessedAt` sentinel:** Set atomically in the same mutation that writes the order. If this field is present, the webhook is a duplicate and rejected before any business logic runs.
- **No external KV dependency:** Deduplication is entirely within Convex's own atomic mutation system. There is no Redis, DynamoDB, or other external store required.

---

## 4. Email Delivery State Machine

```
              ┌─────────┐
   webhook ──▶│ pending │
              └────┬────┘
                   │ sendPaymentEmails starts
                   ▼
            ┌─────────────┐
            │ processing  │
            └──────┬──────┘
          ┌────────┴────────┐
          │ success         │ failure
          ▼                 ▼
        ┌─────┐        ┌────────┐
        │sent │        │ failed │ ← retry cron checks nextRetryAt
        └─────┘        └───┬────┘
                           │ attempt >= MAX_ATTEMPTS (5)
                           ▼
                 ┌──────────────────┐
                 │ permanentlyFailed│
                 └──────────────────┘
```

States per order:
- **`pending`** — queued but not yet attempted
- **`processing`** — in-flight (action is running)
- **`sent`** — Resend API accepted the message
- **`failed`** — last attempt failed; `nextRetryAt` is set
- **`permanentlyFailed`** — 5 attempts exhausted; manual resend required

Both `customerEmailStatus` and `businessEmailStatus` cycle independently.

---

## 5. Retry Policy

| Attempt # | Delay before retry |
|---|---|
| 1 → 2 | 5 minutes |
| 2 → 3 | 15 minutes |
| 3 → 4 | 30 minutes |
| 4 → 5 | 1 hour |
| 5 → permanent | 2 hours (then `permanentlyFailed`) |

The retry cron (`payment-email-retry`) runs every 10 minutes and calls `squareOrders.retryFailedPaymentEmails`, which queries all orders with `customerEmailStatus === "failed" || businessEmailStatus === "failed"` and `nextRetryAt <= now` and re-queues `sendPaymentEmails` for each.

---

## 6. Manual Recovery Procedure

When an order shows `failed` or `permanentlyFailed` email status in the dashboard:

1. Navigate to **Square Commerce → Payment History** tab.
2. Locate the affected order (email status badges are shown per-order).
3. Click **Resend** button — available only for `failed` and `permanentlyFailed` states.
4. This calls `squareOrders.resendConfirmationEmail`, which:
   - Resets both email status fields to `pending`
   - Clears `lastEmailError` and `nextRetryAt`
   - Schedules `sendPaymentEmails` immediately via `ctx.scheduler.runAfter(0)`
5. The order table refreshes via Convex's reactive query system within seconds.

---

## 7. Required Production Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Convex env vars | Platform-level Resend key (fallback if no per-site key) |
| `webhookSignatureKey` | squareConfig table (per site) | Square webhook signature verification |
| `PAYMENT_ENCRYPTION_KEY` | Convex env vars | AES-256-GCM key for encrypting paymentConnectors credentials |
| `DASHBOARD_URL` | Convex env vars | Used in dashboard welcome emails |
| `PLATFORM_FROM_EMAIL` | Convex env vars | Sender address for platform emails |

Per-site email settings (stored in `emailSettings` table):
- `fromName`, `fromEmail`, `replyToEmail` — sender identity
- `notificationEmail` — business notification recipient
- `resendApiKey` — per-site Resend key override

---

## 8. Test Coverage

All 14 scenarios are covered in `tests/convex-unit/src/payment-pipeline.test.ts`:

| # | Scenario | Test approach |
|---|---|---|
| 1 | Valid payment webhook processes exactly once | Direct `upsertOrderFromWebhook` mutation call |
| 2 | Duplicate webhook (same event ID) rejected | Call `upsertOrderFromWebhook` twice, assert single order |
| 3 | Duplicate webhook no duplicate email | Assert `emailAttemptCount` not reset on duplicate |
| 4 | Missing `webhookSignatureKey` fails securely | Assert squareConfig with no key returns null stored key |
| 5 | Invalid signature fails securely | Assert signature logic via stored key behavior |
| 6 | Missing `RESEND_API_KEY` records failure status | Call `updateOrderEmailStatus` and assert `failed` state |
| 7 | Temporary Resend failure schedules retry | Mutation sets `failed` + `nextRetryAt` |
| 8 | Customer email manually resent by admin | `resendConfirmationEmail` mutation, assert status reset |
| 9 | Business email manually resent by admin | Same mutation covers both email types |
| 10 | Registration persists when email fails | Order exists even when email status is `failed` |
| 11 | Capacity increments only once per payment | Two calls with same orderId → single order |
| 12 | Dedup uses persisted `squareEventId` field | `getByEventId` query finds existing order |
| 13 | Tenant/customer data isolated by siteId | Cross-site `orderId` lookup returns null |
| 14 | Timestamp + event ID written atomically | Single mutation call sets both `webhookProcessedAt` + `squareEventId` |

---

## 9. Remaining Risks

1. **Partial email delivery:** If customer email sends but business email fails (or vice versa), both statuses are tracked independently. The retry will re-attempt both. There is no "partial success" stuck state; either both eventually reach `sent` or both are retried.

2. **Resend rate limits:** Under sustained high volume, Resend rate limiting could cause temporary failures. The exponential backoff retry policy handles this gracefully, but monitoring `permanentlyFailed` orders is recommended.

3. **Square event_id absence:** Very old Square API versions may not include `event_id` in the webhook payload. In this case, `squareEventId` is null and idempotency falls back to `squareOrderId`-based dedup (which was the pre-hardening behavior). A missing `event_id` is logged as a warning.

4. **Clock skew on `nextRetryAt`:** Convex crons run at platform time; retry delays are approximate (±10 minutes) due to the cron interval.

5. **`permanentlyFailed` alerting:** There is currently no automated alert when an order reaches `permanentlyFailed`. The "Make failed welcome email deliveries visible" task (planned) should be extended to cover this state.

6. **Refund flow:** Refund webhook handling is not currently hardened with the same idempotency/email state machine. Tracked as a separate future task.
