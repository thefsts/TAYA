import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@convex": path.resolve(import.meta.dirname, "../../convex"),
      // stub embed-widget so MediaLibrary doesn't need to build it
      "@workspace/embed-widget": path.resolve(
        import.meta.dirname,
        "src/test/__stubs__/embed-widget.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
