/**
 * Live-UX parent-bundle build config.
 *
 * Runs with the DASHBOARD's vite + react + @tailwindcss/vite (same versions
 * the production dashboard ships) but builds the harness driver page that
 * mounts the REAL VisualEditor component. Output: tests/live-ux/dist/
 *   - parent.html  (mount page)
 *   - parent.js    (single-file bundle, ES module)
 *
 * The convex surface is shimmed:
 *   - convex/react                     -> harness/shims/convex-react.tsx
 *   - @convex/_generated/api           -> harness/shims/api-shim.ts
 *   - @convex/_generated/dataModel     -> harness/shims/dataModel-shim.ts
 * so the REAL component source is exercised end-to-end against the harness
 * dispatcher (/harness/api -> REAL pipeline functions -> REAL store).
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const dashDir = path.join(repoRoot, "artifacts", "fsts-dashboard");
const harnessDir = path.join(repoRoot, "tests", "live-ux", "harness");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_CONVEX_URL": JSON.stringify("https://127.0.0.1:7788"),
    "import.meta.env.VITE_CLERK_PROXY_URL": "undefined",
  },
  resolve: {
    alias: {
      // shim overrides FIRST (vite resolves aliases in order)
      "convex/react": path.join(harnessDir, "shims", "convex-react.tsx"),
      "@convex/_generated/api": path.join(harnessDir, "shims", "api-shim.ts"),
      "@convex/_generated/dataModel": path.join(harnessDir, "shims", "dataModel-shim.ts"),
      "@": path.join(dashDir, "src"),
      "@assets": path.join(repoRoot, "attached_assets"),
      "@convex": path.join(repoRoot, "convex"),
      "@workspace/embed-widget": path.join(repoRoot, "lib", "embed-widget", "src", "index.ts"),
      "@workspace/web-bridge": path.join(repoRoot, "lib", "web-bridge", "src", "index.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.join(repoRoot, "artifacts", "fsts-dashboard", "harness-liveux"),
  base: "/",
  build: {
    outDir: path.join(repoRoot, "tests", "live-ux", "dist"),
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: path.join(repoRoot, "artifacts", "fsts-dashboard", "harness-liveux", "parent.html"),
      output: {
        entryFileNames: "parent.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        format: "es",
      },
    },
  },
});
