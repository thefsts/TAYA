/**
 * Bridge API — typed fetch wrappers for the four TAYA endpoints.
 *
 * Used by the dashboard (typed client) and by tests. The embed snippet
 * (snippet.ts) does NOT import this — it is self-contained vanilla JS so
 * any external site can paste it without a bundler.
 */

import {
  BRIDGE_PARAM_SLUG,
  BRIDGE_PARAM_TOKEN,
  BRIDGE_PATH_CLICK,
  BRIDGE_PATH_CONTENT,
  BRIDGE_PATH_DRAFT,
  BRIDGE_PATH_VERIFY,
} from "./contract";

export interface BridgeContentResponse {
  version: number;
  bridgeVersion: number;
  domain: string;
  mode: string | null;
  publishedAt: number | null;
  pages: Array<{ path: string; label: string; title: string | null; keyCount: number }>;
  values: Record<string, string>;
}

export interface BridgeDraftResponse extends BridgeContentResponse {
  drafts: Record<string, string>;
}

export interface BridgeVerifyResponse {
  slug: string;
  matches: boolean;
  method: string | null;
  state: string;
  bridgeVersion: number;
}

function buildUrl(base: string, path: string, params: Record<string, string>) {
  const url = new URL(base.replace(/\/+$/, "") + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Fetch the PUBLISHED values for a site (never drafts). */
export async function fetchPublished(
  httpBase: string,
  slug: string,
): Promise<BridgeContentResponse | null> {
  const res = await fetch(buildUrl(httpBase, BRIDGE_PATH_CONTENT, { [BRIDGE_PARAM_SLUG]: slug }));
  if (!res.ok) return null;
  return (await res.json()) as BridgeContentResponse;
}

/** Fetch published + draft overlay (requires the site's verification token). */
export async function fetchDraftPreview(
  httpBase: string,
  slug: string,
  token: string,
): Promise<BridgeDraftResponse | null> {
  const res = await fetch(
    buildUrl(httpBase, BRIDGE_PATH_DRAFT, {
      [BRIDGE_PARAM_SLUG]: slug,
      [BRIDGE_PARAM_TOKEN]: token,
    }),
  );
  if (!res.ok) return null;
  return (await res.json()) as BridgeDraftResponse;
}

/** POST the ownership ping (bridge_token method round-trip). */
export async function postVerifyPing(
  httpBase: string,
  slug: string,
  token: string,
): Promise<BridgeVerifyResponse | null> {
  const res = await fetch(buildUrl(httpBase, BRIDGE_PATH_VERIFY, {}), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, token }),
  });
  if (!res.ok) return null;
  return (await res.json()) as BridgeVerifyResponse;
}

/** Report a click on a bridge key. */
export async function reportClick(
  httpBase: string,
  slug: string,
  key: string,
  extra?: { type?: string; path?: string },
): Promise<{ ok: boolean; clicks: number } | null> {
  const res = await fetch(buildUrl(httpBase, BRIDGE_PATH_CLICK, {}), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [BRIDGE_PARAM_SLUG]: slug,
      key,
      ...(extra?.type ? { type: extra.type } : {}),
      ...(extra?.path ? { path: extra.path } : {}),
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { ok: boolean; clicks: number };
}
