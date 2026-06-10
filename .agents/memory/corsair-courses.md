---
name: Corsair email and security course decisions
description: Durable constraints about email sending pattern, security course GOV_ID requirements, and course catalog location
---

**Email send pattern:** Raw `fetch` to Resend API — NOT the Resend SDK. Fire-and-forget with `Promise.all`. Applies in all API routes (contact, create-payment, event-register).

**Why:** The project uses plain fetch for consistency and to avoid adding a dependency. Switching to the SDK would require installing it in the artifact package.

**GOV_ID_SLUGS constraint:** All security training courses (Level II through Level III/IV combo) require government ID acknowledgment in the booking form. When adding a new security course, add its slug to `GOV_ID_SLUGS` in BookingForm.tsx.

**Why:** Texas DPS regulations require identity verification for security officer certifications.

**Security course location:** Security training courses live in `src/lib/courses.ts` (not `src/data/`). The security category list in that same file must be updated when adding a new slug, or `getCoursesByCategory('security')` will miss it.

**Why:** Took two files to add Level II correctly — easy to miss the category list.

**Courses vs data split:** Course definitions = `src/lib/courses.ts`. Events = `src/data/events.ts`. Pricing/catalog resolution = `src/lib/pricing.ts`.

**How to apply:** Any time a new course is added or an email notification is wired up.
