# FSTS-WOS™ — Same-Day Corsair QA Runbook

**Target:** Begin live Corsair dashboard acceptance testing as soon as test authentication is available.

## Hard gates

1. Latest `main` deployment must be `READY` in Vercel Production.
2. No unresolved blocked/error production deployment may exist ahead of the tested commit.
3. Tester must authenticate through Clerk. Do not bypass authentication in production.
4. Tester must be site-scoped to Corsair and must not receive platform superadmin rights.
5. Public self-registration may remain restricted; test access can be provisioned through Clerk admin/invite or the existing E2E sign-in-ticket helper.

## Corsair tenant

- Site slug: `corsair-tactical`
- Domain: `corsairtacticalsolutions.com`
- Convex site ID: `qd7cpjk68m0z4rme5hw4sqgeys8bk1zc`
- Expected client role: `owner`
- `isSuperAdmin`: **false**

## Authentication acceptance

- [ ] Branded `/sign-in` renders correctly on desktop and mobile.
- [ ] Branded `/sign-up`/invitation flow renders correctly.
- [ ] Provisioned tester can authenticate successfully.
- [ ] First login reaches `/app` without blank/white screen.
- [ ] `users.provisionMe` completes without client-visible error.
- [ ] Logout returns to the branded sign-in experience.
- [ ] Re-login restores the correct Corsair access.
- [ ] Client cannot reach `/app/admin/*` routes.
- [ ] Client cannot view or mutate any other tenant.

## Round 1 — Client dashboard visual/runtime QA

Open Corsair and walk every enabled sidebar module. For each page verify: page loads, correct tenant content appears, mobile layout is usable, empty/loading/error states are understandable, and browser navigation does not produce a blank screen.

- [ ] Dashboard / site overview
- [ ] Homepage Editor
- [ ] Services
- [ ] Products / Offerings
- [ ] Courses
- [ ] Events
- [ ] Articles / Blog
- [ ] Media Library
- [ ] Forms Builder
- [ ] Contact / Inbox
- [ ] FAQ
- [ ] Testimonials / Reviews
- [ ] Navigation
- [ ] Footer
- [ ] Announcement Banner
- [ ] CTA Manager
- [ ] Downloads
- [ ] Careers
- [ ] Popup Manager
- [ ] SEO Settings
- [ ] Website Settings
- [ ] Portal Manager
- [ ] Permissions / design locks
- [ ] AI Assistant status and setup state

## Round 2 — Controlled write tests

Use harmless test content and restore it after verification.

- [ ] Edit one homepage text field; save; refresh; confirm persistence.
- [ ] Edit one Corsair article; save as draft; refresh; confirm persistence.
- [ ] Publish/unpublish a controlled test article and verify public Blog behavior.
- [ ] Edit one course field and confirm the public site consumes the update.
- [ ] Edit one event field and confirm the public site consumes the update.
- [ ] Add/edit/hide one testimonial and verify public visibility behavior.
- [ ] Add/update one CTA or announcement and verify public site synchronization.
- [ ] Upload one real image through Media Library; verify Convex storage URL and preview.
- [ ] Replace/archive the test media asset and verify usage/cleanup behavior.
- [ ] Submit one test form and confirm the submission appears in Inbox.

## Round 3 — Corsair public-site integration

- [ ] `corsairtacticalsolutions.com` loads without runtime errors.
- [ ] `/blog` is publicly reachable and displays published dashboard articles.
- [ ] Navigation Blog link points to `/blog` and works.
- [ ] Courses reflect dashboard-published records.
- [ ] Events reflect dashboard-published records.
- [ ] Contact/footer/CTA/announcement changes synchronize correctly.
- [ ] Member Portal link points to `/portal/corsair-tactical/login`.
- [ ] Hidden/draft content never appears publicly.

## Round 4 — Security and tenant isolation

- [ ] Corsair tester has site-scoped `owner` rights only.
- [ ] No admin/superadmin controls are visible to the Corsair tester.
- [ ] Direct URL attempt to `/app/admin/users` is denied/redirected.
- [ ] Direct URL attempt using another site's ID is denied.
- [ ] Design-locked controls remain protected.
- [ ] Delete/archive confirmations are present for destructive actions.

## Round 5 — Responsive and stability

Test at minimum desktop, tablet, and narrow mobile widths.

- [ ] Sidebar/navigation usable on mobile.
- [ ] Auth pages fit without horizontal scrolling.
- [ ] Dialogs fit within viewport and remain scrollable.
- [ ] Tables/cards remain usable on small screens.
- [ ] No white/blank route transitions.
- [ ] No repeated client-visible errors during normal navigation.
- [ ] Vercel Production runtime error clusters remain clear after test session.

## AI acceptance

AI code can be considered UI-ready before provider credentials are installed, but final functional acceptance requires:

- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`

Before credentials are present:

- [ ] AI Assistant shows a clear setup-pending state rather than appearing broken.
- [ ] Normal website tools remain usable.

After credentials are present:

- [ ] Status reports ready.
- [ ] Quick prompt returns a response.
- [ ] Page-context prompt understands the active manager.
- [ ] Provider errors are shown as friendly client messages.

## Defect handling rule

For every defect found:

1. Record route, account role, reproduction steps, expected behavior, and actual behavior.
2. Fix on `main`.
3. Wait for Vercel **Production** deployment to reach `READY`.
4. Retest the defect in Production.
5. Retest the nearest related workflow for regression.
6. Continue only when the production gate is green.

## Exit criteria for first Corsair pilot

Corsair is ready for normal client use when authentication, tenant isolation, the enabled manager set, public-site synchronization, Media Library upload, Forms/Inbox, Blog, responsive behavior, and AI setup state have all passed; no P0/P1 defects remain; and the latest tested commit is `READY` in Vercel Production.
