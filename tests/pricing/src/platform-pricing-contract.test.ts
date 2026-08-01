/**
 * Platform pricing contract — neutral fixture tests
 *
 * These tests verify the invariants that the FSTS-WOS™ platform expects any
 * client-provided pricing configuration to satisfy.  They use only inline
 * mock data; they do not import from any client website codebase.
 *
 * The contracts below define what "correct pricing" looks like regardless of
 * which client is onboarded.  When Corsair (or any other client) ships its own
 * pricing library, these invariants must hold for every course or service it
 * adds to its catalog.
 */

import { describe, it, expect } from "vitest";

// ── Type stubs (mirrors the shape used by client lib/pricing.ts) ─────────────

interface PricingOption {
  id: string;
  name: string;
  price: number; // USD dollars
}

interface RequiredFee {
  id: string;
  name: string;
  price: number; // USD dollars
}

interface OptionalAddOn {
  id: string;
  name: string;
  price: number; // USD dollars
}

interface CourseEntry {
  slug: string;
  price: string;         // display label e.g. "From $150"
  pricingOptions: PricingOption[];
  requiredFees?: RequiredFee[];
  optionalAddOns?: OptionalAddOn[];
  contactOnly?: boolean;
}

interface PaymentResolution {
  baseCents: number;
  requiredFeesCents: number;
  optionalAddOnCents: number;
  totalCents: number;
  optionName: string;
}

// ── Neutral helper: resolveCoursePayment (inline implementation) ──────────────

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function resolveCoursePayment(
  course: CourseEntry,
  pricingOptionId: string,
  selectedAddOnIds: string[],
): PaymentResolution | null {
  if (course.contactOnly) return null;

  const option = course.pricingOptions.find((o) => o.id === pricingOptionId);
  if (!option || option.price <= 0) return null;

  const baseCents = toCents(option.price);
  const requiredFeesCents = (course.requiredFees ?? []).reduce(
    (sum, f) => sum + toCents(f.price),
    0,
  );
  const optionalAddOnCents = (course.optionalAddOns ?? [])
    .filter((a) => selectedAddOnIds.includes(a.id))
    .reduce((sum, a) => sum + toCents(a.price), 0);

  return {
    baseCents,
    requiredFeesCents,
    optionalAddOnCents,
    totalCents: baseCents + requiredFeesCents + optionalAddOnCents,
    optionName: option.name,
  };
}

// ── Neutral fixture catalog ──────────────────────────────────────────────────

const EXAMPLE_COURSES: CourseEntry[] = [
  {
    slug: "example-basic-course",
    price: "From $100",
    pricingOptions: [
      { id: "basic-standard", name: "Standard", price: 100 },
    ],
    requiredFees: [
      { id: "range-fee", name: "Range Fee", price: 25 },
    ],
  },
  {
    slug: "example-advanced-course",
    price: "From $200",
    pricingOptions: [
      { id: "adv-individual", name: "Individual", price: 200 },
      { id: "adv-group", name: "Group Rate", price: 175 },
    ],
    requiredFees: [
      { id: "range-fee", name: "Range Fee", price: 25 },
    ],
    optionalAddOns: [
      { id: "equipment-rental", name: "Equipment Rental", price: 40 },
      { id: "ammo-package", name: "Ammo Package", price: 30 },
    ],
  },
  {
    slug: "example-intro-course",
    price: "From $50",
    pricingOptions: [
      { id: "intro-group", name: "Group Session", price: 50 },
    ],
    // No required fees — range fee is an optional add-on here
    optionalAddOns: [
      { id: "range-fee-addon", name: "Range Fee (optional)", price: 25 },
    ],
  },
  {
    slug: "example-contact-only-service",
    price: "Contact for pricing",
    pricingOptions: [],
    contactOnly: true,
  },
];

// ── 1. Catalog structure invariants ──────────────────────────────────────────

describe("Catalog structure — every payable course", () => {
  const payableCourses = EXAMPLE_COURSES.filter((c) => !c.contactOnly);

  it("has at least one pricing option", () => {
    for (const course of payableCourses) {
      expect(
        course.pricingOptions.length,
        `${course.slug} must have at least one pricing option`,
      ).toBeGreaterThan(0);
    }
  });

  it("has a positive price on every option", () => {
    for (const course of payableCourses) {
      for (const opt of course.pricingOptions) {
        expect(
          opt.price,
          `${course.slug} / ${opt.id} must have price > 0`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("price display label starts with 'From $' or a dollar amount", () => {
    for (const course of payableCourses) {
      expect(
        course.price,
        `${course.slug} price label should contain a dollar amount`,
      ).toMatch(/\$\d+/);
    }
  });

  it("contact-only courses have no pricing options", () => {
    for (const course of EXAMPLE_COURSES.filter((c) => c.contactOnly)) {
      expect(course.pricingOptions.length).toBe(0);
    }
  });
});

// ── 2. resolveCoursePayment invariants ────────────────────────────────────────

describe("resolveCoursePayment — base + required fees (no add-ons)", () => {
  it("returns null for a contact-only course", () => {
    const contactCourse = EXAMPLE_COURSES.find((c) => c.contactOnly)!;
    const result = resolveCoursePayment(contactCourse, "any-option", []);
    expect(result).toBeNull();
  });

  it("returns null for an unknown pricingOptionId", () => {
    const course = EXAMPLE_COURSES[0];
    const result = resolveCoursePayment(course, "nonexistent-id", []);
    expect(result).toBeNull();
  });

  it("totalCents = baseCents + requiredFeesCents when no add-ons are selected", () => {
    const course = EXAMPLE_COURSES.find((c) => c.slug === "example-basic-course")!;
    const result = resolveCoursePayment(course, "basic-standard", []);
    expect(result).not.toBeNull();
    expect(result!.baseCents).toBe(10_000);
    expect(result!.requiredFeesCents).toBe(2_500);
    expect(result!.optionalAddOnCents).toBe(0);
    expect(result!.totalCents).toBe(12_500);
  });

  it("requiredFeesCents is 0 when course has no required fees", () => {
    const course = EXAMPLE_COURSES.find((c) => c.slug === "example-intro-course")!;
    const result = resolveCoursePayment(course, "intro-group", []);
    expect(result).not.toBeNull();
    expect(result!.requiredFeesCents).toBe(0);
    expect(result!.totalCents).toBe(result!.baseCents);
  });

  it("optionName matches the selected pricing option name", () => {
    const course = EXAMPLE_COURSES.find((c) => c.slug === "example-advanced-course")!;
    const result = resolveCoursePayment(course, "adv-individual", []);
    expect(result!.optionName).toBe("Individual");
  });
});

// ── 3. Optional add-on invariants ─────────────────────────────────────────────

describe("resolveCoursePayment — optional add-ons", () => {
  const course = EXAMPLE_COURSES.find((c) => c.slug === "example-advanced-course")!;
  const baseResult = resolveCoursePayment(course, "adv-individual", [])!;

  it("selecting no add-ons does not change optionalAddOnCents from 0", () => {
    expect(baseResult.optionalAddOnCents).toBe(0);
  });

  it("selecting one add-on adds its price in cents", () => {
    const result = resolveCoursePayment(course, "adv-individual", ["equipment-rental"]);
    expect(result!.optionalAddOnCents).toBe(4_000); // $40
    expect(result!.totalCents).toBe(baseResult.totalCents + 4_000);
  });

  it("selecting both add-ons adds both prices in cents", () => {
    const result = resolveCoursePayment(course, "adv-individual", [
      "equipment-rental",
      "ammo-package",
    ]);
    expect(result!.optionalAddOnCents).toBe(7_000); // $40 + $30
    expect(result!.totalCents).toBe(baseResult.totalCents + 7_000);
  });

  it("totalCents equals baseCents + requiredFeesCents + optionalAddOnCents (always)", () => {
    const addOnCombinations = [
      [],
      ["equipment-rental"],
      ["ammo-package"],
      ["equipment-rental", "ammo-package"],
    ];
    for (const combo of addOnCombinations) {
      const r = resolveCoursePayment(course, "adv-individual", combo)!;
      expect(r.totalCents, `combo ${JSON.stringify(combo)}`).toBe(
        r.baseCents + r.requiredFeesCents + r.optionalAddOnCents,
      );
    }
  });

  it("an unknown add-on ID is silently ignored (no $0-charge trap)", () => {
    const result = resolveCoursePayment(course, "adv-individual", [
      "equipment-rental",
      "completely-unknown-addon-xyz",
    ]);
    // Only equipment-rental ($40) should be counted
    expect(result!.optionalAddOnCents).toBe(4_000);
  });
});

// ── 4. cents-safe arithmetic (no floating-point rounding) ────────────────────

describe("toCents — safe integer conversion", () => {
  it("converts whole dollars exactly", () => {
    expect(toCents(150)).toBe(15_000);
    expect(toCents(75)).toBe(7_500);
    expect(toCents(25)).toBe(2_500);
  });

  it("rounds fractional cents instead of truncating", () => {
    // $0.005 rounds to 1 cent, not 0
    expect(toCents(0.005)).toBe(1);
    // $99.999 rounds to 10000, not 9999
    expect(toCents(99.999)).toBe(10_000);
  });

  it("handles zero", () => {
    expect(toCents(0)).toBe(0);
  });
});

// ── 5. Event courseSlug validation contract ───────────────────────────────────

/**
 * Events that are wired for online payment declare a courseSlug that must
 * resolve to a payable catalog entry.  An invalid slug must produce a clear
 * error, never silently charge $0.
 */

type SlugValidationResult =
  | { valid: true }
  | { valid: false; error: string };

function validateCourseSlug(
  slug: string,
  catalog: CourseEntry[],
): SlugValidationResult {
  const trimmed = slug.trim();
  if (!trimmed) return { valid: false, error: "courseSlug must not be empty" };

  const entry = catalog.find((c) => c.slug === trimmed);
  if (!entry) {
    return {
      valid: false,
      error: `courseSlug "${trimmed}" does not exist in the catalog`,
    };
  }
  if (entry.contactOnly || entry.pricingOptions.length === 0) {
    return {
      valid: false,
      error: `courseSlug "${trimmed}" is not a payable course (contact-only)`,
    };
  }
  return { valid: true };
}

describe("validateCourseSlug — event courseSlug contract", () => {
  const catalog = EXAMPLE_COURSES;

  it("returns valid:false for an empty slug", () => {
    const r = validateCourseSlug("", catalog);
    expect(r.valid).toBe(false);
    expect((r as { valid: false; error: string }).error.length).toBeGreaterThan(0);
  });

  it("returns valid:false for a whitespace-only slug", () => {
    const r = validateCourseSlug("   ", catalog);
    expect(r.valid).toBe(false);
  });

  it("returns valid:false for a slug that does not exist in the catalog", () => {
    const r = validateCourseSlug("nonexistent-course-xyz", catalog);
    expect(r.valid).toBe(false);
    const err = (r as { valid: false; error: string }).error;
    expect(err).toMatch(/does not exist/i);
    expect(err).toContain("nonexistent-course-xyz");
  });

  it("returns valid:false for a contact-only service slug", () => {
    const r = validateCourseSlug("example-contact-only-service", catalog);
    expect(r.valid).toBe(false);
    expect((r as { valid: false; error: string }).error).toMatch(/contact-only/i);
  });

  it("returns valid:true for a correctly wired payable course slug", () => {
    const r = validateCourseSlug("example-basic-course", catalog);
    expect(r.valid).toBe(true);
  });

  it("error is always a non-empty string for every invalid slug", () => {
    const badSlugs = ["", "   ", "nonexistent-xyz", "example-contact-only-service"];
    for (const slug of badSlugs) {
      const r = validateCourseSlug(slug, catalog);
      expect(r.valid, `slug "${slug}" should be invalid`).toBe(false);
      const err = (r as { valid: false; error: string }).error;
      expect(typeof err).toBe("string");
      expect(err.trim().length, `error for "${slug}" must be non-empty`).toBeGreaterThan(0);
    }
  });
});
