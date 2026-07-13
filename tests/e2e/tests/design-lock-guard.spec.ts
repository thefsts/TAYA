/**
 * E2E tests: DesignLockGuard route protection
 *
 * Verifies that:
 *   A. A client-role user is redirected to /app when navigating directly to any
 *      design-locked route (/email, /nav, /backups under /app/sites/:siteId/).
 *   B. A super-admin user can access those routes without any redirect.
 *
 * Authentication uses the Clerk Backend API sign_in_tokens endpoint so no UI
 * interaction with the sign-in form is required.
 *
 * For the super-admin test the promotion is applied AFTER the first sign-in so
 * that the real Clerk user ID is already written to the Convex DB.  The
 * promoteToSuperAdminByClerkId mutation looks up the record by the
 * by_clerk_user_id index — reliable regardless of whether the email claim is
 * present in the Convex JWT template.  Convex's reactive useQuery(api.users.me)
 * automatically pushes the update to the browser, so the badge flips from USER
 * to SUPER_ADMIN without a page reload.
 */

import { test, expect, type Page } from "@playwright/test";
import { getClerkTicketSignInPath, findClerkUserByEmail } from "../helpers/clerk";
import { promoteToSuperAdmin } from "../helpers/convex";

const DESIGN_LOCKED_ROUTES = [
  "/app/sites/testsite-001/email",
  "/app/sites/testsite-001/nav",
  "/app/sites/testsite-001/backups",
] as const;

const CLIENT_EMAIL = "e2e-client-playwright@fststest.dev";
const SUPERADMIN_EMAIL = "e2e-superadmin-playwright@fststest.dev";

/**
 * Signs in via Clerk ticket, waits for the app to land on /app, and waits
 * until the role badge shows a stable value (USER or SUPER_ADMIN).
 */
async function signInAndWaitForBadge(
  page: Page,
  email: string,
  firstName: string,
  lastName: string
) {
  const signInPath = await getClerkTicketSignInPath(email, firstName, lastName);

  await page.goto(signInPath);

  await page.waitForURL((url) => new URL(url).pathname === "/app", {
    timeout: 45_000,
  });

  const badge = page.locator(".font-mono").first();
  await badge.waitFor({ state: "visible", timeout: 15_000 });

  await expect(async () => {
    const text = (await badge.textContent()) ?? "";
    expect(text.trim()).toMatch(/USER|SUPER_ADMIN/);
  }).toPass({ timeout: 40_000, intervals: [2_000] });

  return badge;
}

test.describe("DesignLockGuard", () => {
  test("redirects client-role user from all design-locked routes to /app", async ({
    page,
  }) => {
    const badge = await signInAndWaitForBadge(
      page,
      CLIENT_EMAIL,
      "E2E",
      "ClientPlaywright"
    );

    await expect(badge).toHaveText("USER", { timeout: 10_000 });

    for (const route of DESIGN_LOCKED_ROUTES) {
      await page.goto(route);

      await page.waitForURL(
        (url) => new URL(url).pathname === "/app",
        { timeout: 15_000 }
      );

      expect(
        new URL(page.url()).pathname,
        `Expected redirect from ${route} to /app`
      ).toBe("/app");
    }
  });

  test("super-admin can access design-locked routes without redirect", async ({
    page,
  }) => {
    const badge = await signInAndWaitForBadge(
      page,
      SUPERADMIN_EMAIL,
      "E2E",
      "SuperAdminPlaywright"
    );

    const currentRole = (await badge.textContent())?.trim();

    if (currentRole !== "SUPER_ADMIN") {
      const clerkUser = await findClerkUserByEmail(SUPERADMIN_EMAIL);
      if (!clerkUser) throw new Error(`Clerk user not found: ${SUPERADMIN_EMAIL}`);

      await promoteToSuperAdmin(clerkUser.id);

      await expect(badge).toHaveText("SUPER_ADMIN", { timeout: 20_000 });
    }

    for (const route of DESIGN_LOCKED_ROUTES) {
      await page.goto(route);

      await expect(async () => {
        expect(
          new URL(page.url()).pathname,
          `${route}: expected to stay, not redirect to /app`
        ).toBe(route);
      }).toPass({ timeout: 12_000, intervals: [1_000] });
    }
  });
});
