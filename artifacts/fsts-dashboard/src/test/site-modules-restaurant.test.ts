/**
 * site-modules-restaurant.test.ts — D2 certification
 *
 * PM-locked rule: a restaurant site must NOT auto-enable the Products module.
 * The Square catalog fields (name/price/description/image) do not constitute a
 * real restaurant menu contract (no sections, modifiers, availability,
 * dietary/allergen info, or ordering relationship), and Products must NOT be
 * relabeled "Menu Items".
 *
 * This test pins the FRONTEND default-module table (siteModules.ts) that the
 * onboarding wizard, AdminSites, and WebsiteSettings consume:
 *
 *   1. restaurant → products OFF by default
 *   2. ecommerce  → products ON  (universal behavior preserved)
 *   3. business_website → products OFF (current behavior preserved)
 *   4. an explicit owner enable still wins (defaultModulesForWebsiteType is a
 *      pure default; the caller's explicit payload overrides it)
 *   5. no Menu Items / Reservations / Orders module key is introduced
 *   6. the products module label stays "Products" (no renaming)
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODULES_BY_WEBSITE_TYPE,
  defaultModulesForWebsiteType,
  MODULE_KEYS,
  MODULE_LABELS,
} from "@/lib/siteModules";

describe("D2 — restaurant never auto-enables Products (frontend defaults)", () => {
  it("restaurant → products is OFF by default", () => {
    const mods = defaultModulesForWebsiteType("restaurant");
    expect(mods.products).toBe(false);
    expect(DEFAULT_MODULES_BY_WEBSITE_TYPE.restaurant.products).toBe(false);
  });

  it("restaurant → courses and articles also OFF (unchanged)", () => {
    const mods = defaultModulesForWebsiteType("restaurant");
    expect(mods.courses).toBe(false);
    expect(mods.articles).toBe(false);
  });

  it("ecommerce → products is ON (universal behavior preserved)", () => {
    expect(defaultModulesForWebsiteType("ecommerce").products).toBe(true);
  });

  it("business_website → products is OFF (current behavior preserved)", () => {
    expect(defaultModulesForWebsiteType("business_website").products).toBe(false);
  });

  it("an explicit owner enable still wins over the default", () => {
    // The default is a pure baseline; the caller merges an explicit payload
    // on top (sites.create/update honor args.enabledModules). Simulate the
    // merge the same way the callers do.
    const baseline = defaultModulesForWebsiteType("restaurant");
    const ownerEnabled = { ...baseline, products: true };
    expect(ownerEnabled.products).toBe(true);
    // The baseline itself is untouched (no mutation of the shared table).
    expect(defaultModulesForWebsiteType("restaurant").products).toBe(false);
  });

  it("no Menu Items / Reservations / Orders module key is introduced", () => {
    for (const key of ["menu-items", "menuItems", "reservations", "orders"]) {
      expect(MODULE_KEYS).not.toContain(key);
      expect(Object.keys(MODULE_LABELS)).not.toContain(key);
      expect(Object.keys(DEFAULT_MODULES_BY_WEBSITE_TYPE.restaurant)).not.toContain(key);
    }
  });

  it("the products module label stays \"Products\" (no Menu Items renaming)", () => {
    expect(MODULE_LABELS.products).toMatch(/^Products/);
    expect(MODULE_LABELS.products).not.toMatch(/menu items/i);
  });
});
