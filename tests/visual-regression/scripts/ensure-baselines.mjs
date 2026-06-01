/**
 * ensure-baselines.mjs
 *
 * Detects missing visual-regression baseline snapshots and auto-generates them
 * before the comparison run. This means a brand-new mockup never causes a red
 * build just because its snapshot doesn't exist yet.
 *
 * How it works:
 *  1. Reads mockup component names from the generated registry file.
 *  2. Checks the snapshots directory for existing PNG files.
 *  3. Builds a grep pattern covering every test whose baseline is absent.
 *  4. Runs `playwright test --update-snapshots --grep <pattern>` so only the
 *     missing baselines are (re)generated — existing snapshots are untouched.
 *
 * Exit codes: always 0 (failures here must not block the subsequent comparison
 * run from surfacing its own, more informative errors).
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SNAPSHOT_DIR = resolve(
  __dirname,
  "../snapshots/mockup.spec.ts-snapshots"
);

const MOCKUP_REGISTRY = resolve(
  __dirname,
  "../../../artifacts/mockup-sandbox/src/.generated/mockup-components.ts"
);

function discoverMockupNames() {
  if (!existsSync(MOCKUP_REGISTRY)) {
    console.warn(
      `[ensure-baselines] Registry not found: ${MOCKUP_REGISTRY}\n` +
        `  Skipping baseline check.`
    );
    return [];
  }
  const content = readFileSync(MOCKUP_REGISTRY, "utf8");
  const names = [];
  const regex = /"\.\/components\/mockups\/([^"]+)\.tsx"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function existingSnapshots() {
  if (!existsSync(SNAPSHOT_DIR)) return new Set();
  return new Set(readdirSync(SNAPSHOT_DIR));
}

function hasBaseline(name, snapshots) {
  return [...snapshots].some((f) => f.startsWith(`${name}-`));
}

function buildGrepPattern(missing) {
  return missing
    .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
}

const mockupNames = discoverMockupNames();
const snapshots = existingSnapshots();

const missing = [];

if (!hasBaseline("gallery", snapshots)) {
  missing.push("gallery root page");
}

for (const name of mockupNames) {
  if (!hasBaseline(name, snapshots)) {
    missing.push(`${name} mockup`);
  }
}

if (missing.length === 0) {
  console.log("[ensure-baselines] All baselines present — nothing to generate.");
  process.exit(0);
}

console.log(
  `[ensure-baselines] Generating ${missing.length} missing baseline(s):\n` +
    missing.map((m) => `  • ${m}`).join("\n")
);

const pattern = buildGrepPattern(missing);

try {
  execSync(`playwright test --update-snapshots --grep "${pattern}"`, {
    stdio: "inherit",
    cwd: resolve(__dirname, ".."),
    env: process.env,
  });
  console.log(
    `[ensure-baselines] Successfully generated ${missing.length} baseline(s).`
  );
} catch (err) {
  console.warn(
    `[ensure-baselines] Baseline generation exited with an error.\n` +
      `  The comparison run will follow and report missing snapshots properly.`
  );
}

process.exit(0);
