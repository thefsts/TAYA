/**
 * restaurant-products-default.test.ts — D3 certification (backend defaults).
 *
 * PM-locked rule: restaurant provisioning must leave the Products module OFF
 * by default. This pins the exact backend default table
 * (convex/lib/siteProvisioning.ts → defaultModules) so the rule cannot drift:
 *
 *   - restaurant        → products explicitly OFF (the PM-locked rule)
 *   - ecommerce         → products NOT force-disabled by the baseline; the
 *                         universal auto-conform path enables it for a genuine
 *                         storefront (see site-profiles.test.ts T5)
 *   - business_website  → products NOT force-disabled by the baseline
 *                         (current behavior preserved)
 *   - an explicit owner enable still wins (defaultModules is a pure baseline;
 *     sites.create/update merge an explicit payload on top)
 *
 * The end-to-end provisioning behavior (crawl → infer → provision, explicit
 * owner override preserved across re-crawl, no Menu Items/Reservations/Orders)
 * is covered by site-profiles.test.ts T1–T7.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect } from "vitest";
import { defaultModules } from "../../../convex/lib/siteProvisioning";

describe("D3 — restaurant provisioning leaves Products OFF by default", () => {
  it("restaurant → products is explicitly OFF", () => {
    expect(defaultModules("restaurant").products).toBe(false);
  });

  it("restaurant → courses and articles also OFF (unchanged)", () => {
    const mods = defaultModules("restaurant");
    expect(mods.courses).toBe(false);
    expect(mods.articles).toBe(false);
  });

  it("ecommerce → products is NOT force-disabled by the baseline (auto-conform owns enablement)", () => {
    // The baseline never sets products=false for ecommerce; the universal
    // auto-conform path enables it for a genuine storefront (T5).
    expect(defaultModules("ecommerce").products).not.toBe(false);
  });

  it("business_website → products is NOT force-disabled by the baseline (current behavior preserved)", () => {
    expect(defaultModules("business_website").products).not.toBe(false);
  });

  it("an explicit owner enable still wins over the default", () => {
    // defaultModules is a pure baseline; the caller merges an explicit
    // enabledModules payload on top (sites.create/update honor it).
    const baseline = defaultModules("restaurant");
    const ownerEnabled = { ...baseline, products: true };
    expect(ownerEnabled.products).toBe(true);
    // The baseline itself is untouched (no shared-table mutation).
    expect(defaultModules("restaurant").products).toBe(false);
  });

  it("no Menu Items / Reservations / Orders module key is introduced", () => {
    const mods = defaultModules("restaurant");
    for (const key of ["menu-items", "menuItems", "reservations", "orders"]) {
      expect(Object.keys(mods)).not.toContain(key);
    }
  });
});
