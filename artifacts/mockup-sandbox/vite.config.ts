import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const isServe = process.env.VITE_IS_SERVE === "true" || !!process.env.VITE_SSR;

// PORT and BASE_PATH are only required for the dev/preview server.
// The static `vite build` command does not need them — providing defaults
// so the recursive monorepo build (pnpm -r run build) does not fail.
const rawPort = process.env.PORT ?? "5174";
const basePath = process.env.BASE_PATH ?? "/";

if (isServe) {
  if (!process.env.PORT) {
    throw new Error(
      "PORT environment variable is required for dev/preview but was not provided.",
    );
  }
  if (!process.env.BASE_PATH) {
    throw new Error(
      "BASE_PATH environment variable is required for dev/preview but was not provided.",
    );
  }
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

export default defineConfig({
  base: basePath,
  plugins: [mockupPreviewPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
