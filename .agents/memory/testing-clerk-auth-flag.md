---
name: testClerkAuth flag required for runTest e2e tests with Clerk sign-in
description: Omitting testClerkAuth:true on runTest() causes flaky/non-deterministic Clerk sign-in and misleading 401s that look like app bugs
---

When an e2e test plan includes a `[Clerk Auth] Sign in as ...` step, the `runTest()` call itself must pass `testClerkAuth: true`. Without it, sign-in is non-deterministic (intermittent "Couldn't find your account" errors) and the signed-in browser session may never actually reach the backend as an authenticated request — even though the page renders (component UI often has default/empty states that render regardless of query success).

**Why:** Spent a full debugging session chasing a "PUT returns 401 but GET succeeds" bug that looked like a real app bug (added debug logging, restarted workflows repeatedly, inspected CORS/middleware/customFetch symmetry). The real cause: `testClerkAuth: true` was never passed, so the programmatic sign-in was flaky and the "successful" GET renders were just default UI shells, not proof of an authenticated request. `dashboard_users` never got a row for any of the test emails used that session — a fast tell that sign-in never truly completed.

**How to apply:** Always pass `testClerkAuth: true` in `runTest()` when the plan includes Clerk sign-in. If a mutation endpoint 401s in a test but a GET on the same resource "succeeds" (page renders), first check whether GET data actually loaded (not just default/empty state) and whether the test user landed in the users table — before assuming a backend auth bug. To get a fast, deterministic ground-truth signal independent of the flaky browser/test harness, mint a real Clerk session token directly server-side (`clerkClient.sessions.createSession({userId})` + `clerkClient.sessions.getToken(sessionId)`, using `@clerk/backend`'s nested pnpm path if not directly resolvable) and `curl` the endpoint directly.
