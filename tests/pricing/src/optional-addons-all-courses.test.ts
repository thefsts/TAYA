/**
 * Parameterized pricing guard — optional add-ons across all courses
 *
 * For every course that declares at least one optionalAddOn the tests verify:
 *   1. Selecting a single add-on raises totalCents by exactly that add-on's cost.
 *   2. Selecting all add-ons simultaneously produces the correct combined total.
 *   3. Passing an unknown add-on id never inflates the total.
 *   4. The add-on line items returned match the catalog prices exactly.
 *   5. appliedOptionalAddonIds reflects only recognised ids.
 *
 * Relevant source files:
 *   corsair-source/src/lib/courses.ts  — optionalAddOns on each course
 *   corsair-source/src/lib/pricing.ts  — resolveCoursePayment
 */

import { describe, it, expect } from "vitest";
import { getAllCourses } from "@/lib/courses";
import { resolveCoursePayment } from "@/lib/pricing";

// ── helpers ─────────────────────────────────────────────────────────────────

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// ── collect courses that have at least one optional add-on ───────────────────

const coursesWithAddOns = getAllCourses().filter(
  (c) => (c.optionalAddOns ?? []).length > 0
);

// ── 1. Sanity check ──────────────────────────────────────────────────────────

describe("optional add-ons catalog — sanity", () => {
  it("has at least one course with optional add-ons", () => {
    expect(coursesWithAddOns.length).toBeGreaterThan(0);
  });
});

// ── 2. Per-course parameterized suite ────────────────────────────────────────

describe("resolveCoursePayment — optional add-ons", () => {
  for (const course of coursesWithAddOns) {
    const addOns = course.optionalAddOns!;
    const firstOption = course.pricingOptions.find((o) => o.price > 0);

    if (!firstOption) {
      it(`${course.slug} — skipped: no payable pricing option found`, () => {
        expect(firstOption).toBeDefined();
      });
      continue;
    }

    const baselineCents =
      toCents(firstOption.price) +
      (course.requiredFees ?? []).reduce((s, f) => s + toCents(f.price), 0);

    describe(`${course.slug}`, () => {
      // ── 2a. Each add-on individually ───────────────────────────────────────
      for (const addOn of addOns) {
        const expectedAddonCents = toCents(addOn.price);
        const expectedTotal = baselineCents + expectedAddonCents;

        describe(`add-on "${addOn.id}" (${addOn.label} — $${addOn.price})`, () => {
          it(`optionalAddonsCents increases by exactly ${expectedAddonCents} cents`, () => {
            const result = resolveCoursePayment(
              course.slug,
              firstOption.id,
              [addOn.id]
            );
            expect(result).not.toBeNull();
            expect(result!.optionalAddonsCents).toBe(expectedAddonCents);
          });

          it(`totalCents = baseline ${baselineCents} + addon ${expectedAddonCents} = ${expectedTotal}`, () => {
            const result = resolveCoursePayment(
              course.slug,
              firstOption.id,
              [addOn.id]
            );
            expect(result!.totalCents).toBe(expectedTotal);
          });

          it("totalCents equals baseCents + requiredFeesCents + optionalAddonsCents", () => {
            const result = resolveCoursePayment(
              course.slug,
              firstOption.id,
              [addOn.id]
            );
            expect(result!.totalCents).toBe(
              result!.baseCents +
                result!.requiredFeesCents +
                result!.optionalAddonsCents
            );
          });

          it("appliedOptionalAddonIds contains exactly this add-on id", () => {
            const result = resolveCoursePayment(
              course.slug,
              firstOption.id,
              [addOn.id]
            );
            expect(result!.appliedOptionalAddonIds).toEqual([addOn.id]);
          });

          it("addon line item price matches catalog value", () => {
            const result = resolveCoursePayment(
              course.slug,
              firstOption.id,
              [addOn.id]
            );
            const li = result!.lineItems.find(
              (item) => item.kind === "addon" && item.id === addOn.id
            );
            expect(li).toBeDefined();
            expect(li!.priceCents).toBe(expectedAddonCents);
          });
        });
      }

      // ── 2b. All add-ons combined ───────────────────────────────────────────
      const allAddOnIds = addOns.map((a) => a.id);
      const allAddonsCents = addOns.reduce(
        (sum, a) => sum + toCents(a.price),
        0
      );
      const allCombinedTotal = baselineCents + allAddonsCents;

      describe("all add-ons selected simultaneously", () => {
        it(`optionalAddonsCents = sum of all add-on prices = ${allAddonsCents}`, () => {
          const result = resolveCoursePayment(
            course.slug,
            firstOption.id,
            allAddOnIds
          );
          expect(result).not.toBeNull();
          expect(result!.optionalAddonsCents).toBe(allAddonsCents);
        });

        it(`totalCents = ${allCombinedTotal} (baseline ${baselineCents} + all addons ${allAddonsCents})`, () => {
          const result = resolveCoursePayment(
            course.slug,
            firstOption.id,
            allAddOnIds
          );
          expect(result!.totalCents).toBe(allCombinedTotal);
        });

        it("totalCents equals baseCents + requiredFeesCents + optionalAddonsCents", () => {
          const result = resolveCoursePayment(
            course.slug,
            firstOption.id,
            allAddOnIds
          );
          expect(result!.totalCents).toBe(
            result!.baseCents +
              result!.requiredFeesCents +
              result!.optionalAddonsCents
          );
        });

        it("appliedOptionalAddonIds contains every declared add-on id", () => {
          const result = resolveCoursePayment(
            course.slug,
            firstOption.id,
            allAddOnIds
          );
          expect(result!.appliedOptionalAddonIds.sort()).toEqual(
            [...allAddOnIds].sort()
          );
        });

        it("line items contain one addon entry per add-on, each matching the catalog price", () => {
          const result = resolveCoursePayment(
            course.slug,
            firstOption.id,
            allAddOnIds
          );
          const addonItems = result!.lineItems.filter(
            (li) => li.kind === "addon"
          );
          expect(addonItems).toHaveLength(addOns.length);

          for (const addOn of addOns) {
            const li = addonItems.find((item) => item.id === addOn.id);
            expect(li).toBeDefined();
            expect(li!.priceCents).toBe(toCents(addOn.price));
          }
        });
      });

      // ── 2c. Unknown add-on ids never inflate the total ─────────────────────
      describe("unknown add-on id rejection", () => {
        it("passing only an unknown id: optionalAddonsCents stays 0 and total equals baseline", () => {
          const result = resolveCoursePayment(
            course.slug,
            firstOption.id,
            ["unknown-addon-that-does-not-exist"]
          );
          expect(result).not.toBeNull();
          expect(result!.optionalAddonsCents).toBe(0);
          expect(result!.totalCents).toBe(baselineCents);
          expect(result!.appliedOptionalAddonIds).toHaveLength(0);
          expect(
            result!.lineItems.filter((li) => li.kind === "addon")
          ).toHaveLength(0);
        });

        it("mixing valid and unknown ids: only valid ids are applied", () => {
          const firstAddOn = addOns[0];
          const result = resolveCoursePayment(
            course.slug,
            firstOption.id,
            [firstAddOn.id, "bogus-id-xyz-99999"]
          );
          expect(result!.optionalAddonsCents).toBe(toCents(firstAddOn.price));
          expect(result!.appliedOptionalAddonIds).toEqual([firstAddOn.id]);
          expect(result!.totalCents).toBe(
            baselineCents + toCents(firstAddOn.price)
          );
        });

        it("passing a non-array addOnIds: total equals baseline (no add-ons applied)", () => {
          const resultNull = resolveCoursePayment(
            course.slug,
            firstOption.id,
            null
          );
          const resultStr = resolveCoursePayment(
            course.slug,
            firstOption.id,
            "ammo-package"
          );
          const resultNum = resolveCoursePayment(
            course.slug,
            firstOption.id,
            42
          );
          for (const result of [resultNull, resultStr, resultNum]) {
            expect(result).not.toBeNull();
            expect(result!.optionalAddonsCents).toBe(0);
            expect(result!.totalCents).toBe(baselineCents);
          }
        });
      });
    });
  }
});
