import { defineConfig } from "vitest/config";

// Pricing contract tests use only inline mock data.
// No alias to corsair-source/ or any external client repo.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
