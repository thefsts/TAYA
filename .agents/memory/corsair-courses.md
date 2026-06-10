---
name: Corsair courses.ts slugs and pricing
description: All security training course slugs and base prices for Corsair Tactical Solutions
---

Security training slugs (all payable via Square BookingForm):
  level-2-security-officer          $65   (added in QA pass, unarmed, 1-2 days)
  level-3-armed-security-officer    $130  (armed, 3-5 days, range fee $25 required)
  level-4-bodyguard                 $225  (PPO/bodyguard, 3-5 days)
  level-3-4-complete-package        $400  (bundle w/ LTC, 5-7 days)

All 4 slugs are in BookingForm GOV_ID_SLUGS (government ID acknowledgment required).
Security training page (/security-training) cert cards link to /courses/[slug].

Event: texas-ltc-certification-class-jun2026 — $100, 20-seat cap, Jun 13 2026.
Seat counter at /api/seats, 409 when full.

courses.ts location: src/lib/courses.ts (NOT src/data/courses.ts)
events.ts location: src/data/events.ts
pricing.ts: src/lib/pricing.ts (getCatalog, resolveCoursePayment)

**Why:** Needed to know which slugs exist before modifying course pages or payment routes.
