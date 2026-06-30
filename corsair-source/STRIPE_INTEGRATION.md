# Stripe Integration Plan — Corsair Tactical Solutions

> **Status:** Planning document. No fake payment logic is shipped. Real integration will be implemented in a future PR once Stripe account + product configuration is complete.

---

## Phase 1 — Minimum Viable Payments (No Database Required)

### Goal
Accept payment for course enrollments with the simplest, safest, most maintainable setup.

### Approach: Stripe Checkout (hosted) + Payment Links

We recommend **Stripe-hosted Checkout** over a custom-built card form. Reasons:

- PCI DSS compliance is handled entirely by Stripe
- No card data ever touches Corsair servers
- Stripe stores customer + payment records — acts as our Phase 1 "database"
- Supports Apple Pay / Google Pay / cards / Afterpay out of the box
- Automatic receipts, refund handling, tax support
- Minimal code surface = minimal security risk

### Why no database yet?
For the first release, we only need to:
1. Let a user pick a course
2. Collect payment
3. Send a confirmation email
4. Manually reach out to schedule

All of that is satisfied by:
- **Stripe** → stores customer, payment, receipts, refunds
- **Email (FormSubmit / Resend / SendGrid)** → confirmation + lead notifications
- **Google Calendar / manual booking** → scheduling happens outside the site

A database is only required once we need automated schedule lookups, seat capacity, or student history.

---

### Implementation: Server-Side Checkout Session

**File to create:** `src/app/api/checkout/route.ts`

```ts
// Pseudo-code outline — DO NOT SHIP WITHOUT REAL STRIPE KEYS
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});

export async function POST(req: Request) {
  const { courseSlug, courseName, priceCents, selectedDate, customerEmail, customerName, customerPhone } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: {
            name: courseName,
            description: `Corsair Tactical Solutions — ${courseName}`,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: customerEmail,
    client_reference_id: `${courseSlug}_${Date.now()}`,
    metadata: {
      course_slug: courseSlug,
      course_name: courseName,
      selected_date: selectedDate ?? 'not_selected',
      customer_name: customerName,
      customer_phone: customerPhone,
      source: 'corsair_website',
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/courses/${courseSlug}`,
    automatic_tax: { enabled: false }, // enable once Stripe Tax is configured
  });

  return NextResponse.json({ url: session.url });
}
```

**Key fields:**

| Field | Purpose |
|-------|---------|
| `client_reference_id` | Our internal ID — course slug + timestamp |
| `metadata.course_slug` | Which course was purchased |
| `metadata.course_name` | Human-readable course name |
| `metadata.selected_date` | Date the student selected from the form (if any) |
| `metadata.customer_name` / `customer_phone` | Direct contact info for follow-up |
| `metadata.source` | Always `corsair_website` so we can filter in Stripe dashboard |

---

### Implementation: Webhook for Confirmation

**File to create:** `src/app/api/webhooks/stripe/route.ts`

```ts
// Listen for successful payments — triggers email + internal notification
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    // TODO:
    //  1. Send confirmation email to customer (Resend/SendGrid)
    //  2. Send internal notification to Steve (email or SMS)
    //  3. Log to a Google Sheet or simple Airtable for manual booking follow-up
  }

  return NextResponse.json({ received: true });
}
```

**Events to handle:**
- `checkout.session.completed` → payment successful, kick off confirmations
- `checkout.session.expired` → (optional) cleanup, notify sales of abandoned cart
- `charge.refunded` → (optional) notify ops team of refund

---

### Environment Variables Required

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://corsair-tactical-solutions.vercel.app
```

Add these to **Vercel Project Settings → Environment Variables** (and mirror locally in `.env.local` — never commit).

---

### Alternative: Stripe Payment Links (Zero Code)

For the absolute fastest launch, each course can get a dedicated Payment Link generated in the Stripe Dashboard:

1. Dashboard → Products → Create product for each course
2. Dashboard → Payment Links → Create link for each product
3. Drop those URLs into the Book/Enroll buttons on each course page

**Pros:** Zero backend code, zero maintenance, done in 30 minutes.
**Cons:** No dynamic metadata (date selection, custom form), less trackable.

**Recommendation:** Start with Payment Links while the Checkout Session API is being built, then upgrade.

---

## Phase 2 — Database + Automation

When we outgrow manual scheduling, add a database.

### When to trigger Phase 2
- Class schedules need to be shown dynamically
- Capacity/seats-remaining must be enforced
- Students need to see their booking history
- Waivers must be signed digitally and stored
- Refund/reschedule needs self-service

### Recommended stack

| Option | Strengths | Best for |
|--------|-----------|----------|
| **Supabase** *(recommended)* | Postgres + Auth + Row-Level Security + Storage, excellent Next.js SDK, generous free tier | Corsair's use case — clean, type-safe, fully managed |
| **Neon** | Serverless Postgres, instant branching for staging, pay-per-use | Teams that want pure Postgres with no extras |
| **Firebase** | Fast to set up, real-time sync, large community | Realtime-heavy apps (not ideal here) |

**Recommendation: Supabase.** It gives us Postgres + Auth + file storage (for signed waivers, training photos) in a single managed service with free tier that covers early-stage traffic.

### Phase 2 Data Model (draft)

```
customers (from Stripe customer.id, email, name, phone, address)
courses  (id, slug, name, price_cents, duration_minutes, category)
schedules (id, course_id, starts_at, ends_at, location, capacity, seats_taken)
bookings (id, customer_id, schedule_id, stripe_session_id, status, created_at)
waivers  (id, booking_id, signed_at, signature_image_url, ip, user_agent)
messages (id, booking_id, channel, direction, body, sent_at)
```

### Phase 2 Features Enabled

- Real-time seats-remaining on each course page
- Student self-service reschedule within policy window
- Digital waiver signing + storage (references the `/training-waiver` page)
- SMS + email automations (Twilio / Resend)
- Admin dashboard for Steve: upcoming classes, rosters, payments, refunds
- Reporting: revenue by course, repeat students, lead → booking conversion

### Phase 2 Integrations to Add
- **Resend or SendGrid** — transactional email
- **Twilio** — SMS reminders (with opt-in from contact form consent)
- **Google Calendar API** — write scheduled classes to Steve's calendar
- **Zapier / Make** (optional) — connect Stripe events to Airtable for ops

---

## Security Checklist (Both Phases)

- [ ] Never expose `STRIPE_SECRET_KEY` to the client — only use in `/api` route handlers
- [ ] Verify every webhook via `stripe.webhooks.constructEvent` + secret
- [ ] Use HTTPS only (Vercel default)
- [ ] Keep PCI scope minimal by always redirecting to Stripe-hosted Checkout
- [ ] Log webhook events to a tamper-evident log (Vercel Log or Logtail)
- [ ] Test with Stripe test keys in a preview deployment before flipping to live keys
- [ ] Document refund process per the `/refund-cancellation-policy` page

---

## What NOT to do

- ❌ Do not build a custom card form — use Stripe Checkout
- ❌ Do not store credit card numbers, CVVs, or tokens ourselves
- ❌ Do not fake payment success in the UI without a real Stripe session
- ❌ Do not put the Stripe secret key in `NEXT_PUBLIC_*` variables
- ❌ Do not handle booking + capacity in memory or JSON files in production

---

**Owner:** Corsair Tactical Solutions
**Last reviewed:** January 2025
**Implementation ticket:** TBD