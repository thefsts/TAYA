/**
 * Seed gate tests — SEED_ALLOWED fail-closed behavior.
 *
 * Verifies convex/seed.ts:
 *   - seedTestSite throws when SEED_ALLOWED is absent / not "true"
 *   - seedTestSite succeeds when SEED_ALLOWED=true
 *   - archiveApexTestSite is guarded by the same env check
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

afterEach(() => vi.unstubAllEnvs());

// ── seedTestSite ─────────────────────────────────────────────────────────────

describe("seedTestSite — SEED_ALLOWED gate", () => {
  it("throws when SEED_ALLOWED is not set", async () => {
    vi.stubEnv("SEED_ALLOWED", "");
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.seed.seedTestSite, {}),
    ).rejects.toThrow(/Seed mutations are disabled on this deployment/);
  });

  it("throws when SEED_ALLOWED is set to an arbitrary truthy string (not exactly 'true')", async () => {
    vi.stubEnv("SEED_ALLOWED", "yes");
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.seed.seedTestSite, {}),
    ).rejects.toThrow(/Seed mutations are disabled on this deployment/);
  });

  it("succeeds when SEED_ALLOWED=true", async () => {
    vi.stubEnv("SEED_ALLOWED", "true");
    const t = convexTest(schema, modules);
    const result = await t.mutation(api.seed.seedTestSite, {
      businessName: "Test Studio",
    });
    expect(result.skipped).toBe(false);
    expect(result.slug).toBe("test-studio");
  });
});

// ── archiveApexTestSite ───────────────────────────────────────────────────────

describe("archiveApexTestSite — SEED_ALLOWED gate", () => {
  it("throws when SEED_ALLOWED is not set", async () => {
    vi.stubEnv("SEED_ALLOWED", "");
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.seed.archiveApexTestSite, {}),
    ).rejects.toThrow(/Seed mutations are disabled on this deployment/);
  });

  it("passes the gate when SEED_ALLOWED=true (returns not-found message when apex site absent)", async () => {
    vi.stubEnv("SEED_ALLOWED", "true");
    const t = convexTest(schema, modules);
    const result = await t.mutation(api.seed.archiveApexTestSite, {});
    // No seed data present → site not found, but the guard was satisfied
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });
});
