/**
 * PHASE 2 PR-2 K1 — THE TAYA WEB BRIDGE CONTRACT TESTS.
 *
 * Locks the universal bridge wire contract:
 *   1. Mirror parity: every constant in convex/lib/webBridgeContract.ts
 *      (canonical) equals its counterpart in lib/web-bridge/src/contract.ts
 *      (dashboard mirror). A drift fails CI before it can break any
 *      embedded site.
 *   2. §5 key grammar: isValidBridgeKey parity between the two files on a
 *      valid/invalid sample corpus.
 *   3. Snippet universality + determinism: generateBridgeSnippet is a pure
 *      function of (convexHttpUrl, slug); the output contains the four
 *      endpoints, the data-taya-edit attribute, the taya_preview overlay,
 *      click reporting, and NO customer-specific values (no "corsair", no
 *      "fsts", no customer slugs beyond the passed slug parameter).
 *   4. buildPreviewUrl joining semantics.
 *   5. Registry: buildRegistry allowlist enforcement, keyBelongsToPage
 *      longest-segment attribution, pageSegment normalization, BRIDGE_ATTRS.
 *
 * PURE tests (node environment, no Convex runtime).
 */

import { describe, expect, it } from "vitest";
import * as CANON from "../../../convex/lib/webBridgeContract";
import * as MIRROR from "../../../lib/web-bridge/src/contract";
import {
  buildRegistry,
  keyBelongsToPage,
  pageSegment,
  BRIDGE_ATTRS,
} from "../../../lib/web-bridge/src/registry";
import { generateBridgeSnippet, buildPreviewUrl } from "../../../lib/web-bridge/src/snippet";

const CUSTOMER_NAMES = ["corsair", "fsts"];

describe("web-bridge contract — mirror parity (canonical ⇄ dashboard)", () => {
  it("locks every constant equal between the two contract files", () => {
    expect(MIRROR.TAYA_BRIDGE_VERSION).toBe(CANON.TAYA_BRIDGE_VERSION);
    expect(MIRROR.BRIDGE_ATTR_KEY).toBe(CANON.BRIDGE_ATTR_KEY);
    expect(MIRROR.BRIDGE_ATTR_TYPE).toBe(CANON.BRIDGE_ATTR_TYPE);
    expect(MIRROR.BRIDGE_ATTR_LABEL).toBe(CANON.BRIDGE_ATTR_LABEL);
    expect(MIRROR.BRIDGE_ATTR_REPEATABLE).toBe(CANON.BRIDGE_ATTR_REPEATABLE);
    expect(MIRROR.BRIDGE_ATTR_PAGE).toBe(CANON.BRIDGE_ATTR_PAGE);
    expect(MIRROR.BRIDGE_EVENT_READY).toBe(CANON.BRIDGE_EVENT_READY);
    expect(MIRROR.BRIDGE_EVENT_CLICK).toBe(CANON.BRIDGE_EVENT_CLICK);
    expect(MIRROR.BRIDGE_EVENT_PREVIEW_APPLIED).toBe(CANON.BRIDGE_EVENT_PREVIEW_APPLIED);
    expect(MIRROR.BRIDGE_PATH_CONTENT).toBe(CANON.BRIDGE_PATH_CONTENT);
    expect(MIRROR.BRIDGE_PATH_DRAFT).toBe(CANON.BRIDGE_PATH_DRAFT);
    expect(MIRROR.BRIDGE_PATH_VERIFY).toBe(CANON.BRIDGE_PATH_VERIFY);
    expect(MIRROR.BRIDGE_PATH_CLICK).toBe(CANON.BRIDGE_PATH_CLICK);
    expect(MIRROR.BRIDGE_PARAM_SLUG).toBe(CANON.BRIDGE_PARAM_SLUG);
    expect(MIRROR.BRIDGE_PARAM_TOKEN).toBe(CANON.BRIDGE_PARAM_TOKEN);
    expect(MIRROR.BRIDGE_FIELD_VALUES).toBe(CANON.BRIDGE_FIELD_VALUES);
    expect(MIRROR.BRIDGE_FIELD_DRAFTS).toBe(CANON.BRIDGE_FIELD_DRAFTS);
    expect(MIRROR.BRIDGE_FIELD_PAGES).toBe(CANON.BRIDGE_FIELD_PAGES);
    expect(MIRROR.BRIDGE_FIELD_MODE).toBe(CANON.BRIDGE_FIELD_MODE);
    expect(MIRROR.BRIDGE_FIELD_VERSION).toBe(CANON.BRIDGE_FIELD_VERSION);
    expect([...MIRROR.BRIDGE_ENTRY_TYPES]).toEqual([...CANON.BRIDGE_ENTRY_TYPES]);
    expect([...MIRROR.BRIDGE_SNIPPET_PARAMS]).toEqual([...CANON.BRIDGE_SNIPPET_PARAMS]);
  });

  it("locks the concrete wire values the protocol depends on", () => {
    expect(CANON.TAYA_BRIDGE_VERSION).toBe(1);
    expect(CANON.BRIDGE_ATTR_KEY).toBe("data-taya-edit");
    expect(CANON.BRIDGE_ENTRY_TYPES).toEqual([
      "text",
      "image",
      "url",
      "list_item",
      "button",
   "link",
      "repeatable",
    ]);
    expect(CANON.BRIDGE_EVENT_READY).toBe("taya:bridge-ready");
    expect(CANON.BRIDGE_EVENT_CLICK).toBe("taya:element-click");
    expect(CANON.BRIDGE_EVENT_PREVIEW_APPLIED).toBe("taya:preview-applied");
    expect(CANON.BRIDGE_PATH_CONTENT).toBe("/api/bridge/content");
    expect(CANON.BRIDGE_PATH_DRAFT).toBe("/api/bridge/draft");
    expect(CANON.BRIDGE_PATH_VERIFY).toBe("/api/bridge/verify");
    expect(CANON.BRIDGE_PATH_CLICK).toBe("/api/bridge/click");
    expect(CANON.BRIDGE_PARAM_SLUG).toBe("slug");
    expect(CANON.BRIDGE_PARAM_TOKEN).toBe("token");
    expect(CANON.BRIDGE_SNIPPET_PARAMS).toEqual(["slug"]);
  });

  it("isValidBridgeKey agrees between the two files on the sample corpus", () => {
    const validKeys = [
      "home",
      "home.hero.heading",
      "services.intro.text",
      "services.items[0]",
      "services.items[0].title",
      "services.items[12].description",
      "training.classes.intro.heading",
    ];
    const invalidKeys = [
      "",
      "Home Hero",
      "HOME",
      "-bad",
      "9start",
      "services.items[]",
      "services.items[x].title",
      "services.items[0]..title",
      "services..intro",
      ".leading.dot",
      "trailing.dot.",
      "has space",
      "Upper.hero",
      "services.items[0].Title",
    ];
    for (const k of validKeys) {
      expect(CANON.isValidBridgeKey(k), `canonical should accept ${JSON.stringify(k)}`).toBe(true);
      expect(MIRROR.isValidBridgeKey(k), `mirror should accept ${JSON.stringify(k)}`).toBe(true);
    }
    for (const k of invalidKeys) {
      expect(CANON.isValidBridgeKey(k), `canonical should reject ${JSON.stringify(k)}`).toBe(false);
      expect(MIRROR.isValidBridgeKey(k), `mirror should reject ${JSON.stringify(k)}`).toBe(false);
    }
  });
});

describe("web-bridge snippet — universality and determinism", () => {
  const convexHttpUrl = "https://uncommon-cobra-336.convex.site";
  const slug = "example-external-site";

  const snippet = generateBridgeSnippet({ convexHttpUrl, slug });

  it("is deterministic — the same inputs produce byte-identical output", () => {
    const again = generateBridgeSnippet({ convexHttpUrl, slug });
    expect(again).toBe(snippet);
    expect(generateBridgeSnippet({ convexHttpUrl, slug: "other-site" })).not.toBe(snippet);
  });

  it("mentions the site slug exactly once (config payload) and base once", () => {
    const occurrences = snippet.split(slug).length - 1;
    expect(occurrences).toBe(1);
    expect(snippet).toContain(`"base":"${convexHttpUrl}"`);
  });

  it("contains the endpoints the embed snippet speaks (content, draft, click)", () => {
    expect(snippet).toContain("/api/bridge/content");
    expect(snippet).toContain("/api/bridge/draft");
    expect(snippet).toContain("/api/bridge/click");
    // The verify ping is a dashboard-side API call (api.ts postVerifyPing),
    // not part of the embedded snippet — the embed must NOT carry a token.
    expect(snippet).not.toContain("/api/bridge/verify");
  });

  it("contains the edit attribute and the type attribute", () => {
    expect(snippet).toContain("data-taya-edit");
    expect(snippet).toContain("data-taya-type");
  });

  it("implements the taya_preview draft overlay (§8 preview flow)", () => {
    expect(snippet).toContain("taya_preview");
    // token regex accepts 12–64 lowercase hex (case-insensitive)
    expect(snippet).toContain("[a-f0-9]{12,64}");
    // published values are merged, then drafts overlaid on top
    expect(snippet).toContain("for(var k in vals)merged[k]=vals[k];");
    expect(snippet).toContain("for(var d in drfts)merged[d]=drfts[d];");
  });

  it("reports clicks (dispatch + POST/beacon payload with slug/key)", () => {
    expect(snippet).toContain("taya:element-click");
    expect(snippet).toContain("sendBeacon");
    expect(snippet).toContain("key:key");
    // click payload carries the slug under the contract param name
    expect(snippet).toContain("slug:CFG.slug");
  });

  it("dispatches ready and preview-applied events", () => {
    expect(snippet).toContain("taya:bridge-ready");
    expect(snippet).toContain("taya:preview-applied");
  });

  it("is UNIVERSAL — contains no customer-specific values", () => {
    for (const name of CUSTOMER_NAMES) {
      const lower = snippet.toLowerCase();
      expect(
        lower.includes(name),
        `snippet must not contain customer name "${name}"`,
      ).toBe(false);
    }
  });

  it("applies values by type: image→src, url/link/button→href, else textContent", () => {
    expect(snippet).toContain("t==='image'");
    expect(snippet).toContain("el.setAttribute('src',val)");
    expect(snippet).toContain("t==='url'||t==='link'||t==='button'");
    expect(snippet).toContain("el.setAttribute('href',val)");
    expect(snippet).toContain("el.textContent=val");
  });

  it("is vanilla JS — no imports, no bundler requirements", () => {
    expect(snippet).not.toMatch(/\bimport\s/);
    expect(snippet).not.toMatch(/\brequire\s*\(/);
    expect(snippet).not.toContain("from \"./contract\"");
    expect(snippet.startsWith("<!-- TAYA Web Bridge v1 -->")).toBe(true);
  });

  it("stabilizes against URL-joiner variants of the base", () => {
    expect(
      generateBridgeSnippet({ convexHttpUrl: "https://x.example/", slug }),
    ).toBe(snippet.replace(convexHttpUrl, "https://x.example"));
  });
});

describe("web-bridge buildPreviewUrl", () => {
  it("joins with ? when the site URL has no query, & when it does", () => {
    expect(buildPreviewUrl("https://example.com", "abc123def456")).toBe(
      "https://example.com?taya_preview=abc123def456",
    );
    expect(buildPreviewUrl("https://example.com?utm=1", "abc123def456")).toBe(
      "https://example.com?utm=1&taya_preview=abc123def456",
    );
  });

  it("is injective across tokens", () => {
    expect(buildPreviewUrl("https://example.com", "a".repeat(12))).not.toBe(
      buildPreviewUrl("https://example.com", "b".repeat(12)),
    );
  });
});

describe("web-bridge registry", () => {
  const manifest = {
    pages: [
      { path: "/", label: "Home", title: null, keyCount: 0 },
      { path: "/services", label: "Services", title: null, keyCount: 0 },
      { path: "/training/classes", label: "Classes", title: null, keyCount: 0 },
    ],
  };

  it("builds descriptors only for keys matching the §5 grammar", () => {
    const entryTypes: Record<string, string> = {
      "home.hero.heading": "text",
      "home.hero.cta": "button",
      "bad key with spaces": "text",
      "Also-Bad": "text",
      "services.intro.text": "text",
    };
    const descriptors = buildRegistry(manifest, entryTypes);
    const keys = descriptors.map((d) => d.key);
    expect(keys).toContain("home.hero.heading");
    expect(keys).toContain("home.hero.cta");
    expect(keys).toContain("services.intro.text");
    expect(keys).not.toContain("bad key with spaces");
    expect(keys).not.toContain("Also-Bad");
  });

  it("normalizes unknown types to null but keeps the entry", () => {
    const descriptors = buildRegistry(manifest, {
      "home.hero.heading": "not-a-type",
    });
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0].type).toBeNull();
  });

  it("attributes keys to pages via longest segment (keyBelongsToPage)", () => {
    expect(keyBelongsToPage("home.hero.heading", "/")).toBe(true);
    expect(keyBelongsToPage("home", "/")).toBe(true);
    expect(keyBelongsToPage("services.intro.text", "/services")).toBe(true);
    expect(keyBelongsToPage("training.classes.intro", "/training/classes")).toBe(true);
    // wrong page → false
    expect(keyBelongsToPage("services.intro.text", "/")).toBe(false);
    expect(keyBelongsToPage("home.hero.heading", "/services")).toBe(false);
    // prefix-without-dot must not match (homeopathy ≠ home)
    expect(keyBelongsToPage("homex.heading", "/")).toBe(false);
  });

  it("pageSegment: \"/\" → home, \"/services\" → services, nested → dotted", () => {
    expect(pageSegment("/")).toBe("home");
    expect(pageSegment("")).toBe("home");
    expect(pageSegment("/services")).toBe("services");
    expect(pageSegment("services")).toBe("services");
    expect(pageSegment("/training/classes")).toBe("training.classes");
    expect(pageSegment("///about//")).toBe("about");
  });

  it("flags repeatable hints on keys containing items/list/cards/features/testimonials", () => {
    const descriptors = buildRegistry(manifest, {
      "services.items[0].title": "list_item",
      "services.intro.text": "text",
    });
    const byKey = Object.fromEntries(descriptors.map((d) => [d.key, d]));
    expect(byKey["services.items[0].title"].repeatable).toBe(true);
    expect(byKey["services.intro.text"].repeatable).toBe(false);
  });

  it("BRIDGE_ATTRS exposes the five attribute names", () => {
    expect(BRIDGE_ATTRS).toEqual({
      key: "data-taya-edit",
      type: "data-taya-type",
      label: "data-taya-label",
      page: "data-taya-page",
      repeatable: "data-taya-repeatable",
    });
  });

  it("registry output is UNIVERSAL — no customer names in descriptors", () => {
    const descriptors = buildRegistry(manifest, {
      "home.hero.heading": "text",
    });
    const serialized = JSON.stringify(descriptors).toLowerCase();
    for (const name of CUSTOMER_NAMES) {
      expect(serialized.includes(name)).toBe(false);
    }
  });
});
