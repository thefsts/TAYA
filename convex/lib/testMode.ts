/**
 * Test-mode guard — FSTS-WOS™ production protection.
 *
 * `CONVEX_TEST_MODE=true` unlocks test-only bootstrap functions
 * (users.upsertTestSuperAdmin, users.promoteToSuperAdminByClerkId without a
 * superadmin caller, healthScans.testHarness). On a production deployment
 * this would be a privilege-escalation backdoor, so the guard FAILS CLOSED:
 *
 *   - Test mode is honored ONLY when `CONVEX_TEST_MODE === "true"` AND the
 *     deployment is not marked production.
 *   - Production deployments must set `CONVEX_DEPLOYMENT_ENVIRONMENT=production`
 *     (enforced by scripts/check-prod-env.sh at deploy time). When that marker
 *     is present, test mode is refused even if CONVEX_TEST_MODE was set.
 *
 * See docs/repo-governance.md ("Environment safety") for the full contract.
 */

export function isProductionDeployment(): boolean {
  return process.env.CONVEX_DEPLOYMENT_ENVIRONMENT === "production";
}

export function isTestMode(): boolean {
  if (process.env.CONVEX_TEST_MODE !== "true") return false;
  // Fail closed: a production-marked deployment can never operate in test mode.
  if (isProductionDeployment()) return false;
  return true;
}

/**
 * Throw unless this deployment is an approved test environment.
 * Call at the top of every test-only Convex function.
 */
export function requireTestEnvironment(fnName: string): void {
  if (process.env.CONVEX_TEST_MODE === "true" && isProductionDeployment()) {
    throw new Error(
      `SECURITY: ${fnName} blocked — CONVEX_TEST_MODE=true is set on a production deployment. ` +
        `Remove CONVEX_TEST_MODE from the production Convex environment immediately.`,
    );
  }
  if (!isTestMode()) {
    throw new Error(`${fnName} is only available in test environments (CONVEX_TEST_MODE=true)`);
  }
}
