# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: design-lock-guard.spec.ts >> DesignLockGuard >> super-admin can access design-locked routes without redirect
- Location: tests/design-lock-guard.spec.ts:91:7

# Error details

```
Error: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost/sign-in?__clerk_ticket=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlaXMiOjMwMCwiZXhwIjoxNzgzOTU3OTYwLCJpaWQiOiJpbnNfM0c0Mmg0VWRJU3pFbXlaT0EwRzNiQUZrcUtUIiwic2lkIjoic2l0XzNHU0dmZWtxVmlXbXI5WUZJNXIzZmlMZGNsdiIsInN0Ijoic2lnbl9pbl90b2tlbiJ9.fU3u2XcARgxgFtjJpFQ1mufITFd35LyYssf0xbX9vbVfM2Q9LDjXasqdyvlPuZt9HZENnLhFgOvuJO3eo3SEhM6y92GLtDa1L7C_Rja1XC0Rw8rbsl_ZI-jf4kzdxzNsWwqh4Bf5Nf7gu92zzHNrSTcQYMJMrZRwErZ4VocZsXcWSEVFri9lynV766N-fQcNp9lPYvi4V45H808LyGZ8E19urnyrekMmjyX9wD9viVDJF8Qr0bUwXOgYqLpYT0lM_tkFydj2kTMXSz2GmP-oavICLEj1qX22QFf6CK_Qpe89crgbSQ9j2Z8TkW-xuf_gENMUxoMSlkhrsOyWwPu3Vw
Call log:
  - navigating to "http://localhost/sign-in?__clerk_ticket=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlaXMiOjMwMCwiZXhwIjoxNzgzOTU3OTYwLCJpaWQiOiJpbnNfM0c0Mmg0VWRJU3pFbXlaT0EwRzNiQUZrcUtUIiwic2lkIjoic2l0XzNHU0dmZWtxVmlXbXI5WUZJNXIzZmlMZGNsdiIsInN0Ijoic2lnbl9pbl90b2tlbiJ9.fU3u2XcARgxgFtjJpFQ1mufITFd35LyYssf0xbX9vbVfM2Q9LDjXasqdyvlPuZt9HZENnLhFgOvuJO3eo3SEhM6y92GLtDa1L7C_Rja1XC0Rw8rbsl_ZI-jf4kzdxzNsWwqh4Bf5Nf7gu92zzHNrSTcQYMJMrZRwErZ4VocZsXcWSEVFri9lynV766N-fQcNp9lPYvi4V45H808LyGZ8E19urnyrekMmjyX9wD9viVDJF8Qr0bUwXOgYqLpYT0lM_tkFydj2kTMXSz2GmP-oavICLEj1qX22QFf6CK_Qpe89crgbSQ9j2Z8TkW-xuf_gENMUxoMSlkhrsOyWwPu3Vw", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This page isn’t working" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: localhost
      - text: is currently unable to handle this request.
    - generic [ref=e10]: HTTP ERROR 502
  - button "Reload" [ref=e13] [cursor=pointer]
```

# Test source

```ts
  1   | /**
  2   |  * E2E tests: DesignLockGuard route protection
  3   |  *
  4   |  * Verifies that:
  5   |  *   A. A client-role user is redirected to /app when navigating directly to any
  6   |  *      design-locked route (/email, /nav, /backups under /app/sites/:siteId/).
  7   |  *   B. A super-admin user can access those routes without any redirect.
  8   |  *
  9   |  * Authentication uses the Clerk Backend API sign_in_tokens endpoint so no UI
  10  |  * interaction with the sign-in form is required.
  11  |  *
  12  |  * For the super-admin test the promotion is applied AFTER the first sign-in so
  13  |  * that the real Clerk user ID is already written to the Convex DB.  The
  14  |  * promoteToSuperAdminByClerkId mutation looks up the record by the
  15  |  * by_clerk_user_id index — reliable regardless of whether the email claim is
  16  |  * present in the Convex JWT template.  Convex's reactive useQuery(api.users.me)
  17  |  * automatically pushes the update to the browser, so the badge flips from USER
  18  |  * to SUPER_ADMIN without a page reload.
  19  |  */
  20  | 
  21  | import { test, expect, type Page } from "@playwright/test";
  22  | import { getClerkTicketSignInPath, findClerkUserByEmail } from "../helpers/clerk";
  23  | import { promoteToSuperAdmin } from "../helpers/convex";
  24  | 
  25  | const DESIGN_LOCKED_ROUTES = [
  26  |   "/app/sites/testsite-001/email",
  27  |   "/app/sites/testsite-001/nav",
  28  |   "/app/sites/testsite-001/backups",
  29  | ] as const;
  30  | 
  31  | const CLIENT_EMAIL = "e2e-client-playwright@fststest.dev";
  32  | const SUPERADMIN_EMAIL = "e2e-superadmin-playwright@fststest.dev";
  33  | 
  34  | /**
  35  |  * Signs in via Clerk ticket, waits for the app to land on /app, and waits
  36  |  * until the role badge shows a stable value (USER or SUPER_ADMIN).
  37  |  */
  38  | async function signInAndWaitForBadge(
  39  |   page: Page,
  40  |   email: string,
  41  |   firstName: string,
  42  |   lastName: string
  43  | ) {
  44  |   const signInPath = await getClerkTicketSignInPath(email, firstName, lastName);
  45  | 
> 46  |   await page.goto(signInPath);
      |              ^ Error: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost/sign-in?__clerk_ticket=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlaXMiOjMwMCwiZXhwIjoxNzgzOTU3OTYwLCJpaWQiOiJpbnNfM0c0Mmg0VWRJU3pFbXlaT0EwRzNiQUZrcUtUIiwic2lkIjoic2l0XzNHU0dmZWtxVmlXbXI5WUZJNXIzZmlMZGNsdiIsInN0Ijoic2lnbl9pbl90b2tlbiJ9.fU3u2XcARgxgFtjJpFQ1mufITFd35LyYssf0xbX9vbVfM2Q9LDjXasqdyvlPuZt9HZENnLhFgOvuJO3eo3SEhM6y92GLtDa1L7C_Rja1XC0Rw8rbsl_ZI-jf4kzdxzNsWwqh4Bf5Nf7gu92zzHNrSTcQYMJMrZRwErZ4VocZsXcWSEVFri9lynV766N-fQcNp9lPYvi4V45H808LyGZ8E19urnyrekMmjyX9wD9viVDJF8Qr0bUwXOgYqLpYT0lM_tkFydj2kTMXSz2GmP-oavICLEj1qX22QFf6CK_Qpe89crgbSQ9j2Z8TkW-xuf_gENMUxoMSlkhrsOyWwPu3Vw
  47  | 
  48  |   await page.waitForURL((url) => new URL(url).pathname === "/app", {
  49  |     timeout: 45_000,
  50  |   });
  51  | 
  52  |   const badge = page.locator(".font-mono").first();
  53  |   await badge.waitFor({ state: "visible", timeout: 15_000 });
  54  | 
  55  |   await expect(async () => {
  56  |     const text = (await badge.textContent()) ?? "";
  57  |     expect(text.trim()).toMatch(/USER|SUPER_ADMIN/);
  58  |   }).toPass({ timeout: 40_000, intervals: [2_000] });
  59  | 
  60  |   return badge;
  61  | }
  62  | 
  63  | test.describe("DesignLockGuard", () => {
  64  |   test("redirects client-role user from all design-locked routes to /app", async ({
  65  |     page,
  66  |   }) => {
  67  |     const badge = await signInAndWaitForBadge(
  68  |       page,
  69  |       CLIENT_EMAIL,
  70  |       "E2E",
  71  |       "ClientPlaywright"
  72  |     );
  73  | 
  74  |     await expect(badge).toHaveText("USER", { timeout: 10_000 });
  75  | 
  76  |     for (const route of DESIGN_LOCKED_ROUTES) {
  77  |       await page.goto(route);
  78  | 
  79  |       await page.waitForURL(
  80  |         (url) => new URL(url).pathname === "/app",
  81  |         { timeout: 15_000 }
  82  |       );
  83  | 
  84  |       expect(
  85  |         new URL(page.url()).pathname,
  86  |         `Expected redirect from ${route} to /app`
  87  |       ).toBe("/app");
  88  |     }
  89  |   });
  90  | 
  91  |   test("super-admin can access design-locked routes without redirect", async ({
  92  |     page,
  93  |   }) => {
  94  |     const badge = await signInAndWaitForBadge(
  95  |       page,
  96  |       SUPERADMIN_EMAIL,
  97  |       "E2E",
  98  |       "SuperAdminPlaywright"
  99  |     );
  100 | 
  101 |     const currentRole = (await badge.textContent())?.trim();
  102 | 
  103 |     if (currentRole !== "SUPER_ADMIN") {
  104 |       const clerkUser = await findClerkUserByEmail(SUPERADMIN_EMAIL);
  105 |       if (!clerkUser) throw new Error(`Clerk user not found: ${SUPERADMIN_EMAIL}`);
  106 | 
  107 |       await promoteToSuperAdmin(clerkUser.id);
  108 | 
  109 |       await expect(badge).toHaveText("SUPER_ADMIN", { timeout: 20_000 });
  110 |     }
  111 | 
  112 |     for (const route of DESIGN_LOCKED_ROUTES) {
  113 |       await page.goto(route);
  114 | 
  115 |       await expect(async () => {
  116 |         expect(
  117 |           new URL(page.url()).pathname,
  118 |           `${route}: expected to stay, not redirect to /app`
  119 |         ).toBe(route);
  120 |       }).toPass({ timeout: 12_000, intervals: [1_000] });
  121 |     }
  122 |   });
  123 | });
  124 | 
```