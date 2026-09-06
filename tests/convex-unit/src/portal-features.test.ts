/**
 * Tests: normalizeEnabledFeatures — canonical portal feature keys
 *
 * Root defect (P5 audit): production portal configs were seeded with legacy
 * feature keys (courseMaterials / bookingHistory / messaging) while the
 * dashboard UI and PortalManager toggles use canonical keys
 * (courses / events / documents / messages / invoices / certificates / support).
 * The key mismatch made admin-configured toggles invisible to the portal.
 *
 * normalizeEnabledFeatures in convex/lib/portalFeatures.ts is the single
 * source of truth:
 *   - canonical key in source always wins (even explicit false)
 *   - legacy aliases consulted only when canonical key is absent
 *   - unknown keys dropped
 *   - null/undefined input safe
 *   - output is ALWAYS the full 7-key canonical shape
 */

import { describe, it, expect } from "vitest";
import {
  normalizeEnabledFeatures,
  PORTAL_FEATURE_KEYS,
} from "../../convex/lib/portalFeatures.js";

describe("normalizeEnabledFeatures", () => {
  it("returns all 7 canonical keys false for null input", () => {
    expect(normalizeEnabledFeatures(null)).toEqual({
      courses: false,
      events: false,
      documents: false,
      messages: false,
      invoices: false,
      certificates: false,
      support: false,
    });
  });

  it("returns all 7 canonical keys false for undefined input", () => {
    expect(normalizeEnabledFeatures(undefined)).toEqual({
      courses: false,
      events: false,
      documents: false,
      messages: false,
      invoices: false,
      certificates: false,
      support: false,
    });
  });

  it("returns all false for empty object", () => {
    expect(normalizeEnabledFeatures({})).toEqual({
      courses: false,
      events: false,
      documents: false,
      messages: false,
      invoices: false,
      certificates: false,
      support: false,
    });
  });

  it("canonical true wins over legacy alias false", () => {
    const out = normalizeEnabledFeatures({
      courses: true,
      courseMaterials: false,
    });
    expect(out.courses).toBe(true);
  });

  it("canonical false wins over legacy alias true (explicit disable honored)", () => {
    const out = normalizeEnabledFeatures({
      courses: false,
      courseMaterials: true,
    });
    expect(out.courses).toBe(false);
  });

  it("legacy alias true used when canonical key absent (courseMaterials -> courses)", () => {
    const out = normalizeEnabledFeatures({ courseMaterials: true });
    expect(out.courses).toBe(true);
  });

  it("legacy alias bookingHistory -> events", () => {
    expect(normalizeEnabledFeatures({ bookingHistory: true }).events).toBe(
      true
    );
    expect(normalizeEnabledFeatures({ booking_history: true }).events).toBe(
      true
    );
    expect(normalizeEnabledFeatures({ myEvents: true }).events).toBe(true);
  });

  it("legacy alias messaging -> messages", () => {
    expect(normalizeEnabledFeatures({ messaging: true }).messages).toBe(true);
    expect(normalizeEnabledFeatures({ messageCenter: true }).messages).toBe(
      true
    );
  });

  it("messaging:false legacy disables messages when canonical absent", () => {
    const out = normalizeEnabledFeatures({ messaging: false });
    expect(out.messages).toBe(false);
  });

  it("unknown keys are dropped from output", () => {
    const out = normalizeEnabledFeatures({
      unknownFeature: true,
      courses: true,
    }) as Record<string, boolean>;
    expect(Object.keys(out).sort()).toEqual(
      [...PORTAL_FEATURE_KEYS].sort() as string[]
    );
    expect("unknownFeature" in out).toBe(false);
  });

  it("strict boolean contract: only literal true enables (no truthy coercion)", () => {
    expect(normalizeEnabledFeatures({ courses: 1 }).courses).toBe(false);
    expect(normalizeEnabledFeatures({ courses: "yes" }).courses).toBe(false);
    expect(normalizeEnabledFeatures({ courses: 0 }).courses).toBe(false);
    expect(normalizeEnabledFeatures({ courses: "" }).courses).toBe(false);
    expect(normalizeEnabledFeatures({ courses: null }).courses).toBe(false);
  });

  it("production Corsair config shape (legacy keys) normalizes correctly", () => {
    // Exact shape found in production: legacy keys, certificates true,
    // messaging false, invoices/support absent
    const out = normalizeEnabledFeatures({
      bookingHistory: true,
      certificates: true,
      courseMaterials: true,
      messaging: false,
    });
    expect(out).toEqual({
      courses: true,
      events: true,
      documents: false,
      messages: false,
      invoices: false,
      certificates: true,
      support: false,
    });
  });

  it("output is a fresh object (mutation safe) and idempotent", () => {
    const raw = { courseMaterials: true };
    const once = normalizeEnabledFeatures(raw);
    const twice = normalizeEnabledFeatures(once);
    expect(once).toEqual(twice);
    once.courses = false;
    expect(normalizeEnabledFeatures(raw).courses).toBe(true);
  });
});
