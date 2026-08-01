import { defineConfig } from "vitest/config";
import path from "path";

// Pricing contract tests import routes directly from corsair-source/src.
// The "@" alias must point there so route-level tests resolve without a build step.
export default defineConfig({
  resolve: {
    alias: {
      // Map @/ to corsair-source/src/ so route and lib imports resolve
      "@": path.resolve(__dirname, "../../corsair-source/src"),
      // Shim next/server so route files run in plain Node without a Next.js runtime
      "next/server": path.resolve(__dirname, "src/__mocks__/next-server.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
