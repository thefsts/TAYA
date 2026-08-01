import { defineConfig } from "vitest/config";
import path from "path";
import { existsSync } from "fs";

const CORSAIR_SRC = path.resolve(__dirname, "../../corsair-source/src");

// Tests that import Corsair route/lib modules directly via the "@" alias.
// These require a local clone of thefsts/Corsair-Tactical-Solutions at corsair-source/.
// When the clone is absent the files are excluded so the suite exits cleanly
// rather than crashing with module-resolution errors.
// To run the full 104-test suite:
//   git clone https://github.com/thefsts/Corsair-Tactical-Solutions.git corsair-source
const CORSAIR_DEPENDENT_TESTS = [
  "src/admin-email-group-label.test.ts",
  "src/checkout-integrity.test.ts",
  "src/group-registration-flag.test.ts",
  "src/group-registration-flag.integration.test.ts",
  "src/mid-size-group-regression.test.ts",
  "src/promo-discount-security.test.ts",
  "src/tuition-only-discount.test.ts",
  "src/vetspouse2-fixed-cents.test.ts",
];

const corsairAvailable = existsSync(path.join(CORSAIR_SRC, "lib/promo.ts"));

// Pricing contract tests import routes directly from corsair-source/src.
// The "@" alias must point there so route-level tests resolve without a build step.
export default defineConfig({
  resolve: {
    alias: {
      // Map @/ to corsair-source/src/ so route and lib imports resolve
      "@": CORSAIR_SRC,
      // Shim next/server so route files run in plain Node without a Next.js runtime
      "next/server": path.resolve(__dirname, "src/__mocks__/next-server.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // Exclude Corsair-dependent tests when corsair-source is not cloned locally.
    // This avoids module-resolution crashes in CI / clean checkouts while still
    // running the platform-pricing-contract tests that have no external dependency.
    exclude: corsairAvailable ? [] : CORSAIR_DEPENDENT_TESTS,
  },
});
