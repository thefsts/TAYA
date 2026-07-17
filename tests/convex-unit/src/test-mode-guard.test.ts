/**
 * Production guard tests — CONVEX_TEST_MODE fail-closed behavior.
 *
 * Verifies convex/lib/testMode.ts:
 *   - test mode is off by default
 *   - test mode requires CONVEX_TEST_MODE=true
 *   - a production-marked deployment (CONVEX_DEPLOYMENT_ENVIRONMENT=production)
 *     can NEVER operate in test mode, even if CONVEX_TEST_MODE=true is set
 *   - requireTestEnvironment throws the loud SECURITY error on that conflict
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { isTestMode, isProductionDeployment, requireTestEnvironment } from "../../../convex/lib/testMode";

afterEach(() => vi.unstubAllEnvs());

describe("isTestMode", () => {
  it("is false by default", () => {
    vi.stubEnv("CONVEX_TEST_MODE", "");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "");
    expect(isTestMode()).toBe(false);
  });

  it("is true only when CONVEX_TEST_MODE=true on a non-production deployment", () => {
    vi.stubEnv("CONVEX_TEST_MODE", "true");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "");
    expect(isTestMode()).toBe(true);
  });

  it("fails closed: production marker overrides CONVEX_TEST_MODE=true", () => {
    vi.stubEnv("CONVEX_TEST_MODE", "true");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");
    expect(isProductionDeployment()).toBe(true);
    expect(isTestMode()).toBe(false);
  });
});

describe("requireTestEnvironment", () => {
  it("throws outside test environments", () => {
    vi.stubEnv("CONVEX_TEST_MODE", "");
    expect(() => requireTestEnvironment("someFn")).toThrow(/only available in test environments/);
  });

  it("passes in an approved test environment", () => {
    vi.stubEnv("CONVEX_TEST_MODE", "true");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "");
    expect(() => requireTestEnvironment("someFn")).not.toThrow();
  });

  it("raises the loud SECURITY error when test mode is set on production", () => {
    vi.stubEnv("CONVEX_TEST_MODE", "true");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");
    expect(() => requireTestEnvironment("someFn")).toThrow(/SECURITY: someFn blocked/);
  });
});
