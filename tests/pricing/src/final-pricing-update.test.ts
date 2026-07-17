/**
 * Pricing tests for the final approved course pricing update.
 *
 * Covers:
 *   - Texas LTC Shooting Proficiency ($75 base + $25 required range fee)
 *   - First Shots (no required range fee)
 *   - Introduction to Firearms ($50 individual option + $25 required range fee)
 *   - Continuing Education ($75 base, optional range fee included vs excluded)
 *   - AR-15 Rifle Course ($90 base + $25 required range fee; ammo $40 and rental $35 optional)
 *   - Shotgun Course ($75 base + $25 required range fee; ammo $35 and rental $25 optional)
 */

import { describe, it, expect } from "vitest";
import { getCourseBySlug } from "@/lib/courses";
import { resolveCoursePayment } from "@/lib/pricing";

// ── Texas LTC Shooting Proficiency — $75 ──────────────────────────────────

describe("texas-ltc-shooting-proficiency — $75 base price", () => {
  const course = getCourseBySlug("texas-ltc-shooting-proficiency");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it('price badge is "From $75"', () => {
    expect(course!.price).toBe("From $75");
  });

  it("pricingOption ltc-prof has price $75", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "ltc-prof");
    expect(opt).toBeDefined();
    expect(opt!.price).toBe(75);
  });

  it("resolveCoursePayment: baseCents = 7500", () => {
    const r = resolveCoursePayment("texas-ltc-shooting-proficiency", "ltc-prof", []);
    expect(r!.baseCents).toBe(7_500);
  });

  it("resolveCoursePayment: requiredFeesCents = 2500 (range fee)", () => {
    const r = resolveCoursePayment("texas-ltc-shooting-proficiency", "ltc-prof", []);
    expect(r!.requiredFeesCents).toBe(2_500);
  });

  it("resolveCoursePayment: totalCents = 10000 ($75 + $25 range fee)", () => {
    const r = resolveCoursePayment("texas-ltc-shooting-proficiency", "ltc-prof", []);
    expect(r!.totalCents).toBe(10_000);
  });
});

// ── First Shots — no required range fee ──────────────────────────────────

describe("first-shots-basic-firearm-training — no required range fee", () => {
  const course = getCourseBySlug("first-shots-basic-firearm-training");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it("has no requiredFees", () => {
    expect((course!.requiredFees ?? []).length).toBe(0);
  });

  it("resolveCoursePayment: requiredFeesCents = 0", () => {
    const r = resolveCoursePayment("first-shots-basic-firearm-training", "fs-group", []);
    expect(r!.requiredFeesCents).toBe(0);
  });

  it("resolveCoursePayment: totalCents = 5000 (base $50 only, no required fees)", () => {
    const r = resolveCoursePayment("first-shots-basic-firearm-training", "fs-group", []);
    expect(r!.totalCents).toBe(5_000);
  });

  it("range-fee is available as an optional add-on, not a required fee", () => {
    const requiredRangeFee = (course!.requiredFees ?? []).find((f) => f.id === "range-fee");
    expect(requiredRangeFee).toBeUndefined();
  });
});

// ── Introduction to Firearms — $50 individual option + $25 required range fee

describe("introduction-to-firearms — individual option and required range fee", () => {
  const course = getCourseBySlug("introduction-to-firearms");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it("has an intro-individual option at $50", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "intro-individual");
    expect(opt).toBeDefined();
    expect(opt!.price).toBe(50);
  });

  it("has an intro-group option at $50", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "intro-group");
    expect(opt).toBeDefined();
    expect(opt!.price).toBe(50);
  });

  it("has required range fee of $25", () => {
    const fee = (course!.requiredFees ?? []).find((f) => f.id === "range-fee");
    expect(fee).toBeDefined();
    expect(fee!.price).toBe(25);
  });

  it("resolveCoursePayment (individual): baseCents = 5000, totalCents = 7500", () => {
    const r = resolveCoursePayment("introduction-to-firearms", "intro-individual", []);
    expect(r!.baseCents).toBe(5_000);
    expect(r!.requiredFeesCents).toBe(2_500);
    expect(r!.totalCents).toBe(7_500);
  });

  it("resolveCoursePayment (group): baseCents = 5000, totalCents = 7500", () => {
    const r = resolveCoursePayment("introduction-to-firearms", "intro-group", []);
    expect(r!.baseCents).toBe(5_000);
    expect(r!.requiredFeesCents).toBe(2_500);
    expect(r!.totalCents).toBe(7_500);
  });
});

// ── Continuing Education — $75 base, optional range fee ───────────────────

describe("continuing-education — optional range fee (included vs excluded)", () => {
  const course = getCourseBySlug("continuing-education");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it('price badge is "From $75"', () => {
    expect(course!.price).toBe("From $75");
  });

  it("ce-standard option priced at $75", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "ce-standard");
    expect(opt).toBeDefined();
    expect(opt!.price).toBe(75);
  });

  it("has no required fees (range fee is optional)", () => {
    expect((course!.requiredFees ?? []).length).toBe(0);
  });

  it("range-fee is listed as an optional add-on at $25", () => {
    const addon = (course!.optionalAddOns ?? []).find((a) => a.id === "range-fee");
    expect(addon).toBeDefined();
    expect(addon!.price).toBe(25);
  });

  it("without range fee: totalCents = 7500 ($75 base only)", () => {
    const r = resolveCoursePayment("continuing-education", "ce-standard", []);
    expect(r!.totalCents).toBe(7_500);
    expect(r!.optionalAddonsCents).toBe(0);
  });

  it("with range fee selected: totalCents = 10000 ($75 + $25)", () => {
    const r = resolveCoursePayment("continuing-education", "ce-standard", ["range-fee"]);
    expect(r!.totalCents).toBe(10_000);
    expect(r!.optionalAddonsCents).toBe(2_500);
    expect(r!.appliedOptionalAddonIds).toContain("range-fee");
  });

  it("with ammo selected: totalCents = 8900 ($75 + $14)", () => {
    const r = resolveCoursePayment("continuing-education", "ce-standard", ["ammo-package"]);
    expect(r!.totalCents).toBe(8_900);
  });

  it("with all add-ons: totalCents = 12699 ($75 + $25 + $14 + $12.99)", () => {
    const r = resolveCoursePayment("continuing-education", "ce-standard", [
      "range-fee",
      "ammo-package",
      "firearm-rental",
    ]);
    expect(r!.totalCents).toBe(Math.round((75 + 25 + 14 + 12.99) * 100));
  });
});

// ── AR-15 Rifle Course — optional ammo ($40) and rental ($35) ────────────

describe("ar-15-rifle-course — optional add-ons (ammo and rental)", () => {
  const course = getCourseBySlug("ar-15-rifle-course");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it("base price is $90", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "ar15-base");
    expect(opt!.price).toBe(90);
  });

  it("requiredFees contains only the range-fee ($25)", () => {
    const fees = course!.requiredFees ?? [];
    expect(fees).toHaveLength(1);
    const rangeFee = fees.find((f) => f.id === "range-fee");
    expect(rangeFee).toBeDefined();
    expect(rangeFee!.price).toBe(25);
    expect(rangeFee!.required).toBe(true);
    expect(rangeFee!.locked).toBe(true);
  });

  it("optionalAddOns contains ar15-ammunition-50-rounds ($40) unchecked by default", () => {
    const addon = (course!.optionalAddOns ?? []).find((a) => a.id === "ar15-ammunition-50-rounds");
    expect(addon).toBeDefined();
    expect(addon!.price).toBe(40);
    expect(addon!.required).toBe(false);
    expect(addon!.locked).toBe(false);
  });

  it("optionalAddOns contains ar15-rental ($35) unchecked by default", () => {
    const addon = (course!.optionalAddOns ?? []).find((a) => a.id === "ar15-rental");
    expect(addon).toBeDefined();
    expect(addon!.price).toBe(35);
    expect(addon!.required).toBe(false);
    expect(addon!.locked).toBe(false);
  });

  it("scenario 1 — no add-ons: 2 line items, totalCents = 11500 ($90 + $25)", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", []);
    expect(r).not.toBeNull();
    expect(r!.baseCents).toBe(9_000);
    expect(r!.requiredFeesCents).toBe(2_500);
    expect(r!.optionalAddonsCents).toBe(0);
    expect(r!.totalCents).toBe(11_500);
    expect(r!.lineItems).toHaveLength(2);
    expect(r!.lineItems.filter((li) => li.kind === "fee")).toHaveLength(1);
  });

  it("scenario 2 — ammo only: 3 line items, totalCents = 15500 ($90 + $25 + $40)", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", ["ar15-ammunition-50-rounds"]);
    expect(r).not.toBeNull();
    expect(r!.optionalAddonsCents).toBe(4_000);
    expect(r!.totalCents).toBe(15_500);
    expect(r!.lineItems).toHaveLength(3);
    expect(r!.appliedOptionalAddonIds).toContain("ar15-ammunition-50-rounds");
  });

  it("scenario 3 — rental only: 3 line items, totalCents = 15000 ($90 + $25 + $35)", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", ["ar15-rental"]);
    expect(r).not.toBeNull();
    expect(r!.optionalAddonsCents).toBe(3_500);
    expect(r!.totalCents).toBe(15_000);
    expect(r!.lineItems).toHaveLength(3);
    expect(r!.appliedOptionalAddonIds).toContain("ar15-rental");
  });

  it("scenario 4 — both add-ons: 4 line items, totalCents = 19000 ($90 + $25 + $40 + $35)", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", ["ar15-ammunition-50-rounds", "ar15-rental"]);
    expect(r).not.toBeNull();
    expect(r!.optionalAddonsCents).toBe(7_500);
    expect(r!.totalCents).toBe(19_000);
    expect(r!.lineItems).toHaveLength(4);
    expect(r!.appliedOptionalAddonIds.sort()).toEqual(["ar15-ammunition-50-rounds", "ar15-rental"].sort());
  });

  it("scenario 5 — unknown add-on id: returns null (strict rejection)", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", ["unknown-bogus-addon"]);
    expect(r).toBeNull();
  });
});

// ── Shotgun Course — optional ammo ($35) and rental ($25) ─────────────────

describe("shotgun-course — optional add-ons (ammo and rental)", () => {
  const course = getCourseBySlug("shotgun-course");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it("base price is $75", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "shotgun-base");
    expect(opt!.price).toBe(75);
  });

  it("requiredFees contains only the range-fee ($25)", () => {
    const fees = course!.requiredFees ?? [];
    expect(fees).toHaveLength(1);
    const rangeFee = fees.find((f) => f.id === "range-fee");
    expect(rangeFee).toBeDefined();
    expect(rangeFee!.price).toBe(25);
    expect(rangeFee!.required).toBe(true);
    expect(rangeFee!.locked).toBe(true);
  });

  it("optionalAddOns contains shotgun-ammunition-50-rounds ($35) unchecked by default", () => {
    const addon = (course!.optionalAddOns ?? []).find((a) => a.id === "shotgun-ammunition-50-rounds");
    expect(addon).toBeDefined();
    expect(addon!.price).toBe(35);
    expect(addon!.required).toBe(false);
    expect(addon!.locked).toBe(false);
  });

  it("optionalAddOns contains shotgun-rental ($25) unchecked by default", () => {
    const addon = (course!.optionalAddOns ?? []).find((a) => a.id === "shotgun-rental");
    expect(addon).toBeDefined();
    expect(addon!.price).toBe(25);
    expect(addon!.required).toBe(false);
    expect(addon!.locked).toBe(false);
  });

  it("scenario 1 — no add-ons: 2 line items, totalCents = 10000 ($75 + $25)", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", []);
    expect(r).not.toBeNull();
    expect(r!.baseCents).toBe(7_500);
    expect(r!.requiredFeesCents).toBe(2_500);
    expect(r!.optionalAddonsCents).toBe(0);
    expect(r!.totalCents).toBe(10_000);
    expect(r!.lineItems).toHaveLength(2);
    expect(r!.lineItems.filter((li) => li.kind === "fee")).toHaveLength(1);
  });

  it("scenario 2 — ammo only: 3 line items, totalCents = 13500 ($75 + $25 + $35)", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", ["shotgun-ammunition-50-rounds"]);
    expect(r).not.toBeNull();
    expect(r!.optionalAddonsCents).toBe(3_500);
    expect(r!.totalCents).toBe(13_500);
    expect(r!.lineItems).toHaveLength(3);
    expect(r!.appliedOptionalAddonIds).toContain("shotgun-ammunition-50-rounds");
  });

  it("scenario 3 — rental only: 3 line items, totalCents = 12500 ($75 + $25 + $25)", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", ["shotgun-rental"]);
    expect(r).not.toBeNull();
    expect(r!.optionalAddonsCents).toBe(2_500);
    expect(r!.totalCents).toBe(12_500);
    expect(r!.lineItems).toHaveLength(3);
    expect(r!.appliedOptionalAddonIds).toContain("shotgun-rental");
  });

  it("scenario 4 — both add-ons: 4 line items, totalCents = 16000 ($75 + $25 + $35 + $25)", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", ["shotgun-ammunition-50-rounds", "shotgun-rental"]);
    expect(r).not.toBeNull();
    expect(r!.optionalAddonsCents).toBe(6_000);
    expect(r!.totalCents).toBe(16_000);
    expect(r!.lineItems).toHaveLength(4);
    expect(r!.appliedOptionalAddonIds.sort()).toEqual(["shotgun-ammunition-50-rounds", "shotgun-rental"].sort());
  });

  it("scenario 5 — unknown add-on id: returns null (strict rejection)", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", ["unknown-bogus-addon"]);
    expect(r).toBeNull();
  });
});
