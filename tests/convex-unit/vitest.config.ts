import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "convex/values": path.resolve(
        __dirname,
        "../../node_modules/convex/dist/esm/values/index.js"
      ),
    },
  },
});
