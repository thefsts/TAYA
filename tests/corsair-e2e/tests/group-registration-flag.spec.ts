/**
 * Group Registration Flag — End-to-End Integration Tests
 *
 * Verifies that the `isGroupRegistration` flag is correctly computed by the
 * BookingForm component based on attendee count, and that it reaches the
 * Next.js API routes with the right value.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  GROUP_THRESHOLD = 5  (BookingForm.tsx line 55)                        │
 * │  attendees >= 5  →  isGroupRegistration = true                         │
 * │  attendees <  5  →  isGroupRegistration = false                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * These browser-level E2E tests verify the BookingForm wiring:
 *   - the correct attendeeCount reaches POST /api/square/create-order
 *   - the correct isGroupRegistration flag reaches POST /api/square/create-payment
 *   - the group banner appears / disappears correctly as attendees are added
 *     or removed
 *
 * Server-side route logic (group_registration in Square order metadata) is
 * covered by unit tests in tests/pricing/src/group-registration-flag.test.ts,
 * which call the real route handler with a mocked outbound fetch.
 *
 * How the mock works
 * ──────────────────
 * 1. `page.addInitScript()` injects a fake `window.Square` before any React
 *    code runs, so `initCard()` succeeds without real Square credentials.
 * 2. `page.route()` intercepts both Square CDN script requests (belt-and-
 *    suspenders) and the Next.js API routes.
 * 3. Captured API request bodies are asserted for `attendeeCount` (create-
 *    order) and `isGroupRegistration` (create-payment).
 * 4. The mocked API responses let the form advance through the full flow
 *    without calling Square's production or sandbox endpoints.
 *
 * Relevant routes
 * ───────────────
 *   POST /api/square/create-order    – receives attendeeCount
 *   POST /api/square/create-payment  – receives isGroupRegistration
 *
 * These tests run against the Corsair dev server and are skipped gracefully
 * when CLIENT_E2E_BASE_URL is not reachable.
 */

import { test, expect, type Page } from "@playwright/test";

/* ── Constants ────────────────────────────────────────────────────────────── */

const COURSE_SLUG = "texas-ltc-certification-basic-handgun";
const COURSE_PAGE = `/en/courses/${COURSE_SLUG}`;

/**
 * BookingForm.tsx defines `GROUP_THRESHOLD = 5`.
 * Use values clearly on each side to test the flag, not the threshold itself.
 */
const ABOVE_THRESHOLD = 6; // isGroupRegistration expected: true
const BELOW_THRESHOLD = 4; // isGroupRegistration expected: false

/* ── Square SDK mock ──────────────────────────────────────────────────────── */

/**
 * Minimal `window.Square` stub injected via `addInitScript`.
 * Matches the interface the BookingForm expects: payments() → card() → attach/tokenize/destroy.
 */
const SQUARE_MOCK_INIT_SCRIPT = `
(function() {
  window.Square = {
    payments: function(_appId, _locationId) {
      return {
        card: function(_opts) {
          return Promise.resolve({
            attach: function(_selector) { return Promise.resolve(); },
            tokenize: function() {
              return Promise.resolve({ status: 'OK', token: 'cnon:card-nonce-ok' });
            },
            destroy: function() { return Promise.resolve(); }
          });
        }
      };
    }
  };
})();
`;

/* ── Fake API responses ───────────────────────────────────────────────────── */

/**
 * Build a fake create-order success body that mirrors the real route response,
 * including the `groupRegistration` field the route derives from
 * `attendeeCount >= GROUP_REGISTRATION_MIN_ATTENDEES` (10).
 *
 * Keeping the fake response consistent with the real shape lets the existing
 * form flow continue, and lets tests assert the flag without calling Square.
 */
function makeFakeOrderOk(attendeeCount: number): string {
  return JSON.stringify({
    success: true,
    orderId: "fake-order-id-0001",
    squareTotal: 12500,
    resolvedTotal: 12500,
    // 10 = GROUP_REGISTRATION_MIN_ATTENDEES (square.ts); mirrors route logic
    groupRegistration: attendeeCount >= 10,
  });
}

const FAKE_PAYMENT_OK = JSON.stringify({
  success: true,
  paymentId: "fake-payment-id-0001",
  squareOrderId: "fake-order-id-0001",
  receiptUrl: null,
  courseName: "Texas LTC Certification + Basic Handgun",
  totalCents: 12500,
  lineItems: [
    { kind: "tuition", name: "LTC + Basic Handgun Combo", priceCents: 10000, quantity: 1 },
    { kind: "fee", name: "Range Fee", priceCents: 2500, quantity: 1 },
  ],
  registrationId: "reg-fake-0001",
});

/* ── Server guard ─────────────────────────────────────────────────────────── */

test.beforeAll(async ({ browser }) => {
  const baseURL = process.env.CLIENT_E2E_BASE_URL ?? "http://localhost:3000";
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
    process.env._GROUP_FLAG_SKIP = "1";
  }
});

function skipIfNoServer() {
  if (process.env._GROUP_FLAG_SKIP === "1") {
    test.skip(
      true,
      "No client website running at CLIENT_E2E_BASE_URL — skipping.",
    );
  }
}

/* ── Scenario runner ──────────────────────────────────────────────────────── */

interface ScenarioResult {
  /** Body the form sent to POST /api/square/create-order */
  orderReqBody: Record<string, unknown>;
  /** Body the form sent to POST /api/square/create-payment */
  paymentReqBody: Record<string, unknown>;
}

/**
 * Drives the full 3-step BookingForm with `attendeeCount` attendees.
 *
 * Both Square SDK calls and Next.js API routes are mocked, so this test
 * does not require Square credentials.  The function returns the raw
 * request bodies captured from the two API intercepts.
 */
async function runGroupScenario(
  page: Page,
  attendeeCount: number,
): Promise<ScenarioResult> {
  // ── 0. Set up mocks before any page code runs ──────────────────────────────
  await page.addInitScript(SQUARE_MOCK_INIT_SCRIPT);

  // Stub the Square CDN scripts so no real network request is attempted.
  await page.route("**/*.squarecdn.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "/* Square SDK mocked by test */",
    });
  });

  // Intercept create-order: capture body → return fake success.
  // The fake response mirrors the real route shape (including groupRegistration)
  // so the form flow can advance without real Square credentials.
  let orderReqBody: Record<string, unknown> = {};
  await page.route("**/api/square/create-order", async (route) => {
    try {
      orderReqBody = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
    } catch {
      orderReqBody = {};
    }
    const capturedCount =
      typeof orderReqBody.attendeeCount === "number"
        ? orderReqBody.attendeeCount
        : attendeeCount;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: makeFakeOrderOk(capturedCount),
    });
  });

  // Intercept create-payment: capture body → return fake success.
  let paymentReqBody: Record<string, unknown> = {};
  await page.route("**/api/square/create-payment", async (route) => {
    try {
      paymentReqBody = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
    } catch {
      paymentReqBody = {};
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: FAKE_PAYMENT_OK,
    });
  });

  // ── Step 1: Package selection & attendee setup ─────────────────────────────
  await page.goto(COURSE_PAGE);
  await page.waitForLoadState("networkidle");

  // Select the first pricing option (radio or clickable card).
  // The LTC course exposes at least one pricing option in step 1.
  const radioOptions = page.locator('input[type="radio"]');
  const radioCount = await radioOptions.count();
  if (radioCount > 0) {
    // Use the first radio that isn't a "purchaser attends Yes/No" radio.
    // Those appear in step 2; in step 1 all radios are pricing options.
    await radioOptions.first().click();
  }

  // Add attendees beyond the one that exists by default.
  for (let i = 1; i < attendeeCount; i++) {
    // Two "Add Another Person" buttons exist (top + bottom duplicate).
    // .last() keeps the click in-viewport as the list grows.
    await page
      .getByRole("button", { name: /Add Another Person/i })
      .last()
      .click();
    // Brief pause so React re-renders the new card before the next click.
    await page.waitForTimeout(150);
  }

  // Confirm the attendee count label updated.
  await expect(
    page.getByText(new RegExp(`${attendeeCount}\\s+(?:person|people)`, "i")),
  ).toBeVisible({ timeout: 5_000 });

  // Fill every attendee's required fields (first name, last name, email, phone).
  // Placeholders are shared across all attendee cards, so use .nth(idx).
  for (let i = 0; i < attendeeCount; i++) {
    await page.getByPlaceholder("First").nth(i).fill(`Test${i}`);
    await page.getByPlaceholder("Last").nth(i).fill(`User${i}`);
    // Each attendee card has its own email + phone pair, ordered by card.
    await page.locator('input[type="email"]').nth(i).fill(`test${i}@example.com`);
    await page.locator('input[type="tel"]').nth(i).fill(`555000${1000 + i}`);
  }

  // Click the step 1 → step 2 Continue button.
  // It is NOT the "Continue to Payment" button (that's in step 2).
  await page
    .getByRole("button", { name: /^Continue(?! to Payment)/i })
    .click();
  await page.waitForTimeout(500); // allow step transition

  // ── Step 2: Purchaser details ──────────────────────────────────────────────
  // Purchaser ≠ attendee list.  "Yes" pre-fills attendee 0 from purchaser
  // data, but we already filled it above — choosing "No" keeps them separate.
  await page.getByRole("radio", { name: "No" }).click();

  await page.getByPlaceholder("First").fill("Jane");
  await page.getByPlaceholder("Last").fill("Buyer");
  // Use a unique placeholder to target purchaser-level email/phone.
  await page.locator('input[placeholder*="email"], input[type="email"]').first().fill("jane@example.com");
  await page.locator('input[type="tel"]').first().fill("5550009999");
  await page.getByPlaceholder("TX DL number").fill("TX99887766");

  // Age-confirmation checkbox — its <input> is visually hidden (.sr-only).
  // Click the wrapping <label> which covers it.
  const ageLabel = page
    .locator("label")
    .filter({ hasText: /18|age confirm/i })
    .first();
  await ageLabel.click();

  // Advance to step 3.
  await page
    .getByRole("button", { name: /Continue to Payment/i })
    .click();
  await page.waitForTimeout(500);

  // ── Step 3: Payment ────────────────────────────────────────────────────────
  // Give the step-3 useEffect time to run its Square init check before we
  // inspect any state.
  await page.waitForTimeout(800);

  // ── Square configuration guard ────────────────────────────────────────────
  // BookingForm renders "Payment system is not configured" and keeps the Pay
  // button permanently disabled when NEXT_PUBLIC_SQUARE_APPLICATION_ID or
  // NEXT_PUBLIC_SQUARE_LOCATION_ID were not compiled into the bundle.
  //
  // Two complementary signals detect this, in priority order:
  //
  //   1. data-square-ready="unconfigured" on the step-3 container div
  //      (added in BookingForm.tsx — most reliable, zero text-match fragility).
  //   2. Visible "Payment system is not configured" error text
  //      (defensive fallback that works even if the attribute is absent, e.g.
  //       against an older build of the dev server).
  //
  // Either signal causes an immediate, clearly-messaged skip rather than a
  // 12-second timeout waiting for a Pay button that can never become enabled.
  const SQUARE_SKIP_MSG =
    "Square env vars (NEXT_PUBLIC_SQUARE_APPLICATION_ID / " +
    "NEXT_PUBLIC_SQUARE_LOCATION_ID) were not compiled into the " +
    "Corsair dev-server bundle. Start the dev server with those vars " +
    "set to run this test (see tests/corsair-e2e/README.md).";

  // Signal 1 — data attribute (preferred)
  const step3Container = page.locator("[data-square-ready]");
  const squareReadyAttr = await step3Container
    .getAttribute("data-square-ready", { timeout: 3_000 })
    .catch(() => null);
  if (squareReadyAttr === "unconfigured") {
    test.skip(true, SQUARE_SKIP_MSG);
  }

  // Signal 2 — visible error text (defensive fallback)
  const notConfiguredError = page.getByText(
    /Payment system is not configured/i,
  );
  const isNotConfigured = await notConfiguredError
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (isNotConfigured) {
    test.skip(true, SQUARE_SKIP_MSG);
  }

  // The Square mock injected via addInitScript should have already been picked
  // up by the useEffect that runs on step === 3.  Wait for the Pay button to
  // become enabled (cardReady=true is set after card.attach() resolves).
  const payBtn = page.getByRole("button", { name: /Pay Securely/i });
  await expect(payBtn).toBeEnabled({ timeout: 12_000 });

  // Click Pay — triggers handlePayment → create-order → create-payment.
  await payBtn.click();

  // Wait for the create-payment intercept to fire (up to 15 s).
  await page
    .waitForResponse((r) => r.url().includes("/api/square/create-payment"), {
      timeout: 15_000,
    })
    .catch(() => {
      /* If navigation happened first the response may not be observable. */
    });

  return { orderReqBody, paymentReqBody };
}

/* ══ Test suite ═══════════════════════════════════════════════════════════════
 *
 * These browser-level tests verify BookingForm wiring only.  Server-side
 * group_registration metadata logic is unit-tested in:
 *   tests/pricing/src/group-registration-flag.test.ts
 *
 * Scenario A: 6 attendees (≥ GROUP_THRESHOLD 5)
 *   → attendeeCount=6 in create-order body
 *   → isGroupRegistration=true in create-payment body
 *
 * Scenario B: 4 attendees (< GROUP_THRESHOLD 5)
 *   → attendeeCount=4 in create-order body
 *   → isGroupRegistration=false in create-payment body
 *
 * Scenario C: add 6 then remove 2 (add-then-remove)
 *   → group banner appears at 6, disappears at 4
 *   → isGroupRegistration=false in final create-payment body
 * ══════════════════════════════════════════════════════════════════════════ */

test.describe("BookingForm → group_registration flag propagation", () => {
  // ── Scenario A: above client threshold ────────────────────────────────────
  test(
    `${ABOVE_THRESHOLD} attendees (≥ GROUP_THRESHOLD 5) → isGroupRegistration=true in API requests`,
    async ({ page }) => {
      skipIfNoServer();

      const { orderReqBody, paymentReqBody } =
        await runGroupScenario(page, ABOVE_THRESHOLD);

      // create-order must forward the full headcount so Square order totals
      // reflect per-seat pricing correctly.
      expect(orderReqBody.attendeeCount).toBe(ABOVE_THRESHOLD);

      // create-payment must include isGroupRegistration=true (client threshold crossed).
      // Server-side group_registration metadata coverage: tests/pricing/src/group-registration-flag.test.ts
      expect(paymentReqBody.isGroupRegistration).toBe(true);
      expect(paymentReqBody.attendeeCount).toBe(ABOVE_THRESHOLD);
    },
  );

  // ── Scenario B: below client threshold ────────────────────────────────────
  test(
    `${BELOW_THRESHOLD} attendees (< GROUP_THRESHOLD 5) → isGroupRegistration=false in API requests`,
    async ({ page }) => {
      skipIfNoServer();

      const { orderReqBody, paymentReqBody } =
        await runGroupScenario(page, BELOW_THRESHOLD);

      expect(orderReqBody.attendeeCount).toBe(BELOW_THRESHOLD);
      expect(paymentReqBody.isGroupRegistration).toBe(false);
      expect(paymentReqBody.attendeeCount).toBe(BELOW_THRESHOLD);
    },
  );

  // ── Scenario C: add 6 then remove 2 — banner must disappear and flag=false ─
  test(
    "group banner disappears and isGroupRegistration reverts to false after removing attendees below threshold",
    async ({ page }) => {
      skipIfNoServer();

      // ── 0. Set up mocks before any page code runs ────────────────────────
      await page.addInitScript(SQUARE_MOCK_INIT_SCRIPT);

      await page.route("**/*.squarecdn.com/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/javascript",
          body: "/* Square SDK mocked by test */",
        });
      });

      let orderReqBody: Record<string, unknown> = {};
      await page.route("**/api/square/create-order", async (route) => {
        try {
          orderReqBody = (await route.request().postDataJSON()) as Record<
            string,
            unknown
          >;
        } catch {
          orderReqBody = {};
        }
        const capturedCount =
          typeof orderReqBody.attendeeCount === "number"
            ? orderReqBody.attendeeCount
            : 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: makeFakeOrderOk(capturedCount),
        });
      });

      let paymentReqBody: Record<string, unknown> = {};
      await page.route("**/api/square/create-payment", async (route) => {
        try {
          paymentReqBody = (await route.request().postDataJSON()) as Record<
            string,
            unknown
          >;
        } catch {
          paymentReqBody = {};
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: FAKE_PAYMENT_OK,
        });
      });

      // ── Step 1a: Navigate and select pricing ─────────────────────────────
      await page.goto(COURSE_PAGE);
      await page.waitForLoadState("networkidle");

      const radioOptions = page.locator('input[type="radio"]');
      const radioCount = await radioOptions.count();
      if (radioCount > 0) {
        await radioOptions.first().click();
      }

      // ── Step 1b: Add 6 attendees total (1 default + 5 clicks) ───────────
      const startCount = ABOVE_THRESHOLD; // 6
      for (let i = 1; i < startCount; i++) {
        await page
          .getByRole("button", { name: /Add Another Person/i })
          .last()
          .click();
        await page.waitForTimeout(150);
      }

      // Confirm count reached 6.
      await expect(
        page.getByText(new RegExp(`${startCount}\\s+people`, "i")),
      ).toBeVisible({ timeout: 5_000 });

      // ── Step 1c: Verify the group banner is visible ──────────────────────
      // The banner renders: <p className="...">Group Registration</p>
      // when attendees.length >= GROUP_THRESHOLD (5).
      const groupBanner = page.getByText("Group Registration", { exact: true });
      await expect(groupBanner).toBeVisible({
        timeout: 3_000,
      });

      // ── Step 1d: Remove 2 attendees to drop below threshold ──────────────
      // The "Remove" button is shown for every attendee with idx > 0.
      // We click it twice, each time on the last visible Remove button so we
      // always remove from the bottom of the list (safest, avoids index shift
      // confusion mid-removal).
      const removeButtons = () =>
        page.getByRole("button", { name: /^Remove$/i });

      await removeButtons().last().click();
      await page.waitForTimeout(200);
      await removeButtons().last().click();
      await page.waitForTimeout(200);

      // Attendee count is now 4 (below GROUP_THRESHOLD).
      const finalCount = startCount - 2; // 4
      await expect(
        page.getByText(new RegExp(`${finalCount}\\s+(?:person|people)`, "i")),
      ).toBeVisible({ timeout: 5_000 });

      // ── Step 1e: Confirm the group banner is gone ────────────────────────
      // The banner element should no longer be in the DOM (or at minimum
      // not visible) once attendees.length drops below GROUP_THRESHOLD.
      await expect(groupBanner).not.toBeVisible({ timeout: 3_000 });

      // ── Step 1f: Fill the 4 remaining attendees' required fields ─────────
      for (let i = 0; i < finalCount; i++) {
        await page.getByPlaceholder("First").nth(i).fill(`Test${i}`);
        await page.getByPlaceholder("Last").nth(i).fill(`User${i}`);
        await page
          .locator('input[type="email"]')
          .nth(i)
          .fill(`test${i}@example.com`);
        await page
          .locator('input[type="tel"]')
          .nth(i)
          .fill(`555000${1000 + i}`);
      }

      // Continue to step 2.
      await page
        .getByRole("button", { name: /^Continue(?! to Payment)/i })
        .click();
      await page.waitForTimeout(500);

      // ── Step 2: Purchaser details ────────────────────────────────────────
      await page.getByRole("radio", { name: "No" }).click();

      await page.getByPlaceholder("First").fill("Jane");
      await page.getByPlaceholder("Last").fill("Buyer");
      await page
        .locator('input[placeholder*="email"], input[type="email"]')
        .first()
        .fill("jane@example.com");
      await page.locator('input[type="tel"]').first().fill("5550009999");
      await page.getByPlaceholder("TX DL number").fill("TX99887766");

      const ageLabel = page
        .locator("label")
        .filter({ hasText: /18|age confirm/i })
        .first();
      await ageLabel.click();

      await page
        .getByRole("button", { name: /Continue to Payment/i })
        .click();
      await page.waitForTimeout(500);

      // ── Step 3: Payment ──────────────────────────────────────────────────
      // Give the step-3 useEffect time to run its Square init check before we
      // inspect any state.
      await page.waitForTimeout(800);

      // Square configuration guard (mirrors the guard in runGroupScenario).
      // If NEXT_PUBLIC_SQUARE_APPLICATION_ID / NEXT_PUBLIC_SQUARE_LOCATION_ID
      // were not compiled into the bundle the Pay button will never enable.
      // Skip immediately with a clear message rather than timing out.
      const SQUARE_SKIP_MSG =
        "Square env vars (NEXT_PUBLIC_SQUARE_APPLICATION_ID / " +
        "NEXT_PUBLIC_SQUARE_LOCATION_ID) were not compiled into the " +
        "Corsair dev-server bundle. Start the dev server with those vars " +
        "set to run this test (see tests/corsair-e2e/README.md).";

      const step3Container = page.locator("[data-square-ready]");
      const squareReadyAttr = await step3Container
        .getAttribute("data-square-ready", { timeout: 3_000 })
        .catch(() => null);
      if (squareReadyAttr === "unconfigured") {
        test.skip(true, SQUARE_SKIP_MSG);
      }

      const notConfiguredError = page.getByText(
        /Payment system is not configured/i,
      );
      const isNotConfigured = await notConfiguredError
        .isVisible({ timeout: 1_000 })
        .catch(() => false);
      if (isNotConfigured) {
        test.skip(true, SQUARE_SKIP_MSG);
      }

      const payBtn = page.getByRole("button", { name: /Pay Securely/i });
      await expect(payBtn).toBeEnabled({ timeout: 12_000 });
      await payBtn.click();

      await page
        .waitForResponse(
          (r) => r.url().includes("/api/square/create-payment"),
          { timeout: 15_000 },
        )
        .catch(() => {});

      // ── Assertions ───────────────────────────────────────────────────────
      // The form was submitted with 4 attendees (below GROUP_THRESHOLD=5).
      // isGroupRegistration must be false even though the buyer previously
      // crossed the threshold.
      expect(orderReqBody.attendeeCount).toBe(finalCount);

      expect(paymentReqBody.isGroupRegistration).toBe(false);
      expect(paymentReqBody.attendeeCount).toBe(finalCount);
    },
  );
});

// Server-side group_registration metadata (Square order body assertions) is
// covered by unit tests that call the real route handler with a mocked fetch:
//   tests/pricing/src/group-registration-flag.test.ts
