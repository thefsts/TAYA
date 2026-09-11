/**
 * bundle.mjs — builds the harness's late-bound REAL-code bundles.
 *
 *   dist/pipeline.mjs  — REAL convex/lib pipeline (annotatePage,
 *                        buildFrameDocument, renderBlockHtml/Zone, validateBlock,
 *                        zonesForPageKeys, generateBridgeSnippet, fetchPage,
 *                        crawlSite, extractPageModel, buildPageMap,
 *                        pageKeySegment) + the REAL test-site pages.
 *
 *   dist/store.mjs     — harness/store.ts bundled, with "./pipeline.mjs"
 *                        left EXTERNAL so it resolves to dist/pipeline.mjs
 *                        at runtime (single shared pipeline instance).
 *
 *   dist/parent.js     — the REAL VisualEditor.tsx driver page bundle
 *                        (built by bundle-parent.mjs; built here too when
 *                        its sources exist).
 */
import { createRequire } from "node:module";
import { build } from "/workspace/repo/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
void createRequire;

const here = dirname(fileURLToPath(import.meta.url));
const LIVE_UX = join(here, "..");
const REPO = join(LIVE_UX, "..", "..");
const outDir = join(LIVE_UX, "dist");

const common = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  logLevel: "warning",
  external: ["node:*"],
};

mkdirSync(outDir, { recursive: true });

/* ── 1 ─ REAL pipeline bundle ─────────────────────────────────────────── */
await build({
  ...common,
  entryPoints: [join(LIVE_UX, "harness/pipeline-entry.ts")],
  outfile: join(outDir, "pipeline.mjs"),
});

/* ── 2 ─ store bundle (./pipeline.mjs external) ──────────────────────── */
await build({
  ...common,
  entryPoints: [join(LIVE_UX, "harness/store.ts")],
  outfile: join(outDir, "store.mjs"),
  external: [...common.external, "./pipeline.mjs"],
});

console.log("[bundle] built dist/pipeline.mjs + dist/store.mjs");

/* ── 3 ── REAL VisualEditor parent bundle (dashboard's vite) ────────── */
{
  const { spawnSync } = await import("node:child_process");
  const viteBin = join(REPO, "artifacts", "fsts-dashboard", "node_modules", "vite", "bin", "vite.js");
  const cfg = join(REPO, "artifacts", "fsts-dashboard", "vite.liveux-parent.config.ts");
  const r = spawnSync(
    process.execPath,
    [viteBin, "build", "--config", cfg],
    { cwd: join(REPO, "artifacts", "fsts-dashboard"), stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.error("[bundle] parent vite build FAILED");
    process.exit(r.status ?? 1);
  }
  console.log("[bundle] built dist/parent.html + dist/parent.js");
}
