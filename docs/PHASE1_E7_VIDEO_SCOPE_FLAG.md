# Phase-1 · E7 — Video-by-URL: confirmed behavior + scope flag

Status: **CONFIRMED + FLAGGED** (no behavior change made)
Branch: `fsts/phase1-editor-completion`
Base: exact main @ `9f86e0168b2601ef631afbffc6205d63831e2ba8`

## What the REDO directive asked (E7)

> E7. Video-by-URL confirm + flag YouTube/Vimeo-only discrepancy
> (mission says Wistia/HTML5 but code is YouTube+Vimeo only).

## What the code actually does (verified by reading source, not assumed)

There are **two different** video surfaces in TAYA, and they have deliberately
different scope. The mission text collapses them into one phrase
("YouTube/Vimeo/Wistia/HTML5"); the code does not.

### 1. Editor INSERT (client pastes a URL to add a video) — YouTube + Vimeo ONLY

- Canonical module: `convex/lib/videoEmbeds.ts` → `parseVideoUrl(raw)`.
- Dashboard mirror: `lib/web-bridge/src/videoEmbeds.ts` (byte-for-byte parity of
  the `parseVideoUrl` body — verified via `diff`; pinned by
  `tests/convex-unit/src/web-bridge-contract.test.ts` §3).
- Type: `VideoProvider = "youtube" | "vimeo"` (there is no `wistia`/`html5`
  member in the editor provider union).
- Accepted hosts: `youtube.com`, `m.youtube.com`, `music.youtube.com`,
  `youtube-nocookie.com`, `youtu.be`, `vimeo.com`, `player.vimeo.com`.
- Everything else — including `<iframe src=…>`, `javascript:`, `data:`, and
  raw hostless IDs — is **rejected** with a client-safe reason.
- The module header states the contract explicitly:
  *"a video is a PROVIDER-PARSED YouTube or Vimeo URL — never arbitrary embed
  HTML."*

### 2. Discovery CRAWL (reading a site that already has videos) — wider set

- Module: `convex/lib/discovery/html.ts` → `VideoModel` + `VIDEO_HOSTS`.
- `VideoModel.source` is documented as
  `"youtube" | "vimeo" | "wistia" | "html5" | "embed"`.
- `VIDEO_HOSTS` additionally recognizes `wistia` (`wistia.com/net`, `wi.st`),
  `vidyard`, `dailymotion`, `loom`; `<video>` files are labeled `html5`;
  anything else degrades to `embed`.

## The discrepancy, stated precisely

The mission text's "YouTube/Vimeo/Wistia/HTML5" describes the **discovery**
capability (what TAYA can *read/recognize* on an existing site). It does **not**
describe the **editor insert** capability, which is intentionally narrowed to
provider-parsed YouTube + Vimeo so that no arbitrary third-party embed HTML can
ever reach storage. This is a **deliberate security boundary**, not a missing
feature.

## Decision taken (per REDO directive)

The REDO directive says: *"Do not silently invent missing implementation details
if the surviving mission/summary does not support them. If any part of E1–E9
cannot be reconstructed exactly from the surviving materials, flag that item
before implementing it."*

Therefore E7 **does not add** Wistia/HTML5 to the editor insert path. Doing so
would (a) contradict the explicit canonical contract in `videoEmbeds.ts`, and
(b) require implementation details (Wistia embed URL grammar, HTML5 `<video>`
src validation, storage/serving of uploaded files) that the surviving
mission/summary does **not** specify. Inventing those would violate the
directive.

**This item is flagged for PM review.** If the intent is to allow clients to
insert Wistia or self-hosted HTML5 videos, that is a **new scoped task** and
needs an explicit provider grammar + security review before implementation.

## Evidence / anchors

- `convex/lib/videoEmbeds.ts` (canonical `parseVideoUrl`, `VideoProvider`)
- `lib/web-bridge/src/videoEmbeds.ts` (dashboard mirror; parity verified)
- `convex/lib/discovery/html.ts` (`VideoModel`, `VIDEO_HOSTS`)
- `tests/convex-unit/src/web-bridge-contract.test.ts` §3 (accept/reject corpus + parity)
- Live UX evidence already present: `tests/live-ux/evidence/ah-C-video-youtube.png`,
  `ah-C-video-vimeo.png`, `ah-C-video-rejected.png`
