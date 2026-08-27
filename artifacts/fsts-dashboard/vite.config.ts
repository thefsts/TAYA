import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// On Vercel, `vite build` runs without PORT/BASE_PATH (those only matter for
// the Replit dev/preview server) and the app is served from the domain root.
const isVercelBuild = process.env.VERCEL === "1";
const isProduction = process.env.NODE_ENV === "production";

const rawPort = process.env.PORT ?? (isVercelBuild ? "0" : undefined);

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port < 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? (isVercelBuild ? "/" : undefined);

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    // Runtime error overlays are useful during development but should never be
    // shipped in the production client bundle, where they can expose internal
    // implementation details to end users.
    ...(!isProduction ? [runtimeErrorOverlay()] : []),
    ...(!isProduction &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      "@convex": path.resolve(import.meta.dirname, "..", "..", "convex"),
      // Point directly at TS source so Vite transpiles it natively.
      // Avoids CJS dist static-analysis failures in Rollup.
      "@workspace/embed-widget": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "lib",
        "embed-widget",
        "src",
        "index.ts",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Browser-delivered JavaScript can always be inspected, but production
    // source maps unnecessarily expose original source structure and names.
    sourcemap: false,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      allow: [
        path.resolve(import.meta.dirname),
        path.resolve(import.meta.dirname, "..", "..", "convex"),
        path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
        path.resolve(import.meta.dirname, "..", "..", "lib", "embed-widget", "src"),
      ],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
