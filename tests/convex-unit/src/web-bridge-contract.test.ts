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
 *   6. §2/§3 mirror parity: safeLinks.classifyLink and videoEmbeds.parseVideoUrl
 *      agree between convex/lib (canonical, server-side guard) and
 *      lib/web-bridge/src (mirror, dashboard inline validation) on a full
 *      accept/reject corpus — the dashboard's client-side reason shown to
 *      the client is the exact reason the server would reject with.
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
import {
  classifyLink as canonClassifyLink,
  MAX_LINK_LENGTH as canonMaxLinkLength,
} from "../../../convex/lib/safeLinks";
import {
  classifyLink as mirrorClassifyLink,
  MAX_LINK_LENGTH as mirrorMaxLinkLength,
} from "../../../lib/web-bridge/src/safeLinks";
import { parseVideoUrl as canonParseVideoUrl } from "../../../convex/lib/videoEmbeds";
import { parseVideoUrl as mirrorParseVideoUrl } from "../../../lib/web-bridge/src/videoEmbeds";
import type { SafeLinkKind } from "../../../lib/web-bridge/src/safeLinks";
import type { VideoProvider } from "../../../lib/web-bridge/src/videoEmbeds";

const CUSTOMER_NAMES = ["corsair", "fsts"];

describe("web-bridge contract — mirror parity (canonical ⇄ dashboard)", () => {
  it("locks every constant equal between the two contract files", () => {
    expect(MIRROR.TAYA_BRIDGE_VERSION).toBe(CANON.TAYA_BRIDGE_VERSION);
    expect(MIRROR.BRIDGE_ATTR_KEY).toBe(CANON.BRIDGE_ATTR_KEY);
    expect(MIRROR.BRIDGE_ATTR_TYPE).toBe(CANON.BRIDGE_ATTR_TYPE);
    expect(MIRROR.BRIDGE_ATTR_LABEL).toBe(CANON.BRIDGE_ATTR_LABEL);
    expect(MIRROR.BRIDGE_ATTR_REPEATABLE).toBe(CANON.BRIDGE_ATTR_REPEATABLE);
    expect(MIRROR.BRIDGE_ATTR_PAGE).toBe(CANON.BRIDGE_ATTR_PAGE);
    expect(MIRROR.BRIDGE_ATTR_ZONE).toBe(CANON.BRIDGE_ATTR_ZONE);
    expect(MIRROR.BRIDGE_EVENT_READY).toBe(CANON.BRIDGE_EVENT_READY);
    expect(MIRROR.BRIDGE_EVENT_CLICK).toBe(CANON.BRIDGE_EVENT_CLICK);
    expect(MIRROR.BRIDGE_EVENT_PREVIEW_APPLIED).toBe(CANON.BRIDGE_EVENT_PREVIEW_APPLIED);
    expect(MIRROR.BRIDGE_EVENT_BLOCKS_APPLIED).toBe(CANON.BRIDGE_EVENT_BLOCKS_APPLIED);
    expect(MIRROR.BRIDGE_EVENT_STRUCTURAL_APPLIED).toBe(CANON.BRIDGE_EVENT_STRUCTURAL_APPLIED);
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
    expect(MIRROR.BRIDGE_FIELD_BLOCKS).toBe(CANON.BRIDGE_FIELD_BLOCKS);
    expect(MIRROR.BRIDGE_FIELD_STRUCTURAL).toBe(CANON.BRIDGE_FIELD_STRUCTURAL);
    expect([...MIRROR.BRIDGE_ENTRY_TYPES]).toEqual([...CANON.BRIDGE_ENTRY_TYPES]);
    expect([...MIRROR.BRIDGE_SNIPPET_PARAMS]).toEqual([...CANON.BRIDGE_SNIPPET_PARAMS]);
  });

  it("locks the concrete wire values the protocol depends on", () => {
    expect(CANON.TAYA_BRIDGE_VERSION).toBe(2);
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
    // v2 additions — safe insertion zones (§6)
    expect(CANON.BRIDGE_ATTR_ZONE).toBe("data-taya-zone");
    expect(CANON.BRIDGE_EVENT_BLOCKS_APPLIED).toBe("taya:blocks-applied");
    expect(CANON.BRIDGE_EVENT_STRUCTURAL_APPLIED).toBe("taya:structural-applied");
    expect(CANON.BRIDGE_FIELD_BLOCKS).toBe("blocks");
    expect(CANON.BRIDGE_FIELD_STRUCTURAL).toBe("structural");
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
    expect(snippet.startsWith("<!-- TAYA Web Bridge v2 -->")).toBe(true);
  });

  it("v2: renders zone blocks into [data-taya-zone] containers with honest fallback", () => {
    expect(snippet).toContain('data-taya-zone="');
    // container resolution: zone marker first, main/body fallback
    expect(snippet).toContain("document.querySelector(zoneSelector(z.zone))");
    expect(snippet).toContain("document.querySelector('main')||document.body");
    // appended HTML is server-sanitized; the snippet only inserts it
    expect(snippet).toContain("insertAdjacentHTML('beforeend',z.html)");
    expect(snippet).toContain("taya:blocks-applied");
  });

  it("v2: applies published structural ops (hide + reorder §6 repeatables)", () => {
    expect(snippet).toContain("hiddenItems");
    expect(snippet).toContain("itemOrder");
    expect(snippet).toContain("taya:structural-applied");
    // hidden items get display:none; ordered items get DOM-reordered
    expect(snippet).toContain(".style.display='none'");
    expect(snippet).toContain("parent.insertBefore(anchors[a],");
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

  /**
   * Strict like a browser: bare attribute selectors [name], attribute
   * equals [name="value"], and single tag names parse; anything else
   * (combinators, quoted names, pseudo-classes) throws SyntaxError.
   */
  function parseSelector(sel: string) {
    let m = /^[a-z][a-z0-9-]*$/i.exec(sel);
    if (m) return { kind: "tag" as const, tag: m[0].toLowerCase() };
    m = /^\[([A-Za-z_][A-Za-z0-9_-]*)(?:="([^"\\]*)")?\]$/.exec(sel);
    if (m) return { kind: "attr" as const, name: m[1], value: m[2] };
    throw new Error(
      `SyntaxError: '${sel}' is not a valid selector (mirrors browser querySelector)`,
    );
  }

  /** Strict like a browser: only bare attribute selectors [name] parse. */
  function assertValidSelector(sel: string) {
    if (!/^\[[A-Za-z_][A-Za-z0-9_-]*\]$/.test(sel)) {
      throw new Error(
        `SyntaxError: '${sel}' is not a valid selector (mirrors browser querySelectorAll)`,
      );
    }
  }

  function makeElement(tag: string, attrs: Record<string, string> = {}) {
    const el: any = {
      tagName: tag,
      attributes: { ...attrs } as Record<string, string>,
      textContent: "",
      parent: null as any,
      children: [] as any[],
      style: {} as Record<string, string>,
      _inserted: [] as Array<{ pos: string; html: string }>,
      get parentElement() {
        return this.parent;
      },
      appendChild(child: any) {
        child.parent = this;
        this.children.push(child);
        return child;
      },
      insertAdjacentHTML(pos: string, html: string) {
        if (!/^(beforebegin|afterbegin|beforeend|afterend)$/.test(pos)) {
          throw new Error(`SyntaxError: '${pos}' is not an insert position`);
        }
        // The mock records the server-sanitized html verbatim; the snippet
        // only appends, never parses it back out.
        this._inserted.push({ pos, html: String(html) });
      },
      insertBefore(node: any, ref: any) {
        // DOM pre-insert semantics: inserting before yourself is a no-op.
        if (node === ref) return node;
        if (node.parent && Array.isArray(node.parent.children)) {
          const i = node.parent.children.indexOf(node);
          if (i !== -1) node.parent.children.splice(i, 1);
        }
        node.parent = this;
        const idx = ref == null ? this.children.length : this.children.indexOf(ref);
        if (idx === -1) this.children.push(node);
        else this.children.splice(idx, 0, node);
        return node;
      },
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
    return el;
  }

  function makeWorld(
    opts: {
      published?: any;
      drafts?: any;
      search?: string;
      pathname?: string;
      pages?: any;
      blocks?: any;
      structural?: any;
      draftBlocks?: any;
      draftStructural?: any;
    } = {},
  ) {
    const events: Array<{ type: string; detail: any }> = [];
    const fetches: string[] = [];
    const beacons: Array<{ url: string; blob: any }> = [];

    // The document tree: body (with a <main> child) is the honest fallback
    // container for zone blocks without a [data-taya-zone] marker.
    const body = makeElement("body");
    const main = makeElement("main");
    body.appendChild(main);

    const doc: any = {
      _nodes: [body, main] as any[],
      body,
      main,
      addNode(el: any) {
        this._nodes.push(el);
        return el;
      },
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
      querySelector(sel: string) {
        const s = parseSelector(sel);
        if (s.kind === "tag") {
          return (
            this._nodes.find(
              (n: any) =>
                typeof n.tagName === "string" && n.tagName.toLowerCase() === s.tag,
            ) ?? null
          );
        }
        return (
          this._nodes.find((n: any) =>
            s.value === undefined
              ? n.attributes[s.name] !== undefined
              : n.attributes[s.name] === s.value,
          ) ?? null
        );
      },
      fire(type: string, ev: any) {
        for (const fn of this._handlers[type] ?? []) fn(ev);
      },
    };

    const fetchImpl = (url: string) => {
      fetches.push(url);
      let payload: any = null;
      if (url.includes("/api/bridge/content")) {
        payload = {
          values: opts.published ?? {},
          pages: opts.pages ?? [],
          blocks: opts.blocks ?? {},
          structural: opts.structural ?? {},
        };
      }
      if (url.includes("/api/bridge/draft")) {
        payload = {
          values: opts.published ?? {},
          drafts: opts.drafts ?? {},
          pages: opts.pages ?? [],
          // Draft preview overlays the OWNER's pending blocks/structural on
          // top of the published ones (draft isolation still holds for the
          // public /content endpoint).
          blocks: opts.draftBlocks ?? opts.blocks ?? {},
          structural: opts.draftStructural ?? opts.structural ?? {},
        };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
    };

    const nav: any = {
      sendBeacon: (url: string, blob: any) => {
        beacons.push({ url, blob });
        return true;
      },
    };
    const loc: any = { search: opts.search ?? "", pathname: opts.pathname ?? "/" };
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
    // Attach the proof tree under <main>: a real document shape, so zone
    // containers/fallbacks and item parents resolve like a browser would.
    for (const el of [h1, p, img, a, plainH2]) {
      w.doc.main.appendChild(el);
      w.doc._nodes.push(el);
    }
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
    const dom = w.doc.querySelectorAll("[data-taya-edit]")[0];
    expect(dom.textContent).toBe("PUBLISHED HEADING");
  });

  // ── v2 execution: zone blocks + structural ops in the DOM world ──────
  const ZONE_ATTR = "data-taya-zone";

  function zoneDom(w: ReturnType<typeof makeWorld>) {
    // A services list: 3 repeatable items, each with a title keyed by the
    // §5 grammar. All share parent <main> — same as the frame's world.
    const items = [0, 1, 2].map((i) =>
      makeElement("article", {
        [ATTR]: `home.services.items[${i}].title`,
        "data-taya-type": "list_item",
      }),
    );
    for (const it of items) {
      w.doc.main.appendChild(it);
      w.doc._nodes.push(it);
    }
    return { items };
  }

  it("v2: renders published zone blocks into the [data-taya-zone] container (not main fallback)", async () => {
    const w = makeWorld({
      pages: [{ path: "/" }],
      blocks: {
        "/": [{ zone: "cta-stack", html: '<div class="taya-block cta">BOOK NOW</div>' }],
      },
    });
    // The site author placed a zone marker container in their own markup.
    const zoneBox = makeElement("div", { [ZONE_ATTR]: "cta-stack" });
    w.doc.main.appendChild(zoneBox);
    w.doc._nodes.push(zoneBox);

    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    expect(zoneBox._inserted).toEqual([
      { pos: "beforeend", html: '<div class="taya-block cta">BOOK NOW</div>' },
    ]);
    // fallback container untouched — the marker wins
    expect(w.doc.main._inserted).toEqual([]);
    const blocksEvt = w.events.find((e) => e.type === "taya:blocks-applied");
    expect(blocksEvt).toBeTruthy();
    expect(blocksEvt!.detail.count).toBe(1);
  });

  it("v2: honest fallback — no zone marker → main is the container", async () => {
    const w = makeWorld({
      pages: [{ path: "/" }],
      blocks: {
        "/": [{ zone: "hero", html: "<h2 class=\"taya-block\">Drafted heading</h2>" }],
      },
    });
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    expect(w.doc.main._inserted).toEqual([
      { pos: "beforeend", html: '<h2 class="taya-block">Drafted heading</h2>' },
    ]);
    expect(w.events.find((e) => e.type === "taya:blocks-applied")).toBeTruthy();
  });

  it("v2: resolves the page by route path from the payload (trailing slash + index.html variants)", async () => {
    const w = makeWorld({
      pathname: "/services/index.html",
      pages: [{ path: "/services" }],
      blocks: { "/services": [{ zone: "service-list", html: "<p>SERVE</p>" }] },
    });
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    expect(w.doc.main._inserted).toEqual([{ pos: "beforeend", html: "<p>SERVE</p>" }]);
  });

  it("v2: unknown page → honest no-op (no blocks rendered, no events faked)", async () => {
    const w = makeWorld({
      pathname: "/not-in-payload",
      pages: [{ path: "/" }],
      blocks: { "/": [{ zone: "hero", html: "<p>HOME ONLY</p>" }] },
    });
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    expect(w.doc.main._inserted).toEqual([]);
    expect(w.events.find((e) => e.type === "taya:blocks-applied")).toBeUndefined();
    // ready still fires — values applied regardless of blocks
    expect(w.events.find((e) => e.type === "taya:bridge-ready")).toBeTruthy();
  });

  it("v2: hides removed items (display:none) and reorders the rest (DOM move)", async () => {
    const w = makeWorld({
      pages: [{ path: "/" }],
      structural: {
        "/": {
          hiddenItems: ["home.services.items[1]"],
          itemOrder: ["home.services.items[2]", "home.services.items[0]"],
        },
      },
    });
    const { items } = zoneDom(w);
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    expect(items[1].style.display).toBe("none");
    expect(items[0].style.display).not.toBe("none");
    // anchor children of main now ordered [2, 0, 1]
    expect(w.doc.main.children).toEqual([items[2], items[0], items[1]]);
    const stEvt = w.events.find((e) => e.type === "taya:structural-applied");
    expect(stEvt).toBeTruthy();
    expect(stEvt!.detail).toEqual({ hidden: 1, reordered: 2 });
  });

  it("v2: preview mode defers blocks/structural to the single token-gated draft pass (no double render)", async () => {
    const w = makeWorld({
      search: "?taya_preview=abcdef123456abcdef123456",
      pages: [{ path: "/" }],
      blocks: { "/": [{ zone: "hero", html: "<p>PUBLISHED BLOCK</p>" }] },
      draftBlocks: { "/": [{ zone: "hero", html: "<p>DRAFT BLOCK (owner)</p>" }] },
    });
    execute(generateBridgeSnippet({ convexHttpUrl, slug }), w);
    await flushMicrotasks();

    // exactly ONE render — the token-gated draft pass (complete draft
    // state); the public pass deferred blocks/structural to it so
    // unchanged blocks never render twice.
    expect(w.doc.main._inserted).toEqual([
      { pos: "beforeend", html: "<p>DRAFT BLOCK (owner)</p>" },
    ]);
    const evts = w.events.filter((e) => e.type === "taya:blocks-applied");
    expect(evts.length).toBe(1);
    expect(evts[0]!.detail).toEqual({ count: 1, draft: true });
    // values still applied by the public pass (graceful fallback if the
    // draft fetch were to fail — the owner still sees published values)
    const applied = w.events.find((e) => e.type === "taya:preview-applied");
    expect(applied).toBeTruthy();
    expect(applied!.detail.draftCount).toBe(0);
  });
});

// ──────────────────────────────────────────────────────
// §2/§3 MIRROR PARITY — safeLinks + videoEmbeds (canonical ⇄ dashboard)
// ─────────────────────────────────────────────────────────────────────

const LINK_CORPUS: Array<{ raw: string; kind: SafeLinkKind | "empty" | "reject" }> = [
  { raw: "", kind: "empty" },
  { raw: "#", kind: "anchor" },
  { raw: "#pricing", kind: "anchor" },
  { raw: "/about", kind: "internal" },
  { raw: "/services", kind: "internal" },
  { raw: "/blog/post-one", kind: "internal" },
  { raw: "https://example.com", kind: "external" },
  { raw: "https://example.com/page?x=1", kind: "external" },
  { raw: "http://example.com", kind: "external" },
  { raw: "example.com/pricing", kind: "external" },
  { raw: "www.example.com", kind: "external" },
  { raw: "tel:5551234567", kind: "phone" },
  { raw: "tel:+1 (555) 123-4567", kind: "phone" },
  { raw: "tel:5551234567x22", kind: "phone" }, // extension via x/X marker
  { raw: "tel:5551234567,ext=22", kind: "reject" }, // comma-ext NOT supported
  { raw: "mailto:hi@example.com", kind: "email" },
  { raw: "mailto:hi@example.com?subject=Hello", kind: "email" },
  // pasted-URL whitespace trims (WHATWG URL discipline — paste UX)
  { raw: " https://example.com", kind: "external" },
  { raw: "https://example.com ", kind: "external" },
  // anchors with a space are harmless in-page fragments (kept verbatim)
  { raw: "#a b", kind: "anchor" },
];

const LINK_REJECTS: string[] = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html;base64,PHNjcmlwdD4=",
  "vbscript:msgbox(1)",
  "//example.com",
  "https://user:pass@example.com",
  "ftp://files.example.com",
  "mailto:not-an-email",
  "mailto:a@b",
  "tel:",
  "tel:abc",
  "tel:+",
  "https://",
  "https://.com",
  "about:blank",
  "file:///etc/passwd",
  "/" + "a".repeat(3000),
];

describe("web-bridge §2 safeLinks — mirror parity (canonical ⇄ dashboard)", () => {
  it("classifyLink agrees on every corpus entry (accept side)", () => {
    for (const { raw, kind } of LINK_CORPUS) {
      const c = canonClassifyLink(raw);
      const m = mirrorClassifyLink(raw);
      // parity is the core pin — both files decide identically
      expect(m).toEqual(c);
      if (kind === "reject") {
        // corpus-marked rejects (syntax the module intentionally rejects)
        expect(c.ok).toBe(false);
        continue;
      }
      expect(c.ok).toBe(true);
      if (c.ok) {
        if (kind === "empty") expect(c.normalized).toBe("");
        else expect(c.kind).toBe(kind);
      }
    }
  });

  it("classifyLink agrees on every corpus entry (reject side)", () => {
    for (const raw of LINK_REJECTS) {
      const c = canonClassifyLink(raw);
      const m = mirrorClassifyLink(raw);
      expect(m).toEqual(c);
      expect(c.ok).toBe(false);
      if (!c.ok) expect(typeof c.reason).toBe("string");
    }
  });

  it("normalizes phones to compact tel: form identically", () => {
    for (const raw of ["tel:5551234567", "tel:+1 (555) 123-4567"]) {
      expect(mirrorClassifyLink(raw)).toEqual(canonClassifyLink(raw));
    }
  });

  it("MAX_LINK_LENGTH pins equal", () => {
    expect(mirrorMaxLinkLength).toBe(canonMaxLinkLength);
  });
});

const VIDEO_ACCEPTS: Array<{ raw: string; provider: VideoProvider }> = [
  { raw: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", provider: "youtube" },
  { raw: "https://youtu.be/dQw4w9WgXcQ", provider: "youtube" },
  { raw: "https://m.youtube.com/watch?v=dQw4w9WgXcQ", provider: "youtube" },
  { raw: "https://music.youtube.com/watch?v=dQw4w9WgXcQ", provider: "youtube" },
  { raw: "https://www.youtube.com/shorts/abc123XYZ_-", provider: "youtube" },
  { raw: "https://www.youtube.com/embed/dQw4w9WgXcQ", provider: "youtube" },
  { raw: "https://www.youtube.com/live/dQw4w9WgXcQ", provider: "youtube" },
  { raw: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", provider: "youtube" },
  { raw: "https://vimeo.com/76979871", provider: "vimeo" },
  { raw: "https://player.vimeo.com/video/76979871", provider: "vimeo" },
  { raw: "https://vimeo.com/76979871?h=2f66e2b3c9", provider: "vimeo" },
  { raw: "https://vimeo.com/76979871/2f66e2b3c9", provider: "vimeo" },
];

const VIDEO_REJECTS: string[] = [
  "",
  "not a url",
  '<iframe src="https://youtube.com/embed/x"></iframe>',
  "javascript:alert(1)",
  "https://example.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com/watch?v=short",
  "https://youtube.com/watch",
  "https://youtube.com/browse",
  "https://vimeo.com/abc",
  "https://vimeo.com/12345678901234567890",
  "dQw4w9WgXcQ",
];

describe("web-bridge §3 videoEmbeds — mirror parity (canonical ⇄ dashboard)", () => {
  it("parseVideoUrl agrees on every corpus entry (accept side)", () => {
    for (const { raw, provider } of VIDEO_ACCEPTS) {
      const c = canonParseVideoUrl(raw);
      const m = mirrorParseVideoUrl(raw);
      expect(m).toEqual(c);
      expect(c.ok).toBe(true);
      if (c.ok) {
        expect(c.provider).toBe(provider);
        expect(c.embedUrl).toContain(provider === "youtube" ? "youtube" : "vimeo");
        expect(c.watchUrl).toContain(provider === "youtube" ? "watch" : "vimeo.com");
      }
    }
  });

  it("parseVideoUrl agrees on every corpus entry (reject side)", () => {
    for (const raw of VIDEO_REJECTS) {
      const c = canonParseVideoUrl(raw);
      const m = mirrorParseVideoUrl(raw);
      expect(m).toEqual(c);
      expect(c.ok).toBe(false);
      if (!c.ok) expect(typeof c.reason).toBe("string");
    }
  });

  it("embed URLs are provider-hosted only — no arbitrary embed HTML", () => {
    for (const { raw } of VIDEO_ACCEPTS) {
      const c = canonParseVideoUrl(raw);
      if (c.ok) {
        expect(c.embedUrl).toMatch(/^https:\/\/(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com|youtube\.com)\//);
      }
    }
  });
});
