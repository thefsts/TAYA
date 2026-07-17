/**
 * Pricing tests for the final approved course pricing update.
 *
 * Covers:
 *   - Texas LTC Shooting Proficiency ($75 base + $25 required range fee)
 *   - First Shots (no required range fee)
 *   - Introduction to Firearms ($50 individual option + $25 required range fee)
 *   - Continuing Education ($75 base, optional range fee included vs excluded)
 *   - AR-15 Rifle Course ($90 base + required: range $25, ammo $40, rental $35)
 *   - Shotgun Course ($75 base + required: range $25, ammo $35, rental $25)
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

// ── AR-15 Rifle Course — required: range $25, ammo $40, rental $35 ────────

describe("ar-15-rifle-course — required fees (no handgun add-ons)", () => {
  const course = getCourseBySlug("ar-15-rifle-course");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it("base price is $90", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "ar15-base");
    expect(opt!.price).toBe(90);
  });

  it("has range fee as required fee at $25", () => {
    const fee = (course!.requiredFees ?? []).find((f) => f.id === "range-fee");
    expect(fee).toBeDefined();
    expect(fee!.price).toBe(25);
    expect(fee!.required).toBe(true);
    expect(fee!.locked).toBe(true);
  });

  it("has ammo as required fee at $40", () => {
    const fee = (course!.requiredFees ?? []).find((f) => f.id === "ammo-package");
    expect(fee).toBeDefined();
    expect(fee!.price).toBe(40);
    expect(fee!.required).toBe(true);
    expect(fee!.locked).toBe(true);
  });

  it("has AR-15 rental as required fee at $35", () => {
    const fee = (course!.requiredFees ?? []).find((f) => f.id === "ar15-rental");
    expect(fee).toBeDefined();
    expect(fee!.price).toBe(35);
    expect(fee!.required).toBe(true);
    expect(fee!.locked).toBe(true);
  });

  it("has no optional add-ons (no handgun add-ons)", () => {
    expect((course!.optionalAddOns ?? []).length).toBe(0);
  });

  it("does not have handgun rental add-on (firearm-rental)", () => {
    const addon = (course!.optionalAddOns ?? []).find((a) => a.id === "firearm-rental");
    expect(addon).toBeUndefined();
  });

  it("resolveCoursePayment: requiredFeesCents = 10000 ($25 + $40 + $35)", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", []);
    expect(r!.requiredFeesCents).toBe(10_000);
  });

  it("resolveCoursePayment: totalCents = 19000 ($90 + $25 + $40 + $35)", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", []);
    expect(r!.baseCents).toBe(9_000);
    expect(r!.totalCents).toBe(19_000);
  });

  it("three required fee line items are present", () => {
    const r = resolveCoursePayment("ar-15-rifle-course", "ar15-base", []);
    const fees = r!.lineItems.filter((li) => li.kind === "fee");
    expect(fees).toHaveLength(3);
  });
});

// ── Shotgun Course — required: range $25, ammo $35, rental $25 ────────────

describe("shotgun-course — required fees (no handgun add-ons)", () => {
  const course = getCourseBySlug("shotgun-course");

  it("exists in the catalog", () => {
    expect(course).toBeDefined();
  });

  it("base price is $75", () => {
    const opt = course!.pricingOptions.find((o) => o.id === "shotgun-base");
    expect(opt!.price).toBe(75);
  });

  it("has range fee as required fee at $25", () => {
    const fee = (course!.requiredFees ?? []).find((f) => f.id === "range-fee");
    expect(fee).toBeDefined();
    expect(fee!.price).toBe(25);
    expect(fee!.required).toBe(true);
    expect(fee!.locked).toBe(true);
  });

  it("has ammo as required fee at $35", () => {
    const fee = (course!.requiredFees ?? []).find((f) => f.id === "ammo-package");
    expect(fee).toBeDefined();
    expect(fee!.price).toBe(35);
    expect(fee!.required).toBe(true);
    expect(fee!.locked).toBe(true);
  });

  it("has shotgun rental as required fee at $25", () => {
    const fee = (course!.requiredFees ?? []).find((f) => f.id === "shotgun-rental");
    expect(fee).toBeDefined();
    expect(fee!.price).toBe(25);
    expect(fee!.required).toBe(true);
    expect(fee!.locked).toBe(true);
  });

  it("has no optional add-ons (no handgun add-ons)", () => {
    expect((course!.optionalAddOns ?? []).length).toBe(0);
  });

  it("does not have handgun rental add-on (firearm-rental)", () => {
    const addon = (course!.optionalAddOns ?? []).find((a) => a.id === "firearm-rental");
    expect(addon).toBeUndefined();
  });

  it("resolveCoursePayment: requiredFeesCents = 8500 ($25 + $35 + $25)", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", []);
    expect(r!.requiredFeesCents).toBe(8_500);
  });

  it("resolveCoursePayment: totalCents = 16000 ($75 + $25 + $35 + $25)", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", []);
    expect(r!.baseCents).toBe(7_500);
    expect(r!.totalCents).toBe(16_000);
  });

  it("three required fee line items are present", () => {
    const r = resolveCoursePayment("shotgun-course", "shotgun-base", []);
    const fees = r!.lineItems.filter((li) => li.kind === "fee");
    expect(fees).toHaveLength(3);
  });
});
