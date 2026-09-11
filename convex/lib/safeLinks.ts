/**
 * CHAT B — Safe link classification + validation (§2 button/link editing).
 *
 * CANONICAL module (server-side). The dashboard mirror is
 * lib/web-bridge/src/safeLinks.ts — the web-bridge contract test pins
 * behavior parity between the two files, exactly as it does for the
 * §5 key grammar. Both must stay hand-mirrored.
 *
 * PURE LIBRARY — no Convex ctx, no network, no per-customer logic.
 *
 * Contract:
 *   classifyLink(raw) classifies an edited link/button destination into a
 *   safe kind and returns a normalized value to store, or a client-safe
 *   rejection reason. It is used by:
 *     - the Visual Editor Destination control (inline validation),
 *     - publishing.saveDraft (server-side guard on href-bearing entries),
 *     - editorZones block writes (button/cta/link blocks).
 *
 * Accepted kinds (§2: internal route / external URL / phone link / email
 * link / download link — the download kind resolves against a site
 * resource URL upstream; here it is an ordinary http(s)/internal value):
 *   - ""            clearing the link (empty is valid — never stores junk)
 *   - "#"/fragment  harmless in-page anchor (kept verbatim)
 *   - "/path"       internal route (leading slash, no scheme, no //)
 *   - "tel:..."     phone link — digits, spaces, + ( ) . - and an optional
 *                   extension syntax; normalized to compact tel: form
 *   - "mailto:..."  email link — one valid address, optional ?subject=
 *   - "http(s)://…" external URL — http/https only, no credentials, no
 *                   control characters, host must parse, ≤2048 chars
 *
 * Rejected (client-safe reason, never echoing the raw input):
 *   - javascript:, data:, blob:, file:, vbscript:, and every other scheme
 *   - protocol-relative "//evil.com" (scheme smuggling)
 *   - URLs with embedded credentials (user:pass@host)
 *   - control characters / whitespace smuggling inside URLs
 *   - malformed hosts, malformed mailto/tel payloads, oversize values
 */

export type SafeLinkKind = "internal" | "external" | "phone" | "email" | "anchor";

export interface SafeLinkOk {
  ok: true;
  kind: SafeLinkKind;
  /** Value to store (normalized; empty string when cleared). */
  normalized: string;
}

export interface SafeLinkReject {
  ok: false;
  /** Client-safe reason — no raw input, no internal details. */
  reason: string;
}

export type SafeLinkResult = SafeLinkOk | SafeLinkReject;

/** Max stored link length (matches the discovery MAX_URL cap). */
export const MAX_LINK_LENGTH = 2048;

const EXTERNAL_SCHEMES = ["http:", "https:"];

/** Control chars + Unicode line separators (URL smuggling). */
const CONTROL_CHARS = /[\u0000-\u001f\u007f\u2028\u2029]/;

// ─────────────────────────────────────────────────────────────────────────────
// tel: validation
// ─────────────────────────────────────────────────────────────────────────────

/** Phone charset: digits, spaces, +, ( ) . - x X (extension marker). */
const PHONE_BODY = /^[+()\d\s.\-xX]+$/;

function classifyPhone(raw: string): SafeLinkResult {
  const body = raw.slice("tel:".length).trim();
  if (body === "") return { ok: false, reason: "Phone number can't be empty." };
  if (body.length > 40) return { ok: false, reason: "That phone number is too long." };
  if (!PHONE_BODY.test(body)) {
    return { ok: false, reason: "Phone links can only contain numbers, spaces, and ( ) . - + characters." };
  }
  if (!body.match(/\d/)) {
    return { ok: false, reason: "That phone number doesn't contain any digits." };
  }
  // Normalize: tel:+15551234567 style — strip spaces and visual separators.
  const compact = body.replace(/[()\s.\-]/g, "");
  return { ok: true, kind: "phone", normalized: `tel:${compact}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// mailto: validation
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_BODY = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

function classifyEmail(raw: string): SafeLinkResult {
  const rest = raw.slice("mailto:".length);
  // Optional ?subject= (or other single query) — validate address only.
  const qIndex = rest.indexOf("?");
  const address = (qIndex === -1 ? rest : rest.slice(0, qIndex)).trim();
  const query = qIndex === -1 ? "" : rest.slice(qIndex + 1);
  if (address === "") return { ok: false, reason: "Email address can't be empty." };
  if (address.length > 320) return { ok: false, reason: "That email address is too long." };
  if (!EMAIL_BODY.test(address)) {
    return { ok: false, reason: "That doesn't look like a valid email address." };
  }
  if (query !== "" && !/^[a-zA-Z0-9%\-_.=~&]+$/.test(query)) {
    return { ok: false, reason: "That email link has invalid extra settings." };
  }
  return { ok: true, kind: "email", normalized: query === "" ? `mailto:${address}` : `mailto:${address}?${query}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// http(s) validation
// ─────────────────────────────────────────────────────────────────────────────

function classifyExternal(raw: string): SafeLinkResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "That web address isn't formatted correctly." };
  }
  if (!EXTERNAL_SCHEMES.includes(url.protocol)) {
    // Unreachable in practice (we only call for http/https inputs), kept as
    // a belt-and-braces guard.
    return { ok: false, reason: "Only http:// and https:// web addresses are allowed." };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "Web addresses with a sign-in can't be used." };
  }
  const host = url.hostname;
  // Host must look like a real domain: a dot with non-empty labels on both
  // sides (rejects ".com", "example.", "a..b" — dotless or empty-label
  // hosts that would never resolve for a client's visitor).
  if (
    !host ||
    host.length > 253 ||
    !host.includes(".") ||
    host.startsWith(".") ||
    host.endsWith(".") ||
    host.includes("..")
  ) {
    return { ok: false, reason: "That web address is missing a valid domain." };
  }
  // Store the parsed, normalized form (trailing slash on bare hosts, etc.).
  return { ok: true, kind: "external", normalized: url.toString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// internal route validation
// ─────────────────────────────────────────────────────────────────────────────

function classifyInternal(raw: string): SafeLinkResult {
  // Must start with "/" and never "//" (protocol-relative smuggling).
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return { ok: false, reason: "Internal links start with a / like /services." };
  }
  if (raw.length > 512) return { ok: false, reason: "That internal link is too long." };
  if (CONTROL_CHARS.test(raw)) {
    return { ok: false, reason: "That link contains characters that can't be used." };
  }
  return { ok: true, kind: "internal", normalized: raw };
}

// ─────────────────────────────────────────────────────────────────────────────
// public API
// ─────────────────────────────────────────────────────────────────────────────

export function classifyLink(raw: string): SafeLinkResult {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: true, kind: "anchor", normalized: "" };
  if (value.length > MAX_LINK_LENGTH) {
    return { ok: false, reason: "That link is too long (over 2,000 characters)." };
  }
  if (CONTROL_CHARS.test(value)) {
    return { ok: false, reason: "That link contains characters that can't be used." };
  }

  const lower = value.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("blob:") ||
      lower.startsWith("file:") || lower.startsWith("vbscript:")) {
    return { ok: false, reason: "That link type isn't allowed for safety." };
  }

  // Scheme-bearing values: only tel:, mailto:, http:, https: pass.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(value);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "tel") return classifyPhone(value);
    if (scheme === "mailto") return classifyEmail(value);
    if (scheme === "http" || scheme === "https") return classifyExternal(value);
    return { ok: false, reason: "Only web, phone, and email links are allowed." };
  }

  // No scheme: in-page anchor, or internal route, or a bare host
  // ("example.com" — upgrade to https://), or rejected.
  if (value.startsWith("#")) return { ok: true, kind: "anchor", normalized: value };
  if (value.startsWith("/")) return classifyInternal(value);
  if (value.startsWith("//")) return { ok: false, reason: "That link type isn't allowed for safety." };
  // Bare domain: upgrade to https (never http, never scheme-relative).
  if (/^[a-zA-Z][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}(\/|$|\?|#)/.test(value)) {
    return classifyExternal(`https://${value}`);
  }
  return { ok: false, reason: "That doesn't look like a valid link. Use a /page path, web address, phone, or email." };
}
