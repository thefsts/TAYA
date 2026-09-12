/**
 * CHAT B — Video URL parsing (§3 video editing).
 *
 * CANONICAL module (server-side). The dashboard mirror is
 * lib/web-bridge/src/videoEmbeds.ts — behavior parity is pinned by the
 * web-bridge contract test (same discipline as safeLinks / key grammar).
 *
 * PURE LIBRARY — no Convex ctx, no network, no per-customer logic.
 *
 * Contract (§3): a video is a PROVIDER-PARSED YouTube or Vimeo URL —
 * never arbitrary embed HTML. The editor flow is: paste URL → parse
 * provider → preview → choose safe placement → save draft → publish.
 *
 * parseVideoUrl(raw) →
 *   { ok: true, provider: "youtube"|"vimeo", videoId, embedUrl, watchUrl } |
 *   { ok: false, reason }        (client-safe reason, no raw echo)
 *
 * YouTube forms accepted (videoId: [A-Za-z0-9_-]{6,15}):
 *   youtube.com/watch?v=ID          youtu.be/ID
 *   m.youtube.com/…                 music.youtube.com/watch?v=ID
 *   youtube.com/shorts/ID           www.youtube-nocookie.com/embed/ID
 *   youtube.com/embed/ID            youtube.com/live/ID
 * Vimeo forms accepted (videoId: digits, ≤12):
 *   vimeo.com/ID                    player.vimeo.com/video/ID
 *   vimeo.com/ID?hash=… kept on the embed URL (unlisted support)
 *
 * Everything else (including <iframe src=…>, javascript:, raw IDs with no
 * host) is REJECTED — no arbitrary embed HTML ever reaches storage.
 */

export type VideoProvider = "youtube" | "vimeo";

export interface ParsedVideo {
  ok: true;
  provider: VideoProvider;
  videoId: string;
  /** Provider embed URL (nocookie for YouTube — privacy-safe default). */
  embedUrl: string;
  /** Canonical watch URL for humans (link-card target). */
  watchUrl: string;
}

export interface RejectedVideo {
  ok: false;
  reason: string;
}

export type VideoResult = ParsedVideo | RejectedVideo;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,15}$/;
const VIMEO_ID = /^\d{1,12}$/;

export function parseVideoUrl(raw: string): VideoResult {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: false, reason: "Paste a YouTube or Vimeo link." };
  if (value.length > 2048) return { ok: false, reason: "That video link is too long." };

  // Hard rejection for anything that smells like pasted embed HTML/JS.
  const lower = value.toLowerCase();
  if (lower.startsWith("<") || lower.includes("<iframe") || lower.includes("<script") ||
      lower.startsWith("javascript:") || lower.startsWith("data:")) {
    return { ok: false, reason: "Paste the video's share link — embed code isn't allowed." };
  }

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return { ok: false, reason: "That isn't a valid video link." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only YouTube and Vimeo links are supported." };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // ── YouTube ────────────────────────────────────────────────────────────
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" ||
      host === "youtube-nocookie.com" || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const segs = url.pathname.split("/").filter(Boolean);
      const marker = segs[0];
      if (marker === "shorts" || marker === "embed" || marker === "live" || marker === "v") {
        id = segs[1] ?? null;
      }
    }
    if (!id || !YOUTUBE_ID.test(id)) {
      return { ok: false, reason: "That YouTube link doesn't include a valid video." };
    }
    return {
      ok: true,
      provider: "youtube",
      videoId: id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }

  // ── Vimeo ──────────────────────────────────────────────────────────────
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    let id: string | null = null;
    let hash: string | null = url.searchParams.get("h");
    if (host === "player.vimeo.com") {
      const segs = url.pathname.split("/").filter(Boolean);
      if (segs[0] === "video") id = segs[1] ?? null;
    } else {
      const segs = url.pathname.split("/").filter(Boolean);
      // vimeo.com/ID and vimeo.com/ID/anything (channel/unlisted paths) —
      // the first numeric segment is the video. Unlisted privacy hashes
      // ride the SECOND path segment (vimeo.com/ID/HASH, the modern share
      // form) or the ?h= query — both must survive to the embed URL.
      for (let i = 0; i < segs.length; i++) {
        if (VIMEO_ID.test(segs[i])) {
          id = segs[i];
          const next = segs[i + 1] ?? "";
          if (i === 0 && next !== "" && /^[0-9a-f]{6,16}$/i.test(next)) {
            hash = next;
          }
          break;
        }
      }
    }
    if (!id || !VIMEO_ID.test(id)) {
      return { ok: false, reason: "That Vimeo link doesn't include a valid video." };
    }
    const embedUrl = hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}`
      : `https://player.vimeo.com/video/${id}`;
    return {
      ok: true,
      provider: "vimeo",
      videoId: id,
      embedUrl,
      watchUrl: `https://vimeo.com/${id}`,
    };
  }

  return { ok: false, reason: "Only YouTube and Vimeo links are supported." };
}
