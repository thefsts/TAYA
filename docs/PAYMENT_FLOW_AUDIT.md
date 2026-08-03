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
[1] Signature verification (convex/http.ts)
  • Retrieve webhookSignatureKey from squareConfig
  • HMAC-SHA-256(url + rawBody) must match Square-Signature header
  • Missing key → 401 "Webhook signature key not configured"
  • Missing header → 401 "Missing Square-Signature header"
  • HMAC mismatch → 401 "Invalid signature"
         │
         ▼
[2] Atomic idempotency guard (inside upsertOrderFromWebhook mutation)
  • Extract event.event_id from payload
  • Query squareOrders by_squareEventId index [siteId, squareEventId]
  • If found with webhookProcessedAt set → return { duplicate: true }
  • HTTP handler returns 200 { received: true, duplicate: true } immediately
  • Convex mutations are serialised — no race window exists between the
    read and the write; concurrent deliveries of the same event_id are safe
         │
         ▼
[3] Atomic order write (single Convex mutation)
  squareOrders.upsertOrderFromWebhook writes:
    squareOrderId, squarePaymentId, squareEventId (first-write only),
    webhookReceivedAt, webhookProcessedAt=now, ...paymentFields
  
  Email delivery state is initialised ONLY when the order transitions
  INTO status="COMPLETED" (covers both new COMPLETED orders and the
  non-completed → completed status transition path):
    customerEmailStatus="pending", businessEmailStatus="pending",
    emailAttemptCount=0
  
  squareEventId is NEVER overwritten on existing orders (preserves the
  event ID of the first webhook that wrote the record).
         │
         ▼
[4] Status-transition side effects (fired exactly once per COMPLETED transition)
  Triggered when wasCompleted=false AND isNowCompleted=true:
    • ctx.scheduler.runAfter(0, crm.syncToCrm, { payment_notification })
    • ctx.scheduler.runAfter(0, squareOrders.sendPaymentEmails, { orderId })
  Repeated COMPLETED updates on an already-COMPLETED order do NOT
  re-trigger side effects, preserving in-flight email delivery state.
         │
         ▼
[5] sendPaymentEmails action runs
  Per-recipient state check: only delivers to recipients in
  RETRYABLE_STATUSES = {"pending", "failed", "retryScheduled"}.
  Already-"sent" recipients are skipped (prevents duplicate sends on retry).
  
  Top-level try/catch ensures unexpected throws (network errors, etc.)
  always transition "processing" recipients to "retryScheduled" or
  "permanentlyFailed" — never leaving an order stuck in "processing".
  
  ├─ email.sendPaymentConfirmation → customer confirmation
  │    • Missing fromEmail → { success: false, error: "No fromEmail..." }
  │    • Missing RESEND_API_KEY → { success: false, error: "..." }
  │    • fetch wrapped in try/catch → returns { success: false } on throw
  └─ email.sendBusinessNotification → site owner / notification address
       • Missing notificationEmail AND fromEmail →
         { success: false, error: "No business notification email..." }
       • Same error-safe guarantees as above
         │
         ▼
[6] Delivery outcome written back to squareOrders (per-recipient)
  • SUCCESS → customerEmailStatus="sent" / businessEmailStatus="sent"
  • FAILURE (attempt < 5) → status="retryScheduled", nextRetryAt=now+backoff
  • FAILURE (attempt >= 5) → status="permanentlyFailed"
  Order record always persists regardless of email outcome.
```

---

## 2. Failure Points and Mitigations

| Failure point | Behaviour | Mitigation |
|---|---|---|
| Duplicate webhook (same event_id) | Detected atomically INSIDE mutation by `by_squareEventId` index | Returns 200 immediately; no duplicate order, email, or CRM sync |
| Missing `webhookSignatureKey` | 401 before any write | Dashboard config required; no order written |
| Invalid signature | 401 | Same |
| Missing Square-Signature header | 401 | Same |
| Non-final → COMPLETED transition | Side effects fire on status change, not just on insert | Covers payment.created → payment.updated COMPLETED flows |
| Convex mutation throws | Convex auto-retries; write is atomic | No partial order state |
| `RESEND_API_KEY` absent | `email.send` returns `{ success: false }` | Status → `retryScheduled`; retry scheduled; never throws |
| Missing `fromEmail` config | `sendPaymentConfirmation` returns `{ success: false }` | Status → `retryScheduled`; visible in dashboard; never silently succeeds |
| Missing `notificationEmail` | `sendBusinessNotification` returns `{ success: false }` | Same as above — observable failure, not silent skip |
| Email action throws (network) | Caught by `email.send` try/catch + `sendPaymentEmails` top-level catch | `processing` → `retryScheduled`; cron and resend button can recover |
| `processing` deadlock | Top-level catch in `sendPaymentEmails` transitions to `retryScheduled` | No order can be permanently stuck in processing |
| Transient Resend API error | Same as missing key path | Exponential backoff retry up to 5 attempts |
| CRM sync failure | Separate scheduled action; failure does not affect order or email | CRM logs capture independently |

---

## 3. Idempotency Controls

- **squareEventId field:** Every order stores the Square `event_id` from the webhook payload. Never overwritten.
- **`by_squareEventId` index:** Composite index on `[siteId, squareEventId]` enables O(1) dedup lookup.
- **Atomic dedup inside mutation:** The event_id check runs as the FIRST statement inside the Convex mutation. Convex mutations are serialised — no two mutations run concurrently, so there is no race window between the read and the write.
- **`webhookProcessedAt` sentinel:** Set in the same mutation that writes the order. If present, webhook is a duplicate and short-circuits with `{ duplicate: true }`.
- **Completion side effects gated by `wasCompleted`:** CRM sync and email scheduling fire only once — when the order transitions from non-COMPLETED → COMPLETED. Subsequent COMPLETED updates are no-ops.
- **Per-recipient email status check:** `sendPaymentEmails` re-reads current email status before each attempt. Already-`sent` recipients are skipped; only RETRYABLE_STATUSES (`pending`, `failed`, `retryScheduled`) trigger delivery.
- **No external KV dependency:** All deduplication is within Convex's own atomic mutation system.

---

## 4. Email Delivery State Machine

```
               ┌─────────┐
   COMPLETED ──▶│ pending │  (initialised at COMPLETED transition)
               └────┬────┘
                    │ sendPaymentEmails starts
                    ▼
             ┌─────────────┐
             │ processing  │  (written before delivery attempt)
             └──────┬──────┘
           ┌────────┴────────────────┐
           │ success                 │ failure (or unexpected throw)
           ▼                         ▼
         ┌─────┐             ┌─────────────────┐
         │sent │             │ retryScheduled  │ ← nextRetryAt set;
         └─────┘             │ (attempt < 5)   │   cron picks up when due
                             └────────┬────────┘
                                      │ attempt >= 5 (MAX_EMAIL_ATTEMPTS)
                                      ▼
                           ┌──────────────────┐
                           │ permanentlyFailed│ ← admin resend required
                           └──────────────────┘
```

States per recipient field (`customerEmailStatus`, `businessEmailStatus`):
- **`pending`** — queued but not yet attempted (initialised at COMPLETED write)
- **`processing`** — in-flight (action running; NEVER a persistent stuck state)
- **`sent`** — Resend API accepted; not retried on future cron sweeps
- **`retryScheduled`** — last attempt failed; `nextRetryAt` is set; cron will retry
- **`permanentlyFailed`** — 5 attempts exhausted; `nextRetryAt` absent; manual resend required

Both statuses cycle **independently** — if customer email sends but business email fails, the next retry only attempts the business email (skipping the already-sent customer email).

---

## 5. Retry Policy

| Attempt # | Delay before retry | Status written |
|---|---|---|
| 1 (failure) | +5 minutes | `retryScheduled` |
| 2 (failure) | +15 minutes | `retryScheduled` |
| 3 (failure) | +30 minutes | `retryScheduled` |
| 4 (failure) | +1 hour | `retryScheduled` |
| 5 (failure) | — | `permanentlyFailed` |

The retry cron (`payment-email-retry`) runs every 10 minutes. It calls `squareOrders.retryFailedPaymentEmails`, which collects orders where `customerEmailStatus` or `businessEmailStatus` is in `{retryScheduled, failed}` (including legacy `failed` writes for backward compatibility) with `nextRetryAt <= now` and `emailAttemptCount < 5`, then schedules `sendPaymentEmails` for each.

---

## 6. Manual Recovery Procedure

When an order shows `retryScheduled`, `failed`, or `permanentlyFailed` email status:

1. Navigate to **Square Commerce → Payment History** tab.
2. Locate the affected order — email status badges appear per-order.
3. Click **Resend** button (visible for `failed`, `retryScheduled`, `permanentlyFailed`).
4. This calls `squareOrders.resendConfirmationEmail`, which:
   - Requires `INTEGRATIONS_MANAGE` permission (FSTS superadmin)
   - Resets both `customerEmailStatus` and `businessEmailStatus` to `pending`
   - Clears `lastEmailError` and `nextRetryAt`
   - Schedules `sendPaymentEmails` immediately via `ctx.scheduler.runAfter(0)`
5. The order table refreshes via Convex's reactive query system within seconds.

---

## 7. Required Production Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Convex env vars | Platform-level Resend key (fallback if no per-site key) |
| `webhookSignatureKey` | `squareConfig` table (per site) | Square webhook HMAC-SHA-256 verification |
| `PAYMENT_ENCRYPTION_KEY` | Convex env vars | AES-256-GCM key for `paymentConnectors` credentials |
| `DASHBOARD_URL` | Convex env vars | Used in platform emails |
| `PLATFORM_FROM_EMAIL` | Convex env vars | Sender address for platform emails |

Per-site email settings (stored in `emailSettings` table):
- `fromName`, `fromEmail`, `replyToEmail` — sender identity
- `notificationEmail` — business notification recipient (falls back to `fromEmail`)
- `resendApiKey` — per-site Resend key override (takes precedence over platform key)

---

## 8. Test Coverage

Tests are split across two files:

### `tests/convex-unit/src/payment-pipeline.test.ts` (27 tests)

| # | Scenario | What is verified |
|---|---|---|
| 1 | Valid webhook creates order exactly once | `upsertOrderFromWebhook` inserts with correct fields; `duplicate=false` |
| 2 | Duplicate event ID rejected | Same `squareEventId` → `duplicate=true`; single DB row |
| 2b | Duplicate `squareOrderId` (no eventId) | Patches existing row; no new insert |
| 3 | Duplicate webhook preserves email state | Email state not reset when `duplicate=true` returned |
| 4 | Missing `webhookSignatureKey` detectable | Stored config returns falsy key |
| 5 | Invalid signature detectable | Config has key; comparison path active |
| 6a | Missing `RESEND_API_KEY` → `retryScheduled` | Status written; `nextRetryAt` set; order intact |
| 6b | Missing `fromEmail` → `retryScheduled` | Returns failure not silent success |
| 7a | Retry cron finds due `retryScheduled` orders | `nextRetryAt` past due appears in filter |
| 7b | Already-`sent` recipient not in retryable set | `sent` excluded from RETRYABLE_STATUSES |
| 8 | Admin resend resets both statuses to `pending` | `resendConfirmationEmail` mutation |
| 9 | Admin resend covers both recipients | Both `customerEmailStatus` and `businessEmailStatus` reset |
| 10 | Order persists when email fails | DB record intact; payment fields correct |
| 11 | Capacity increments once per payment | Duplicate `squareOrderId` → one order row |
| 12a | Dedup uses persisted `squareEventId` (atomic) | `duplicate=true` on second call |
| 12b | `squareEventId` never overwritten on existing order | Original event ID preserved across updates |
| 12c | `webhookProcessedAt` written by mutation | Enables future dedup checks |
| 13a | siteId isolation — read | Cross-site `orderId` lookup returns null |
| 13b | siteId isolation — write | Cross-site `updateOrderEmailStatus` throws |
| 14 | Atomic write of all fields | Single mutation sets `squareEventId`, `webhookProcessedAt`, email state |
| R1 | `non-COMPLETED → COMPLETED` fires email/CRM | Email state initialised only at COMPLETED transition |
| R2 | Repeated COMPLETED update idempotent | Second COMPLETED update does not reset `sent` email state |
| R3 | `squareEventId` preserved across transitions | First event ID kept through status change |
| R4 | `processing` is NOT retried by cron | Stuck-in-processing order is invisible to retry query |
| R5 | `retryScheduled` (catch block output) IS retried | Order becomes recoverable after catch transition |
| R6 | At max attempts → `permanentlyFailed` | No `nextRetryAt`; RETRYABLE_STATUSES excludes it |

### `tests/convex-unit/src/webhook-signature.test.ts` (7 tests)

| # | Scenario | What is verified |
|---|---|---|
| 4 | Missing `webhookSignatureKey` | Real HTTP handler → 401 "not configured" |
| 5a | Missing `Square-Signature` header | Real HTTP handler → 401 "Missing Square-Signature" |
| 5b | Invalid / tampered signature | Real HTTP handler → 401 "Invalid signature" |
| 1 | Valid HMAC-SHA256 signature | Real HTTP handler → 200 `{ received: true }` |
| 2 | Duplicate event (mutation returns duplicate) | Real HTTP handler → 200 `{ duplicate: true }` |
| — | Site not found | Real HTTP handler → 404 |
| — | Handler registration | Route captured from `convex/http.ts` |

---

## 9. Remaining Risks

1. **`permanentlyFailed` alerting absent:** No automated dashboard alert when an order reaches `permanentlyFailed`. Follow-up task #202 tracks adding a nav badge/alert for this state.

2. **End-to-end webhook integration test:** The unit tests cover mutation and handler logic separately. A live HTTP POST to the deployed webhook endpoint (with valid HMAC) is not yet part of CI. Follow-up task #203 tracks this.

3. **`/api/payment/webhook` not hardened:** The provider-agnostic endpoint at `convex/http.ts:473` does not yet apply the same idempotency, email state machine, or dedup guards. Follow-up task #204 tracks this.

4. **Resend rate limits under high volume:** Exponential backoff handles transient throttling, but sustained high volume could exhaust retries. Monitoring `permanentlyFailed` orders is recommended.

5. **Square `event_id` absence:** Very old Square API versions may omit `event_id`. Idempotency falls back to `squareOrderId`-based dedup (pre-hardening behavior). A missing `event_id` is logged as a warning.

6. **Clock skew on `nextRetryAt`:** Retry delays are approximate (±10 minutes) due to the 10-minute cron interval.

7. **Refund flow:** Refund webhook handling is not hardened with idempotency/email state guards. Tracked as a separate future task.
