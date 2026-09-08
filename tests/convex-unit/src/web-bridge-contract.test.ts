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

/**
 * SNIPPET EXECUTION REGRESSION (found live in prod verification 2026-09-08):
 * the generated snippet once emitted
 *   document.querySelectorAll('['+'"data-taya-edit"'+']')
 * which concatenates to the string ["data-taya-edit"] — an INVALID CSS
 * selector. Browsers throw SyntaxError inside the fetch .then chain, the
 * trailing .catch(function(){}) swallowed it, and published values were
 * silently never applied (the live proof site kept showing discovered text).
 * Determinism tests could not catch this: the bytes were deterministic, just
 * wrong. These tests EXECUTE the generated snippet against a DOM world whose
 * selector parser is strict like a browser's, so any malformed selector —
 * this one or a cousin — fails CI instead of failing silently in production.
 */
describe("web-bridge snippet — executes in a DOM world (selector regression)", () => {
  const ATTR = "data-taya-edit";
  const convexHttpUrl = "https://uncommon-cobra-336.convex.site";
  const slug = "example-external-site";

  /** Strict like a browser: only bare attribute selectors [name] parse. */
  function assertValidSelector(sel: string) {
    if (!/^\[[A-Za-z_][A-Za-z0-9_-]*\]$/.test(sel)) {
      throw new Error(
        `SyntaxError: '${sel}' is not a valid selector (mirrors browser querySelectorAll)`,
      );
    }
  }

  function makeElement(tag: string, attrs: Record<string, string> = {}) {
    return {
      tagName: tag,
      attributes: { ...attrs } as Record<string, string>,
      textContent: "",
      parent: null as any,
      getAttribute(n: string) {
        return this.attributes[n] ?? null;
      },
      setAttribute(n: string, v: string) {
        this.attributes[n] = String(v);
      },
      closest(sel: string) {
        assertValidSelector(sel);
        const name = sel.slice(1, -1);
        let cur: any = this;
        while (cur) {
          if (cur.attributes && cur.attributes[name] !== undefined) return cur;
          cur = cur.parent;
        }
        return null;
      },
    };
  }

  function makeWorld(opts: { published?: any; drafts?: any; search?: string } = {}) {
    const events: Array<{ type: string; detail: any }> = [];
    const fetches: string[] = [];
    const beacons: Array<{ url: string; blob: any }> = [];

    const doc: any = {
      _nodes: [] as any[],
      _handlers: {} as Record<string, Array<(ev: any) => void>>,
      addEventListener(type: string, fn: (ev: any) => void) {
        (this._handlers[type] ||= []).push(fn);
      },
      dispatchEvent(ev: any) {
        events.push({ type: ev.type, detail: ev.detail });
        return true;
      },
      querySelectorAll(sel: string) {
        assertValidSelector(sel);
        const name = sel.slice(1, -1);
        return this._nodes.filter((n: any) => n.attributes[name] !== undefined);
      },
      fire(type: string, ev: any) {
        for (const fn of this._handlers[type] ?? []) fn(ev);
      },
    };

    const fetchImpl = (url: string) => {
      fetches.push(url);
      let payload: any = null;
      if (url.includes("/api/bridge/content")) payload = { values: opts.published ?? {} };
      if (url.includes("/api/bridge/draft"))
        payload = { values: opts.published ?? {}, drafts: opts.drafts ?? {} };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
    };

    const nav: any = {
      sendBeacon: (url: string, blob: any) => {
        beacons.push({ url, blob });
        return true;
      },
    };
    const loc: any = { search: opts.search ?? "" };
    class FakeCustomEvent {
      type: string;
      detail: any;
      constructor(t: string, d: any) {
        this.type = t;
        this.detail = d?.detail;
      }
    }

    return { doc, events, fetches, beacons, fetchImpl, nav, loc, FakeCustomEvent };
  }

  function jsBodyOf(s: string) {
    return s.replace(/^<!--[\s\S]*?-->\s*<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
  }

  async function flushMicrotasks() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  }

  function execute(snippet: string, w: ReturnType<typeof makeWorld>) {
    const run = new Function(
      "document",
      "navigator",
      "fetch",
      "location",
      "CustomEvent",
      jsBodyOf(snippet),
    );
    run(w.doc, w.nav, w.fetchImpl, w.loc, w.FakeCustomEvent as any);
  }

  function proofDom(w: ReturnType<typeof makeWorld>) {
    const h1 = makeElement("h1", { [ATTR]: "home.hero.heading" });
    const p = makeElement("p", { [ATTR]: "home.hero.subheading" });
    const img = makeElement("img", {
      [ATTR]: "home.hero.image",
      "data-taya-type": "image",
      src: "https://img.example/discovered.png",
    });
    const a = makeElement("a", {
      [ATTR]: "home.hero.primaryButton.href",
      "data-taya-type": "button",
      href: "/discovered-cta",
    });
    const plainH2 = makeElement("h2"); // untagged — must never be touched
    w.doc._nodes.push(h1, p, img, a, plainH2);
    return { h1, p, img, a, plainH2 };
  }

  const PUBLISHED = {
    "home.hero.heading": "PUBLISHED HEADING",
    "home.hero.subheading": "PUBLISHED SUBHEADING",
    "home.hero.image": "https://img.example/published.png",
    "home.hero.primaryButton.href": "/published-cta",
    "unmatched.key": "ignored by DOM",
  };

  it("the DOM world rejects the historical broken selector form (negative control)", () => {
    const w = makeWorld();
    // This is the EXACT string the pre-fix snippet produced by concatenation.
    expect(() => w.doc.querySelectorAll('["data-taya-edit"]')).toThrow(/not a valid selector/);
  });

  it("the snippet never quotes the attribute name inside a string literal", () => {
    const snippet = generateBridgeSnippet({ convexHttpUrl, slug });
    // The broken generator emitted '"data-taya-edit"' (a quoted string INSIDE
    // the attribute selector). The attribute name must only ever appear bare.
    expect(snippet).not.toContain(`'"${ATTR}"'`);
    expect(snippet).toContain(`querySelectorAll('[${ATTR}]')`);
    expect(snippet).toContain(`closest('[${ATTR}]')`);
  });

  it("applies PUBLISHED values by type and leaves untagged elements alone", async () => {
    const w = makeWorld({ published: PUBLISHED });
    const dom = proofDom(w);
    const snippet = generateBridgeSnippet({ convexHttpUrl, slug });
    execute(snippet, w);
    await flushMicrotasks();

    expect(dom.h1.textContent).toBe("PUBLISHED HEADING");
    expect(dom.p.textContent).toBe("PUBLISHED SUBHEADING");
    expect(dom.img.getAttribute("src")).toBe("https://img.example/published.png");
    expect(dom.a.getAttribute("href")).toBe("/published-cta");
    expect(dom.plainH2.textContent).toBe("");
    // no throw anywhere = the selectors parsed
  });

  it("fetches the content endpoint for the slug, with no token, and dispatches ready", async () => {
    const w = makeWorld({ published: PUBLISHED });
    proofDom(w);
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    expect(w.fetches[0]).toBe(
      `${convexHttpUrl}/api/bridge/content?slug=${encodeURIComponent(slug)}`,
    );
    expect(w.fetches.filter((u) => u.includes("/api/bridge/draft"))).toEqual([]);
    const ready = w.events.find((e) => e.type === "taya:bridge-ready");
    expect(ready).toBeTruthy();
    expect(ready!.detail.count).toBe(Object.keys(PUBLISHED).length);
  });

  it("reports clicks: dispatch + sendBeacon payload with slug and key", async () => {
    const w = makeWorld({ published: PUBLISHED });
    const dom = proofDom(w);
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    w.doc.fire("click", { target: dom.img });
    const click = w.events.find((e) => e.type === "taya:element-click");
    expect(click).toBeTruthy();
    expect(click!.detail.key).toBe("home.hero.image");
    expect(click!.detail.type).toBe("image");

    expect(w.beacons.length).toBe(1);
    expect(w.beacons[0].url).toBe(`${convexHttpUrl}/api/bridge/click`);
    const body = JSON.parse(await w.beacons[0].blob.text());
    expect(body).toEqual({ slug, key: "home.hero.image", type: "image", path: null });
  });

  it("overlays DRAFT values in preview mode (?taya_preview=token) and dispatches preview-applied", async () => {
    const w = makeWorld({
      published: PUBLISHED,
      drafts: {
        "home.hero.heading": "DRAFT HEADING (owner preview)",
        "home.hero.subheading": "DRAFT SUBHEADING (owner preview)",
      },
      search: "?taya_preview=abcdef123456abcdef123456",
    });
    const dom = proofDom(w);
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    // drafts overlay ON TOP of published
    expect(dom.h1.textContent).toBe("DRAFT HEADING (owner preview)");
    expect(dom.p.textContent).toBe("DRAFT SUBHEADING (owner preview)");
    // published-only keys still applied
    expect(dom.img.getAttribute("src")).toBe("https://img.example/published.png");

    expect(w.fetches).toContain(
      `${convexHttpUrl}/api/bridge/draft?slug=${encodeURIComponent(
        slug,
      )}&token=abcdef123456abcdef123456`,
    );
    const applied = w.events.find((e) => e.type === "taya:preview-applied");
    expect(applied).toBeTruthy();
    expect(applied!.detail.draftCount).toBe(2);
  });

  it("survives an anonymous world (no sendBeacon, fetch rejects) without throwing", async () => {
    const w = makeWorld({ published: PUBLISHED });
    proofDom(w);
    // strip sendBeacon → report() falls back to fetch; and make fetch throw
    // for the click endpoint only (content still resolves)
    w.nav.sendBeacon = undefined;
    const realFetch = w.fetchImpl;
    w.fetchImpl = (url: string) => {
      if (url.includes("/api/bridge/click")) return Promise.reject(new Error("offline"));
      return realFetch(url);
    };
    expect(() =>
      execute(generateBridgeSnippet({ convexHttpUrl, slug }), w),
    ).not.toThrow();
    await flushMicrotasks(); // rejected click fetch must be swallowed
    const dom = w.doc._nodes[0];
    expect(dom.textContent).toBe("PUBLISHED HEADING");
  });
});
