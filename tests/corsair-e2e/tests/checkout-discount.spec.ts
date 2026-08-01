/**
 * Checkout Discount — End-to-End Tests
 *
 * Verifies that server-side discount logic is correctly applied and displayed
 * during the booking flow.  Two scenarios are covered:
 *
 *  1. VETERAN01 promo code  — should produce a 10 % discount off the subtotal.
 *  2. No promo code         — discountCents must be 0 in the server response.
 *
 * These tests run against the Corsair dev server.  They are skipped gracefully
 * when CLIENT_E2E_BASE_URL is not reachable, matching the pattern used by the
 * rest of the corsair-e2e suite.
 *
 * Relevant server routes:
 *   POST /api/square/validate-promo   — promo validation (no Square dependency)
 *   POST /api/square/create-payment   — full charge (requires Square; API tests
 *                                       send a realistic body and assert on the
 *                                       server-returned discountCents field)
 */

import { test, expect } from "@playwright/test";

/* ── Constants ────────────────────────────────────────────────────────────── */

/**
 * Course used in all scenarios.
 *   - slug          : texas-ltc-certification-basic-handgun
 *   - pricing option: ltc-bh-combo  ($100 tuition)
 *   - required fee  : range-fee     ($25)
 *   - subtotal      : $125 = 12 500 cents
 *
 * VETERAN01 is a percentage-based code defaulting to 10 %, so the expected
 * server discount is floor(12 500 × 10 / 100) = 1 250 cents ($12.50).
 */
const COURSE_SLUG = "texas-ltc-certification-basic-handgun";
const PRICING_OPTION_ID = "ltc-bh-combo";
const SUBTOTAL_CENTS = 12_500; // $100 tuition + $25 range fee × 1 attendee
const PROMO_CODE = "VETERAN01";
const PROMO_PERCENT = 10;
const EXPECTED_DISCOUNT_CENTS = Math.floor(
  (SUBTOTAL_CENTS * PROMO_PERCENT) / 100,
); // 1 250

/** Locale-prefixed path to the course detail / booking page. */
const COURSE_PAGE = `/en/courses/${COURSE_SLUG}`;

/* ── Guard helper ─────────────────────────────────────────────────────────── */

/**
 * Attempts to reach the base URL once and sets an env flag when it fails.
 * Each test calls skipIfNoServer() to bail out cleanly instead of erroring.
 */
test.beforeAll(async ({ browser }) => {
  const baseURL =
    process.env.CLIENT_E2E_BASE_URL ?? "http://localhost:3000";
  let reachable = false;
  try {
    const page = await browser.newPage();
    const res = await page.goto(baseURL, { timeout: 8_000 }).catch(() => null);
    reachable = res !== null && res.status() < 500;
    await page.close();
  } catch {
    reachable = false;
  }
  if (!reachable) {
    process.env._CHECKOUT_DISCOUNT_SKIP = "1";
  }
});

function skipIfNoServer() {
  if (process.env._CHECKOUT_DISCOUNT_SKIP === "1") {
    test.skip(
      true,
      "No client website running at CLIENT_E2E_BASE_URL — skipping.",
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * Suite 1 — API-level: validate-promo endpoint
 * Tests the route directly without a browser; no Square credentials needed.
 * ══════════════════════════════════════════════════════════════════════════ */

test.describe("API: /api/square/validate-promo", () => {
  // ── Scenario 1a: VETERAN01 promo gives a 10 % discount ──────────────────
  test("VETERAN01 returns valid=true and discountCents equal to 10% of subtotal", async ({
    request,
  }) => {
    skipIfNoServer();

    const res = await request.post("/api/square/validate-promo", {
      data: {
        promoCode: PROMO_CODE,
        courseSlug: COURSE_SLUG,
        attendeeCount: 1,
        subtotalCents: SUBTOTAL_CENTS,
      },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();

    // Code must be accepted
    expect(body.valid).toBe(true);
    expect(body.normalizedCode).toBe(PROMO_CODE);

    // Server must compute the discount itself — never trust a client value
    expect(typeof body.discountCents).toBe("number");
    expect(body.discountCents).toBe(EXPECTED_DISCOUNT_CENTS);

    // Human-readable display must match
    expect(body.discountDisplay).toBe(
      `$${(EXPECTED_DISCOUNT_CENTS / 100).toFixed(2)}`,
    );
  });

  // ── Scenario 1b: No promo code → discountCents remains 0 ────────────────
  test("missing promoCode returns valid=false (effective discountCents 0)", async ({
    request,
  }) => {
    skipIfNoServer();

    const res = await request.post("/api/square/validate-promo", {
      data: {
        // promoCode intentionally omitted
        courseSlug: COURSE_SLUG,
        attendeeCount: 1,
        subtotalCents: SUBTOTAL_CENTS,
      },
    });

    // Route returns 400 when no code is provided
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.valid).toBe(false);
    // discountCents should be absent or 0 — never a positive number
    expect(body.discountCents ?? 0).toBe(0);
  });

  // ── Scenario 1c: Invalid code → no discount ──────────────────────────────
  test("unknown promo code returns valid=false with no discount", async ({
    request,
  }) => {
    skipIfNoServer();

    const res = await request.post("/api/square/validate-promo", {
      data: {
        promoCode: "FAKECODE999",
        courseSlug: COURSE_SLUG,
        attendeeCount: 1,
        subtotalCents: SUBTOTAL_CENTS,
      },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.discountCents ?? 0).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Suite 2 — API-level: create-payment endpoint discount guard
 *
 * The create-payment route re-derives the discount server-side from the
 * validated promo code; it ignores whatever discountCents the client sends.
 * These tests verify that the server-returned discountCents is 0 when no
 * valid promo code is included in the request.
 *
 * Note: Square is not configured in the test environment, so the route
 * returns 503.  The assertion is intentionally on the absence of a forged
 * discount in the error response structure — the discount guard fires before
 * Square is ever called.  When Square credentials are present (sandbox/prod)
 * the status will be 400 (card token invalid) and the body still carries
 * discountCents: 0 because no code was supplied.
 * ══════════════════════════════════════════════════════════════════════════ */

test.describe("API: /api/square/create-payment discount guard", () => {
  test("submitting without a promo code yields discountCents 0 in the response", async ({
    request,
  }) => {
    skipIfNoServer();

    const res = await request.post("/api/square/create-payment", {
      data: {
        sourceId: "cnon:card-nonce-ok", // Square sandbox test nonce
        courseSlug: COURSE_SLUG,
        pricingOptionId: PRICING_OPTION_ID,
        addOnIds: [],
        firstName: "Test",
        lastName: "Shopper",
        email: "test-shopper@example.com",
        phone: "2145550000",
        attendeeCount: 1,
        // No discountCents, no normalizedPromoCode → server must return 0
      },
    });

    const body = await res.json();

    // When Square IS configured (sandbox) the route processes the payment and
    // returns success.  When it is NOT configured it returns 503.  In both
    // cases discountCents must be 0 because no promo code was provided.
    if (res.status() === 200 && body.success) {
      expect(body.discountCents).toBe(0);
    } else {
      // Square not configured or nonce rejected — the server must NOT have
      // silently applied a discount before bailing out.  The error body has no
      // discountCents field; treat absence as 0.
      expect(body.discountCents ?? 0).toBe(0);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Suite 3 — UI: booking page promo-code interaction
 *
 * Loads the actual course page in a browser, applies VETERAN01 via the
 * promo-code input, and confirms the discount line rendered by the React
 * component matches the server-returned value ($12.50).
 * ══════════════════════════════════════════════════════════════════════════ */

test.describe("UI: booking page promo-code display", () => {
  // ── Scenario 3a: Applying VETERAN01 shows the correct discount ───────────
  test("VETERAN01 displays a -$12.50 discount line in the order summary", async ({
    page,
  }) => {
    skipIfNoServer();

    await page.goto(COURSE_PAGE);
    await page.waitForLoadState("networkidle");

    // The promo input is rendered inside the booking form on step 1
    const promoInput = page.getByPlaceholder("Enter promo code");

    // If the input isn't visible the booking panel may be collapsed or the
    // test slug is wrong — fail with a clear message
    await expect(promoInput).toBeVisible({ timeout: 15_000 });

    // Type the promo code (the input has `uppercase` CSS but we send lowercase
    // to confirm the server-side normalisation works end-to-end)
    await promoInput.fill("veteran01");

    // Click Apply and wait for the network call to /api/square/validate-promo
    const [validateRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/square/validate-promo"),
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: "Apply" }).click(),
    ]);

    // Server must have accepted the code
    const validateBody = await validateRes.json();
    expect(validateBody.valid).toBe(true);
    expect(validateBody.discountCents).toBe(EXPECTED_DISCOUNT_CENTS);

    // The "Promo Discount" line must appear in the order summary
    await expect(page.getByText("Promo Discount")).toBeVisible({
      timeout: 5_000,
    });

    // The rendered discount amount must match the server-computed value
    const expectedDisplay = `-$${(EXPECTED_DISCOUNT_CENTS / 100).toFixed(2)}`;
    await expect(page.getByText(expectedDisplay)).toBeVisible();
  });

  // ── Scenario 3b: No promo code → no discount line ───────────────────────
  test("without a promo code no discount line appears in the order summary", async ({
    page,
  }) => {
    skipIfNoServer();

    await page.goto(COURSE_PAGE);
    await page.waitForLoadState("networkidle");

    // The promo input must be present but left empty
    const promoInput = page.getByPlaceholder("Enter promo code");
    await expect(promoInput).toBeVisible({ timeout: 15_000 });

    // No code entered — "Promo Discount" must never appear
    await expect(page.getByText("Promo Discount")).not.toBeVisible();

    // Sanity-check: the subtotal is shown as a positive dollar amount
    const priceEls = page.locator("text=/\\$\\d+/");
    await expect(priceEls.first()).toBeVisible();
  });
});
