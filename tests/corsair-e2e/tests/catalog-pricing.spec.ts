/**
 * Corsair Catalog Pricing — E2E contract test
 *
 * Verifies that the Corsair Tactical public API endpoint returns the seeded
 * courses with valid price and slug data. Targets the Convex HTTP API directly.
 *
 * The reference site is `corsair-tactical` (seeded via `convex/seedCorsair.ts`).
 * The seed currently defines exactly 6 published courses. If additional courses
 * are added to the seed, update EXPECTED_COURSE_COUNT below.
 *
 * Environment variables:
 *   VITE_CONVEX_URL     — Convex deployment URL (*.convex.cloud or *.convex.site)
 *   CORSAIR_SITE_SLUG   — Override the site slug (default: "corsair-tactical")
 *
 * The entire suite is unconditionally skipped when VITE_CONVEX_URL is absent or
 * resolves to an empty site URL — these tests require live Convex credentials.
 */

import { test, expect } from "@playwright/test";

const RAW_CONVEX_URL = process.env.VITE_CONVEX_URL ?? "";
// Convex HTTP actions are served from *.convex.site — swap the subdomain suffix.
const CONVEX_URL = RAW_CONVEX_URL.replace(/\.cloud$/, ".site");

const SITE_SLUG = process.env.CORSAIR_SITE_SLUG ?? "corsair-tactical";
const COURSES_ENDPOINT = `${CONVEX_URL}/api/public/courses?slug=${SITE_SLUG}`;

/**
 * Number of published courses in the corsair-tactical seed.
 * Matches `convex/seedCorsair.ts` → seedCorsairCourses (6 entries).
 */
const EXPECTED_COURSE_COUNT = 6;

// The actual seeded Corsair courses (slug + priceCents), per seedCorsair.ts.
// priceCents: null means the course intentionally has no price (contact/private).
const SEEDED_COURSES: { slug: string; priceCents: number | null }[] = [
  { slug: "texas-ltc-certification-basic-handgun", priceCents: 10000 },
  { slug: "level-2-security-training", priceCents: 6500 },
  { slug: "level-3-security-training", priceCents: 13000 },
  { slug: "level-4-ppo-training", priceCents: 22500 },
  { slug: "level-3-4-security-bundle", priceCents: 40000 },
  { slug: "basic-handgun-private-instruction", priceCents: null },
];

// ── Skip guard ────────────────────────────────────────────────────────────────

/**
 * Returns true when the Convex URL is present and looks like a real deployment.
 * Tests must call `skipIfNoApi()` to opt in to the guard.
 */
function apiIsAvailable(): boolean {
  return !!(CONVEX_URL && CONVEX_URL !== ".site" && CONVEX_URL.startsWith("http"));
}

function skipIfNoApi() {
  if (!apiIsAvailable()) {
    test.skip(true, "VITE_CONVEX_URL is not configured — skipping Corsair catalog E2E. " +
      "Set VITE_CONVEX_URL to the Convex deployment URL to run these tests.");
  }
}

// ── Courses API ───────────────────────────────────────────────────────────────

test.describe("Corsair public API — /api/public/courses", () => {
  test("endpoint returns 200 and a JSON array", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test(`returns exactly ${EXPECTED_COURSE_COUNT} published active courses`, async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    const body = await response.json() as any[];
    expect(body.length).toBe(EXPECTED_COURSE_COUNT);
  });

  test("every course has a non-empty slug", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    const body = await response.json() as any[];

    for (const course of body) {
      expect(typeof course.slug).toBe("string");
      expect(course.slug.trim().length).toBeGreaterThan(0);
    }
  });

  test("every course has a priceCents that is a finite number or null", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    const body = await response.json() as any[];

    const invalidPrices: { slug: string; priceCents: unknown }[] = [];

    for (const course of body) {
      const pc = course.priceCents;
      if (pc !== null && pc !== undefined) {
        if (typeof pc !== "number" || !isFinite(pc) || isNaN(pc)) {
          invalidPrices.push({ slug: course.slug, priceCents: pc });
        }
      }
    }

    expect(invalidPrices).toHaveLength(0);
  });

  test("no course has a slug or title that is literally 'undefined' or 'null'", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    const body = await response.json() as any[];

    for (const course of body) {
      expect(course.slug).not.toBe("undefined");
      expect(course.slug).not.toBe("null");
      expect(course.title).not.toBe("undefined");
      expect(course.title).not.toBe("null");
    }
  });

  test("no cancelled, archived, or completed courses appear in the public feed", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    const body = await response.json() as any[];

    for (const course of body) {
      expect(course.lifecycleStatus).not.toBe("Cancelled");
      expect(course.lifecycleStatus).not.toBe("Archived");
      expect(course.lifecycleStatus).not.toBe("Completed");
    }
  });

  test("all known Corsair course slugs are present and their prices match the seed", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    const body = await response.json() as any[];

    const returnedBySlugs = new Map(body.map((c: any) => [c.slug, c]));

    for (const expected of SEEDED_COURSES) {
      const course = returnedBySlugs.get(expected.slug);
      expect(course, `Course with slug '${expected.slug}' was not returned by the API`).toBeDefined();

      if (expected.priceCents !== null) {
        expect(course.priceCents).toBe(expected.priceCents);
      } else {
        // Contact-for-pricing: API must return null (never NaN/undefined/string)
        expect(course.priceCents == null).toBe(true);
      }
    }
  });

  test("all courses with a non-null priceCents format to a valid currency string", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(COURSES_ENDPOINT);
    const body = await response.json() as any[];

    for (const course of body) {
      const pc = course.priceCents as number | null;
      if (pc == null) continue;

      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(pc / 100);

      expect(formatted).not.toContain("NaN");
      expect(formatted).not.toContain("Infinity");
      expect(formatted).toMatch(/^\$/);
    }
  });
});

// ── Events API — basic lifecycle checks ───────────────────────────────────────

test.describe("Corsair public API — /api/public/events lifecycle sanity", () => {
  const EVENTS_ENDPOINT = `${CONVEX_URL}/api/public/events?slug=${SITE_SLUG}`;

  test("events endpoint returns 200 and an array", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(EVENTS_ENDPOINT);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("no cancelled or past events appear in the default events feed", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(EVENTS_ENDPOINT);
    const body = await response.json() as any[];

    for (const ev of body) {
      expect(ev.lifecycleStatus).not.toBe("Cancelled");
      expect(ev.lifecycleStatus).not.toBe("Completed");
      expect(ev.lifecycleStatus).not.toBe("Archived");
    }
  });

  test("every event has a valid priceCents (number | null, not NaN)", async ({ request }) => {
    skipIfNoApi();

    const response = await request.get(EVENTS_ENDPOINT);
    const body = await response.json() as any[];

    for (const ev of body) {
      const pc = ev.priceCents;
      if (pc !== null && pc !== undefined) {
        expect(typeof pc).toBe("number");
        expect(isFinite(pc)).toBe(true);
        expect(isNaN(pc)).toBe(false);
      }
    }
  });
});
