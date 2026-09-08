/**
 * PHASE 2 — Ownership verification primitives (spec §15–§16, PR-2).
 *
 * PURE NETWORK CHECKS — the proof functions that a client actually controls
 * the domain they claim. Three server-verified methods:
 *
 *   dns_txt         — a TXT record "taya-verification=<token>" (or the bare
 *                     token) on the site's domain proves DNS control.
 *   html_meta_token — a <meta name="taya-verification" content="<token>"> tag
 *                     on the site's homepage proves HTML control.
 *   bridge_token    — the website-side TAYA bridge (lib/web-bridge) serving
 *                     the token through its verify ping proves a live
 *                     deployment connection.
 *
 * §14 discipline: every check returns an explicit, human-readable result —
 * verified or failed WITH a reason. There is no silent pass and no silent
 * fail. A network error is a failed check ("check failed — retry"), never
 * a fake "verified".
 *
 * These primitives are used by BOTH:
 *   - convex/ownershipVerification.ts (the public action the dashboard calls),
 *   - convex/migrations/thirdSiteProof.ts (the guarded end-to-end proof
 *     harness run against real production records).
 *
 * READ-ONLY: every method performs only reads (DNS query, GET fetch, GET
 * ping). Nothing is written to the client's website.
 */

import { fetchPage } from "./discovery/crawl";

// ─────────────────────────────────────────────────────────────────────────────
// Shared result + token types
// ─────────────────────────────────────────────────────────────────────────────

/** The verification methods TAYA offers (§15 "approved" method set). */
export type VerificationMethod =
  | "dns_txt"
  | "html_meta_token"
  | "bridge_token"
  | "repo_connector"
  | "platform_api";

/** All methods a site owner can self-serve (no operator approval needed). */
export const SELF_SERVE_METHODS: readonly VerificationMethod[] = [
  "dns_txt",
  "html_meta_token",
  "bridge_token",
];

/** The exact DNS TXT record value pattern we look for. */
export const DNS_VERIFICATION_PREFIX = "taya-verification=";

/** The exact <meta> tag name we look for on the homepage. */
export const HTML_META_NAME = "taya-verification";

/** Result of one network verification attempt. */
export interface VerificationCheckResult {
  ok: boolean;
  /** Human-readable reason on failure (§14); null on success. */
  reason: string | null;
  /** Evidence recorded on success (what was actually seen). */
  evidence: string;
}

/** Verification token: the shared secret the client publishes. */
export const VERIFICATION_TOKEN_PATTERN = /^[a-z0-9]{12,64}$/i;

/**
 * Generate a fresh verification token. Uses crypto.randomUUID when present
 * (Node ≥ 19 / edge runtimes), else a crypto.getRandomValues fallback. The
 * token never needs to be cryptographically strong — it is a shared secret
 * between TAYA and the domain owner, not a session credential — but it must
 * be unguessable enough that a competitor can't claim the domain first.
 */
export function generateVerificationToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Last-resort fallback (deterministic environments only) — never used in
  // production (Node 20+ / Convex actions always have crypto.randomUUID).
  return Math.random().toString(36).slice(2).padStart(32, "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// DNS TXT check (DNS-over-HTTPS — works from a Convex action)
// ─────────────────────────────────────────────────────────────────────────────

/** Result shape of the DNS-over-HTTPS JSON API. */
interface DohResponse {
  Status?: number;
  Answer?: Array<{ name: string; type: number; data: string }>;
}

/**
 * Check for the verification TXT record on the domain via DNS-over-HTTPS.
 * Convex actions cannot do raw UDP DNS — DoH (RFC 8484 JSON API) is the
 * portable standard: https://dns.google/resolve?name=<domain>&type=TXT
 *
 * A match is EITHER the prefixed form ("taya-verification=<token>") or the
 * bare token as a TXT record value.
 */
export async function checkDnsTxt(
  domain: string,
  token: string,
): Promise<VerificationCheckResult> {
  const name = domain.trim().toLowerCase();
  if (!name) {
    return { ok: false, reason: "No domain recorded on the site.", evidence: "" };
  }
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) {
    return { ok: false, reason: "Invalid verification token.", evidence: "" };
  }
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: `DNS lookup failed (HTTP ${res.status}).`,
        evidence: "",
      };
    }
    const body = (await res.json()) as DohResponse;
    // Status 0 = NOERROR. Status 3 = NXDOMAIN. Others = server failure.
    if (typeof body.Status === "number" && body.Status !== 0) {
      return {
        ok: false,
        reason:
          body.Status === 3
            ? `Domain "${name}" does not exist (NXDOMAIN).`
            : `DNS lookup returned status ${body.Status}.`,
        evidence: "",
      };
    }
    const records = (body.Answer ?? []).filter((a) => a.type === 16); // TXT = 16
    if (records.length === 0) {
      return {
        ok: false,
        reason: "No TXT records found on the domain.",
        evidence: "",
      };
    }
    for (const record of records) {
      const data = record.data.replace(/^"|"$/g, "").trim(); // TXT values are quoted
      const expected = `${DNS_VERIFICATION_PREFIX}${token}`;
      if (data === token || data.toLowerCase() === expected.toLowerCase()) {
        return {
          ok: true,
          reason: null,
          evidence: `TXT "${data}" on ${name}`,
        };
      }
    }
    return {
      ok: false,
      reason: `TXT record not found. Expected "${DNS_VERIFICATION_PREFIX}${token}" (or the bare token) on ${name}.`,
      evidence: "",
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: `DNS check failed: ${error?.message?.slice(0, 120) ?? "network error"}`,
      evidence: "",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML meta-token check (GET homepage, scan <head>)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check for the verification meta tag on the site's homepage. Uses the same
 * polite read-only fetch as the discovery crawl (fetchPage) — the client
 * simply adds <meta name="taya-verification" content="<token>"> to <head>.
 */
export async function checkHtmlMeta(
  domain: string,
  token: string,
): Promise<VerificationCheckResult> {
  const name = domain.trim().toLowerCase();
  if (!name) {
    return { ok: false, reason: "No domain recorded on the site.", evidence: "" };
  }
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) {
    return { ok: false, reason: "Invalid verification token.", evidence: "" };
  }
  const outcome = await fetchPage(`https://${name}`);
  if (!outcome.ok || !outcome.html) {
    return {
      ok: false,
      reason: `Could not fetch https://${name}: ${outcome.error ?? "unknown error"}`,
      evidence: "",
    };
  }
  const html = outcome.html;
  // <meta name="taya-verification" content="<token>"> — attribute order,
  // quoting, and casing may vary, so scan for the tag then read its content.
  const metaTag =
    new RegExp(`<meta[^>]*name\\s*=\\s*["']?${HTML_META_NAME}["']?[^>]*>`, "i").exec(
      html,
    )?.[0] ?? null;
  if (!metaTag) {
    return {
      ok: false,
      reason: `No <meta name="${HTML_META_NAME}"> tag found on the homepage.`,
      evidence: "",
    };
  }
  const contentAttr =
    /content\s*=\s*["']([^"']*)["']/i.exec(metaTag)?.[1] ?? null;
  if (!contentAttr) {
    return {
      ok: false,
      reason: `The <meta name="${HTML_META_NAME}"> tag has no content attribute.`,
      evidence: "",
    };
  }
  if (contentAttr.trim() !== token) {
    return {
      ok: false,
      reason: `Meta tag content "${contentAttr.trim()}" does not match the verification token.`,
      evidence: "",
    };
  }
  return {
    ok: true,
    reason: null,
    evidence: `<meta name="${HTML_META_NAME}" content="${token}"> on https://${name}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge token check (the website-side bridge serves the token)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check that the website-side TAYA bridge is deployed and serving the site's
 * verification token. The bridge's verify ping endpoint responds with the
 * token — proving a live deployment connection, not just DNS/file access.
 */
export async function checkBridgeToken(
  domain: string,
  token: string,
): Promise<VerificationCheckResult> {
  const name = domain.trim().toLowerCase();
  if (!name) {
    return { ok: false, reason: "No domain recorded on the site.", evidence: "" };
  }
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) {
    return { ok: false, reason: "Invalid verification token.", evidence: "" };
  }
  try {
    const res = await fetch(`https://${name}/api/bridge/verify`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: `Bridge endpoint not reachable (HTTP ${res.status}).`,
        evidence: "",
      };
    }
    const body: any = await res.json().catch(() => null);
    if (!body || typeof body.token !== "string") {
      return {
        ok: false,
        reason: "Bridge responded without a token.",
        evidence: "",
      };
    }
    if (body.token !== token) {
      return {
        ok: false,
        reason: "Bridge token does not match this site's verification token.",
        evidence: "",
      };
    }
    return {
      ok: true,
      reason: null,
      evidence: `Bridge verify ping from https://${name}/api/bridge/verify`,
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: `Bridge check failed: ${error?.message?.slice(0, 120) ?? "network error"}`,
      evidence: "",
    };
  }
}

/**
 * Run the network check for a SELF-SERVE method. Connector methods
 * (repo_connector / platform_api) are operator-approved, never
 * network-checked — they throw here (programmer error).
 */
export async function runSelfServeCheck(
  method: VerificationMethod,
  domain: string,
  token: string,
): Promise<VerificationCheckResult> {
  switch (method) {
    case "dns_txt":
      return checkDnsTxt(domain, token);
    case "html_meta_token":
      return checkHtmlMeta(domain, token);
    case "bridge_token":
      return checkBridgeToken(domain, token);
    default:
      throw new Error(
        `Method ${method} is operator-approved, not network-checkable.`,
      );
  }
}
