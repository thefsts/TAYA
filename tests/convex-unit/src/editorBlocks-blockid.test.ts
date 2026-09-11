/**
 * CHAT B — editorBlocks data-taya-block-id stamping (client UX follow-up).
 *
 * Pins the contract added for block-click: the editor preview path stamps a
 * stable server id on the wrapper so the frame can report WHICH added block
 * was clicked; the public bridge serve path stays id-free (no document ids
 * leak to anonymous site visitors). All existing no-arg calls render
 * byte-identical output — pinned here so it can never silently drift.
 */
import { describe, it, expect } from "vitest";
import { renderBlockHtml, renderZoneHtml } from "../../../convex/lib/editorBlocks";

describe("editorBlocks — block id stamping (click-to-edit added content)", () => {
  it("stamps data-taya-block-id on the wrapper when an id is passed", () => {
    const html = renderBlockHtml({ kind: "text", text: "Hello", style: "paragraph" }, "blk42");
    expect(html).toContain('data-taya-block-id="blk42"');
    // The id is escaped like every other attribute value (server ids only,
    // but defense-in-depth costs nothing).
    const htmlEsc = renderBlockHtml({ kind: "text", text: "x", style: "paragraph" }, 'a"b');
    expect(htmlEsc).not.toContain('data-taya-block-id="a"b"');
  });

  it("stamps the id on EVERY block kind wrapper (all 8 kinds)", () => {
    const id = "blk7";
    const checks: Array<[string, string]> = [
      ["text heading", renderBlockHtml({ kind: "text", text: "H", style: "heading" }, id)],
      ["text paragraph", renderBlockHtml({ kind: "text", text: "P", style: "paragraph" }, id)],
      ["image", renderBlockHtml({ kind: "image", url: "https://cdn.example/x.jpg", alt: "Alt" }, id)],
      ["button", renderBlockHtml({ kind: "button", label: "Go", href: "https://example.com" }, id)],
      [
        "video",
        renderBlockHtml(
          {
            kind: "video", url: "https://www.youtube.com/watch?v=abc", provider: "youtube",
            videoId: "abc", embedUrl: "https://www.youtube-nocookie.com/embed/abc",
            watchUrl: "https://www.youtube.com/watch?v=abc", caption: "Cap",
          },
          id,
        ),
      ],
      ["pdf", renderBlockHtml({ kind: "pdf", resourceId: "dl1", title: "T", url: "https://example.com/a.pdf" }, id)],
      ["cta", renderBlockHtml({ kind: "cta", heading: "H", body: "B", buttonLabel: "L", buttonHref: "https://example.com" }, id)],
      ["faq_item", renderBlockHtml({ kind: "faq_item", question: "Q", answer: "A" }, id)],
    ];
    for (const [name, html] of checks) {
      expect(html, name).toContain(`data-taya-block-id="${id}"`);
    }
    // link kind too
    expect(renderBlockHtml({ kind: "link", label: "L", href: "https://example.com" }, id)).toContain(
      `data-taya-block-id="${id}"`,
    );
  });

  it("renders byte-identical output when no id is passed (public serve path unchanged)", () => {
    // The bridge serve path passes no id — output must be EXACTLY the
    // pre-change markup so existing bridge contract tests and any cached
    // published snippets stay valid.
    expect(renderBlockHtml({ kind: "text", text: "Hello", style: "paragraph" })).toBe(
      '<p class="taya-block taya-block-text">Hello</p>',
    );
    expect(renderBlockHtml({ kind: "text", text: "Hello", style: "paragraph" }, undefined)).toBe(
      '<p class="taya-block taya-block-text">Hello</p>',
    );
  });

  it("escapes the id attribute (defense-in-depth)", () => {
    const html = renderBlockHtml({ kind: "text", text: "x", style: "paragraph" }, "<script>");
    expect(html).toContain('data-taya-block-id="&lt;script&gt;"');
    expect(html).not.toContain("<script>");
  });

  it("renderZoneHtml keeps the [data-taya-zone] wrapper (frame zone lookup unchanged)", () => {
    const inner = renderBlockHtml({ kind: "text", text: "A", style: "paragraph" }, "blk1");
    const zone = renderZoneHtml("video-section", [inner]);
    expect(zone).toContain('data-taya-zone="video-section"');
    expect(zone).toContain('data-taya-block-id="blk1"');
    const disc = renderZoneHtml("content", [inner]);
    expect(disc).toContain('data-taya-zone="content"');
    expect(disc.startsWith("<div")).toBe(true);
  });
});
