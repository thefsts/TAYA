import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "convex/server": path.resolve(__dirname, "../../convex/_generated/server.js"),
      "convex/values": path.resolve(__dirname, "../../node_modules/convex/dist/cjs-types/values/index.js"),
    },
  },
});
