/**
 * responsive-grids.test.ts — D7 certification.
 *
 * PM rule: the three safe responsive files (MediaLibrary, ProductsManager,
 * ServicesManager) must not use fixed multi-column grids that clip on a
 * 390px mobile viewport. The mobile (base, unprefixed) breakpoint must never
 * force more than 2 columns; wider layouts must be opt-in via sm/md/lg/xl.
 *
 * HealthMonitor and PaymentProviders are owned by Chat D / PR #58 and are
 * intentionally NOT covered here.
 *
 * This is a static source audit (mirrors the client-help.test.tsx static
 * audit pattern) so it pins the class strings directly and cannot drift.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const FILES = [
  "src/pages/app/sites/MediaLibrary.tsx",
  "src/pages/app/sites/ProductsManager.tsx",
  "src/pages/app/sites/ServicesManager.tsx",
];

/** Extract every `grid grid-cols-…` class string in a source file. */
function gridClasses(src: string): string[] {
  const out: string[] = [];
  const re = /className="([^"]*\bgrid\b[^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const cls = m[1];
    if (/\bgrid-cols-/.test(cls)) out.push(cls);
  }
  return out;
}

/** The unprefixed (mobile/base) grid-cols-N value, or null if none. */
function baseCols(cls: string): number | null {
  const m = cls.match(/(?:^|\s)grid-cols-(\d+)(?:\s|$)/);
  return m ? Number(m[1]) : null;
}

describe("D7 — responsive grids (no mobile clipping)", () => {
  for (const file of FILES) {
    describe(file, () => {
      const src = readFileSync(file, "utf8");
      const grids = gridClasses(src);

      it("has at least one responsive grid", () => {
        expect(grids.length).toBeGreaterThan(0);
      });

      it("no mobile base forces more than 2 columns", () => {
        for (const cls of grids) {
          const base = baseCols(cls);
          if (base != null) {
            expect(
              base,
              `mobile-hostile base grid (${base} cols at 390px): "${cls}"`,
            ).toBeLessThanOrEqual(2);
          }
        }
      });

      it("every multi-column grid widens only via a breakpoint prefix", () => {
        for (const cls of grids) {
          const hasWide = /(?:^|\s)(?:sm|md|lg|xl|2xl):grid-cols-([3-9]|1[0-2])(?:\s|$)/.test(cls);
          if (hasWide) {
            // A wide layout must be gated behind a breakpoint, i.e. the base
            // must be present and small (grid-cols-1 or grid-cols-2).
            const base = baseCols(cls);
            expect(
              base != null && base <= 2,
              `wide grid without a small mobile base: "${cls}"`,
            ).toBe(true);
          }
        }
      });
    });
  }
});
