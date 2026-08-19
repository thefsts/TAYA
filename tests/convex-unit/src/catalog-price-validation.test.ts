import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extractSeedCourses,
  validatePublishedCoursePricing,
} from "../../../scripts/src/validate-catalog";

describe("catalog price validation", () => {
  it("accepts positive-priced, contact-only, and external published courses", () => {
    expect(
      validatePublishedCoursePricing([
        { slug: "paid", status: "published", priceCents: 7500 },
        { slug: "contact", status: "published", priceCents: null, contactOnly: true },
        { slug: "external", isPublished: true, externalCourse: true },
      ]),
    ).toEqual([]);
  });

  it("rejects published courses with missing, zero, null, negative, or non-finite prices", () => {
    const failures = validatePublishedCoursePricing([
      { slug: "missing", status: "published" },
      { slug: "zero", status: "published", priceCents: 0 },
      { slug: "null", status: "published", priceCents: null },
      { slug: "negative", status: "published", priceCents: -1 },
      { slug: "not-finite", status: "published", priceCents: Number.NaN },
    ]);

    expect(failures).toHaveLength(5);
    expect(failures.join("\n")).toContain('"missing"');
    expect(failures.join("\n")).toContain('"zero"');
    expect(failures.join("\n")).toContain('"null"');
    expect(failures.join("\n")).toContain('"negative"');
    expect(failures.join("\n")).toContain('"not-finite"');
  });

  it("accepts the actual Corsair seed and keeps non-lethal defense explicitly contact-only", () => {
    const seedFile = fileURLToPath(new URL("../../../convex/seedCorsair.ts", import.meta.url));
    const courses = extractSeedCourses(fs.readFileSync(seedFile, "utf8"), seedFile);
    const nonLethal = courses.find((course) => course.slug === "non-lethal-defense-training");
    const privateInstruction = courses.find(
      (course) => course.slug === "basic-handgun-private-instruction",
    );

    expect(validatePublishedCoursePricing(courses)).toEqual([]);
    expect(nonLethal).toMatchObject({ contactOnly: true, priceCents: null });
    expect(privateInstruction).toMatchObject({ contactOnly: true, priceCents: null });
  });
});
