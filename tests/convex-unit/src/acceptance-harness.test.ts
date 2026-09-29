// @vitest-environment node
/**
 * PHASE-1 · E9 — ACCEPTANCE HARNESS (end-to-end, offline).
 *
 * This is the "does the whole Phase-1 editor pipeline actually work on a real
 * site" acceptance test. It runs the REAL discovery pipeline against a static
 * 3-page fixture site (tests/fixtures/sample-site-snapshot) with `fetch`
 * stubbed — no network — and asserts the full chain:
 *
 *   fixture HTML  →  crawlSite()            (§4 route discovery + page models)
 *                 →  buildPageMap()          (§5 stable content map)
 *                 →  zonesForPageKeys()      (§6 safe insertion zones)
 *
 * It pins the empirically-verified zone resolutions for each page:
 *   /                 → hero, service-list, footer-content, + additive
 *   /about            → content, + additive
 *   /knowledge-center → content, faq-list, + additive
 * where the additive zones (video-section, cta-stack) are available on every
 * page the map knows (§6 ADDITIVE_ZONE_IDS).
 *
 * Determinism is pinned: crawling the same fixture twice yields an identical
 * content map and identical zone resolutions.
 *
 * CAPTURE MODE: when TAYA_CAPTURE_SNAPSHOT=1, the test also writes
 * `captured-snapshot.json` next to the fixture manifest (used by
 * tests/acceptance-harness/capture-snapshot.mjs to refresh the fixture).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { crawlSite } from "../../../convex/lib/discovery/crawl";
import { buildPageMap } from "../../../convex/lib/discovery/contentMap";
import { pageKeySegment } from "../../../convex/lib/discovery/html";
import { zonesForPageKeys } from "../../../convex/lib/editorZones";

// ── Fixture loading ────────────────────────────────────────────────────────

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(HERE, "../../fixtures/sample-site-snapshot");

interface FixtureManifest {
  name: string;
  domain: string;
  origin: string;
  pages: Array<{ path: string; file: string; label: string }>;
  routes: Array<{ path: string; source: string; label: string }>;
  expectedZones: Record<string, string[]>;
}

function loadManifest(): FixtureManifest {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, "manifest.json"), "utf8"));
}

function loadPageHtml(file: string): string {
  return readFileSync(path.join(FIXTURE_DIR, file), "utf8");
}

/** Stub fetch to serve ONLY the fixture pages (read-only GETs; else 404). */
function stubFixtureFetch(manifest: FixtureManifest): void {
  const pages: Record<string, string> = {};
  for (const p of manifest.pages) {
    const url = p.path === "/" ? manifest.origin : `${manifest.origin}${p.path}`;
    pages[url] = loadPageHtml(p.file);
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input);
      const body = pages[url];
      if (body !== undefined) {
        return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
      }
      return new Response(null, { status: 404 });
    }),
  );
}

/** Collect the content-map keys attributed to one page (longest-seg match). */
function keysForPage(
  entries: Record<string, unknown>,
  allPageSegs: string[],
  pagePath: string,
): string[] {
  const seg = pageKeySegment(pagePath);
  const out: string[] = [];
  for (const key of Object.keys(entries)) {
    // Longest matching page segment owns the key (mirrors buildPageMap).
    let owner: string | null = null;
    for (const s of allPageSegs) {
      if (key === s || key.startsWith(s + ".")) {
        if (owner === null || s.length > owner.length) owner = s;
      }
    }
    if (owner === seg) out.push(key);
  }
  return out;
}

let manifest: FixtureManifest;

beforeEach(() => {
  manifest = loadManifest();
  stubFixtureFetch(manifest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Acceptance: the full pipeline resolves the expected zones ───────────────

describe("E9 acceptance harness — fixture site end-to-end", () => {
  it("crawlSite discovers all three fixture pages", async () => {
    const result = await crawlSite(manifest.domain);
    expect(result.failureReason).toBeNull();
    expect(result.snapshot).toBeTruthy();
    const paths = (result.snapshot?.pages ?? [])
      .filter((p) => p.status === "fetched")
      .map((p) => p.path)
      .sort();
    expect(paths).toEqual(["/", "/about", "/knowledge-center"]);
  });

  it("buildPageMap folds a stable content map for the fixture", async () => {
    const result = await crawlSite(manifest.domain);
    const map = buildPageMap(result.snapshot!);
    expect(map.pages.map((p) => p.path).sort()).toEqual(["/", "/about", "/knowledge-center"]);
    // Home-first ordering is part of the §5 contract.
    expect(map.pages[0].path).toBe("/");
    expect(map.keyCount).toBeGreaterThan(0);
  });

  it("resolves the expected §6 insertion zones on every page", async () => {
    const result = await crawlSite(manifest.domain);
    const map = buildPageMap(result.snapshot!);
    const allSegs = map.pages.map((p) => pageKeySegment(p.path));

    for (const page of manifest.pages) {
      const keys = keysForPage(map.entries as Record<string, unknown>, allSegs, page.path);
      const zones = zonesForPageKeys(keys)
        .map((z) => z.zone)
        .sort();
      const expected = [...manifest.expectedZones[page.path]].sort();
      expect(zones, `zones for ${page.path}`).toEqual(expected);
    }
  });

  it("is deterministic — two crawls yield identical maps + zones", async () => {
    const a = await crawlSite(manifest.domain);
    const b = await crawlSite(manifest.domain);
    const mapA = buildPageMap(a.snapshot!);
    const mapB = buildPageMap(b.snapshot!);
    expect(mapB.entries).toEqual(mapA.entries);

    const allSegs = mapA.pages.map((p) => pageKeySegment(p.path));
    for (const page of manifest.pages) {
      const zA = zonesForPageKeys(keysForPage(mapA.entries as Record<string, unknown>, allSegs, page.path))
        .map((z) => z.zone)
        .sort();
      const zB = zonesForPageKeys(keysForPage(mapB.entries as Record<string, unknown>, allSegs, page.path))
        .map((z) => z.zone)
        .sort();
      expect(zB).toEqual(zA);
    }
  });

  it("additive zones (video-section, cta-stack) are available on every page", async () => {
    const result = await crawlSite(manifest.domain);
    const map = buildPageMap(result.snapshot!);
    const allSegs = map.pages.map((p) => pageKeySegment(p.path));
    for (const page of manifest.pages) {
      const keys = keysForPage(map.entries as Record<string, unknown>, allSegs, page.path);
      const zones = zonesForPageKeys(keys).map((z) => z.zone);
      expect(zones).toContain("video-section");
      expect(zones).toContain("cta-stack");
    }
  });

  it("CAPTURE MODE writes captured-snapshot.json when requested", async () => {
    if (process.env.TAYA_CAPTURE_SNAPSHOT !== "1") {
      // Not in capture mode — the assertion is a no-op by design.
      expect(process.env.TAYA_CAPTURE_SNAPSHOT).not.toBe("1");
      return;
    }
    const result = await crawlSite(manifest.domain);
    const map = buildPageMap(result.snapshot!);
    const allSegs = map.pages.map((p) => pageKeySegment(p.path));
    const zonesByPage: Record<string, string[]> = {};
    for (const page of manifest.pages) {
      const keys = keysForPage(map.entries as Record<string, unknown>, allSegs, page.path);
      zonesByPage[page.path] = zonesForPageKeys(keys).map((z) => z.zone).sort();
    }
    const captured = {
      capturedAt: new Date().toISOString(),
      domain: manifest.domain,
      keyCount: map.keyCount,
      pages: map.pages,
      zonesByPage,
    };
    writeFileSync(
      path.join(FIXTURE_DIR, "captured-snapshot.json"),
      JSON.stringify(captured, null, 2) + "\n",
      "utf8",
    );
    expect(zonesByPage).toBeTruthy();
  });
});
