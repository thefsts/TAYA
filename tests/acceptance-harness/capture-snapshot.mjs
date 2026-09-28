#!/usr/bin/env node
/**
 * PHASE-1 · E9 — capture-snapshot.mjs
 *
 * Refreshes the acceptance-harness fixture snapshot by running the REAL
 * discovery pipeline over the static fixture site and writing
 * `tests/fixtures/sample-site-snapshot/captured-snapshot.json`.
 *
 * The pipeline itself lives in TypeScript under convex/lib/discovery/* and is
 * exercised by `tests/convex-unit/src/acceptance-harness.test.ts`. Rather than
 * re-implement (and risk drifting from) that pipeline here, this script runs
 * the harness test in CAPTURE MODE (TAYA_CAPTURE_SNAPSHOT=1), which writes the
 * captured snapshot as a side effect. One source of truth, zero drift.
 *
 * Usage:
 *   node tests/acceptance-harness/capture-snapshot.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const CONVEX_UNIT = path.join(REPO_ROOT, "tests/convex-unit");
const CAPTURED = path.join(
  REPO_ROOT,
  "tests/fixtures/sample-site-snapshot/captured-snapshot.json",
);

const vitestBin = path.join(CONVEX_UNIT, "node_modules/.bin/vitest");
if (!existsSync(vitestBin)) {
  console.error(`[capture-snapshot] vitest not found at ${vitestBin}`);
  console.error("[capture-snapshot] run `pnpm install` in tests/convex-unit first.");
  process.exit(1);
}

console.log("[capture-snapshot] running acceptance harness in capture mode…");
const res = spawnSync(
  vitestBin,
  ["run", "src/acceptance-harness.test.ts"],
  {
    cwd: CONVEX_UNIT,
    env: { ...process.env, TAYA_CAPTURE_SNAPSHOT: "1" },
    stdio: "inherit",
  },
);

if (res.status !== 0) {
  console.error(`[capture-snapshot] harness failed (exit ${res.status}).`);
  process.exit(res.status ?? 1);
}

if (!existsSync(CAPTURED)) {
  console.error(`[capture-snapshot] expected ${CAPTURED} was not written.`);
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(CAPTURED, "utf8"));
console.log(
  `[capture-snapshot] wrote ${path.relative(REPO_ROOT, CAPTURED)} — ` +
    `${snapshot.pages.length} pages, ${snapshot.keyCount} keys.`,
);
for (const [page, zones] of Object.entries(snapshot.zonesByPage)) {
  console.log(`  ${page} → ${zones.join(", ")}`);
}
