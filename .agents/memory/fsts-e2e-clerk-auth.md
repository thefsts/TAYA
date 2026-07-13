---
name: FSTS E2E Clerk auth pattern
description: How to authenticate test users and set Convex roles in E2E tests for the FSTS dashboard (Clerk + Convex stack).
---

# FSTS E2E Clerk auth pattern

## Rule
For E2E tests that need to sign in as a Convex super-admin:
1. Create the Clerk user and get a sign-in ticket via the Backend API.
2. Navigate to `/sign-in?__clerk_ticket=TOKEN` — Clerk SDK processes it automatically, no UI required.
3. Wait for the URL to land on `/app` (HomeRedirect fires after Clerk completes).
4. Wait for any role badge (USER|SUPER_ADMIN) to appear — this means provisionMe has run.
5. If badge is USER, call `users:promoteToSuperAdminByClerkId` via Convex HTTP API with the user's real Clerk ID.
6. Convex's reactive `useQuery(api.users.me)` pushes the update live — badge flips to SUPER_ADMIN without reload.

**Why:** The Convex JWT template for this app may not include the email claim, so `identity.email` in `provisionUser` can be undefined and the fallback email `{clerkId}@unknown.local` is stored. Any seeding approach that looks up by the original email (e.g. pending-record pattern) silently fails. Looking up by Clerk user ID (`by_clerk_user_id` index) is always reliable.

**How to apply:** Any future E2E test that needs a super-admin should follow the sign-in-first, promote-after pattern. See `tests/e2e/tests/design-lock-guard.spec.ts` and `tests/e2e/helpers/`.

## Clerk API shape gotcha
`GET /v1/users?email_address=...` returns a **plain JSON array**, NOT `{ data: [...] }`.
Always normalize:
```ts
const data = await resp.json();
const users = Array.isArray(data) ? data : data.data ?? [];
```

## Convex mutation for promotion
`users:promoteToSuperAdminByClerkId` — public mutation, looks up by `by_clerk_user_id` index, patches `isSuperAdmin: true`. Currently no auth guard (test-only helper).
