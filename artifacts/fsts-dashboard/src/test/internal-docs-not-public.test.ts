/**
 * internal-docs-not-public.test.ts
 *
 * L4 regression guard — launch hygiene closeout.
 *
 * The FSTS internal roadmap PDF must never be served from the
 * unauthenticated deployment surface. The Vercel deployment publishes
 * artifacts/fsts-dashboard/dist/public, which is built from public/, so
 * anything committed to public/ is publicly reachable without sign-in.
 *
 * Guards:
 *   1. public/ contains no PDF documents at all.
 *   2. The internal roadmap PDF is not in public/.
 *   3. No dashboard source file links to the roadmap PDF.
 *   4. scripts/generate-roadmap-pdf.mjs writes the PDF only to the
 *      repo-internal exports/roadmap/ directory (which is never deployed).
 *   5. scripts/post-merge.sh and scripts/smoke-test-roadmap-pdf.sh point
 *      at exports/roadmap/, so automated regeneration after merges can
 *      never reintroduce the PDF into public/.
 *
 * If this test fails, a change has (re)exposed an internal document on
 * the public surface. Move the file to exports/roadmap/ (repo-internal)
 * and update the generator scripts, or serve it through an
 * authenticated route instead. Do not simply delete this test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PUBLIC_DIR = "public";
const SRC_DIR = "src";
const FORBIDDEN_FILENAME = "fsts-dashboard-roadmap.pdf";
const INTERNAL_OUT_DIR = "exports/roadmap";
const GENERATOR = "../../scripts/generate-roadmap-pdf.mjs";
const POST_MERGE = "../../scripts/post-merge.sh";
const SMOKE_TEST = "../../scripts/smoke-test-roadmap-pdf.sh";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe("internal docs are never exposed on the public deployment surface", () => {
  it("public/ contains no PDF documents", () => {
    const files = readdirSync(PUBLIC_DIR);
    const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));
    expect(
      pdfs,
      `public/ must not contain PDFs (it deploys unauthenticated) — found: ${pdfs.join(", ")}`,
    ).toEqual([]);
  });

  it("the internal roadmap PDF is not in public/", () => {
    const files = readdirSync(PUBLIC_DIR);
    expect(files).not.toContain(FORBIDDEN_FILENAME);
  });

  it("no dashboard source file links to the internal roadmap PDF", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      // Test files never ship: Vite bundles only modules imported by app
      // code, so src/test/ is outside the deployed bundle. (This guard's
      // own file holds the forbidden filename as its assertion constant.)
      if (file.startsWith("src/test/")) continue;
      const src = readFileSync(file, "utf8");
      if (src.includes(FORBIDDEN_FILENAME)) offenders.push(file);
    }
    expect(
      offenders,
      `source files must not reference ${FORBIDDEN_FILENAME} — found in: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("the roadmap PDF generator writes only to the repo-internal exports/roadmap/ directory", () => {
    const src = readFileSync(GENERATOR, "utf8");
    expect(src).toContain(INTERNAL_OUT_DIR);
    expect(src).not.toContain('resolve(ROOT, "artifacts/fsts-dashboard/public")');
  });

  it("post-merge regeneration cannot reintroduce the PDF into public/", () => {
    const src = readFileSync(POST_MERGE, "utf8");
    expect(src).toContain(`${INTERNAL_OUT_DIR}/${FORBIDDEN_FILENAME}`);
    expect(src).not.toContain(`artifacts/fsts-dashboard/public/${FORBIDDEN_FILENAME}`);
  });

  it("the roadmap PDF smoke test checks the exports/roadmap/ location", () => {
    const src = readFileSync(SMOKE_TEST, "utf8");
    expect(src).toContain(`${INTERNAL_OUT_DIR}/${FORBIDDEN_FILENAME}`);
    expect(src).not.toContain(`artifacts/fsts-dashboard/public/${FORBIDDEN_FILENAME}`);
  });
});
