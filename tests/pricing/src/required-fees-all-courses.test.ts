/**
 * Parameterized pricing guard — all courses with required fees
 *
 * Every course that declares at least one requiredFee is iterated here.
 * For each course the test verifies, without any add-ons selected:
 *   totalCents === baseCents + requiredFeesCents
 *
 * A separate suite flags any course whose pricingOptions array is empty
 * and that is not explicitly marked contactOnly or externalCourse — such
 * courses would silently become contactOnly in the catalog (resolveCoursePayment
 * returns null) and customers could not book them at all.
 *
 * Relevant source files:
 *   corsair-source/src/lib/courses.ts   — course catalog
 *   corsair-source/src/lib/pricing.ts   — resolveCoursePayment
 */

import { describe, it, expect } from "vitest";
import { getAllCourses } from "@/lib/courses";
import { resolveCoursePayment } from "@/lib/pricing";

// ── helpers ────────────────────────────────────────────────────────────────

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// ── 1. Parameterized total-cents guard ────────────────────────────────────

const coursesWithRequiredFees = getAllCourses().filter(
  (c) => (c.requiredFees ?? []).length > 0
);

describe("resolveCoursePayment — all courses with required fees (no add-ons)", () => {
  it("has at least one course with required fees (sanity check)", () => {
    expect(coursesWithRequiredFees.length).toBeGreaterThan(0);
  });

  for (const course of coursesWithRequiredFees) {
    // Use the first payable pricing option (price > 0)
    const firstOption = course.pricingOptions.find((o) => o.price > 0);

    if (!firstOption) {
      // Guard: a course with required fees but no payable option is itself a bug
      it(`${course.slug} — has a payable pricing option alongside its required fees`, () => {
        expect(firstOption).toBeDefined();
      });
      continue;
    }

    const expectedBaseCents = toCents(firstOption.price);
    const expectedRequiredFeesCents = (course.requiredFees ?? []).reduce(
      (sum, f) => sum + toCents(f.price),
      0
    );
    const expectedTotalCents = expectedBaseCents + expectedRequiredFeesCents;

    describe(`${course.slug}`, () => {
      it(`resolveCoursePayment returns non-null for option "${firstOption.id}"`, () => {
        const result = resolveCoursePayment(course.slug, firstOption.id, []);
        expect(result).not.toBeNull();
      });

      it(`baseCents = ${expectedBaseCents} (option price $${firstOption.price})`, () => {
        const result = resolveCoursePayment(course.slug, firstOption.id, []);
        expect(result!.baseCents).toBe(expectedBaseCents);
      });

      it(`requiredFeesCents = ${expectedRequiredFeesCents} (sum of all required fees)`, () => {
        const result = resolveCoursePayment(course.slug, firstOption.id, []);
        expect(result!.requiredFeesCents).toBe(expectedRequiredFeesCents);
      });

      it(`totalCents = baseCents + requiredFeesCents = ${expectedTotalCents} with no add-ons`, () => {
        const result = resolveCoursePayment(course.slug, firstOption.id, []);
        expect(result!.totalCents).toBe(result!.baseCents + result!.requiredFeesCents);
        expect(result!.totalCents).toBe(expectedTotalCents);
      });

      it("no optional add-on costs are included when addOnIds is empty", () => {
        const result = resolveCoursePayment(course.slug, firstOption.id, []);
        expect(result!.optionalAddonsCents).toBe(0);
        expect(result!.appliedOptionalAddonIds).toHaveLength(0);
      });

      it("line items contain exactly one 'course' entry and one 'fee' entry per required fee", () => {
        const result = resolveCoursePayment(course.slug, firstOption.id, []);
        const courseItems = result!.lineItems.filter((li) => li.kind === "course");
        const feeItems = result!.lineItems.filter((li) => li.kind === "fee");
        const addonItems = result!.lineItems.filter((li) => li.kind === "addon");

        expect(courseItems).toHaveLength(1);
        expect(feeItems).toHaveLength((course.requiredFees ?? []).length);
        expect(addonItems).toHaveLength(0);
      });

      it("fee line-item cents match the course catalog values", () => {
        const result = resolveCoursePayment(course.slug, firstOption.id, []);
        const feeItems = result!.lineItems.filter((li) => li.kind === "fee");

        for (const catalogFee of course.requiredFees ?? []) {
          const li = feeItems.find((f) => f.id === catalogFee.id);
          expect(li).toBeDefined();
          expect(li!.priceCents).toBe(toCents(catalogFee.price));
        }
      });
    });
  }
});

// ── 2. Empty-pricingOptions guard ─────────────────────────────────────────
//
// A course whose pricingOptions array is empty will be treated as contactOnly
// by the catalog builder (courseToCatalogItem) even if contactOnly: true is not
// set. This is intentional for externalCourse entries (they redirect to a
// third-party URL) but is almost certainly a data-entry mistake for any other
// course.

describe("course catalog — pricingOptions completeness guard", () => {
  const unexpectedlyEmpty = getAllCourses().filter((c) => {
    const hasNoPricingOptions = (c.pricingOptions ?? []).length === 0;
    const isIntentionallyEmpty =
      c.contactOnly === true || c.externalCourse === true;
    return hasNoPricingOptions && !isIntentionallyEmpty;
  });

  it("no course has an empty pricingOptions array unless it is contactOnly or externalCourse", () => {
    const slugs = unexpectedlyEmpty.map((c) => c.slug);
    expect(slugs).toEqual(
      [],
      `The following courses have empty pricingOptions but are not marked contactOnly or externalCourse: ${slugs.join(", ") || "none"}. They will silently become contact-only and customers will not be able to book them.`
    );
  });

  it("all courses with required fees also have at least one payable pricing option (price > 0)", () => {
    const broken = coursesWithRequiredFees.filter(
      (c) => !c.pricingOptions.some((o) => o.price > 0)
    );
    const slugs = broken.map((c) => c.slug);
    expect(slugs).toEqual(
      [],
      `The following courses have required fees but no payable pricing option: ${slugs.join(", ") || "none"}. resolveCoursePayment will return null for them — customers cannot be charged.`
    );
  });
});
