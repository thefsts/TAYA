/**
 * Corsair Tactical Solutions — Square REST helpers (SERVER ONLY)
 * ------------------------------------------------------------------
 * Thin wrappers around the Square REST API using native fetch (no SDK).
 * Reads SQUARE_ACCESS_TOKEN only from the environment — never logs it and
 * never sends it to the browser. Import this only from server routes and
 * Node scripts.
 */

import { randomUUID } from 'crypto';
import type { CatalogItem } from '@/lib/pricing';

export const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';

export const SQUARE_BASE_URL =
  SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

export const SQUARE_VERSION = '2024-11-20';

export function isSquareConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

export async function squareFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SQUARE_ACCESS_TOKEN is not configured');
  }
  return fetch(`${SQUARE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Square-Version': SQUARE_VERSION,
      ...(init.headers ?? {}),
    },
  });
}

export function newIdempotencyKey(): string {
  return randomUUID();
}

/* ── Locations ───────────────────────────────────────────────────────────── */

export interface SquareLocation {
  id: string;
  name: string;
  status?: string;
}

export async function listLocations(): Promise<SquareLocation[]> {
  const res = await squareFetch('/v2/locations', { method: 'GET' });
  const data = (await res.json()) as {
    locations?: SquareLocation[];
    errors?: Array<{ detail?: string }>;
  };
  if (!res.ok || data.errors?.length) {
    throw new Error(data.errors?.[0]?.detail ?? `Square locations error (${res.status})`);
  }
  return data.locations ?? [];
}

/* ── Catalog ─────────────────────────────────────────────────────────────── */

export interface SquareCatalogVariation {
  id: string;
  name: string;
  priceCents: number | null;
}

export interface SquareCatalogItem {
  id: string;
  name: string;
  variations: SquareCatalogVariation[];
  isDeleted: boolean;
}

interface RawCatalogObject {
  type: string;
  id: string;
  is_deleted?: boolean;
  item_data?: {
    name?: string;
    variations?: Array<{
      id: string;
      is_deleted?: boolean;
      item_variation_data?: {
        name?: string;
        price_money?: { amount?: number; currency?: string };
      };
    }>;
  };
}

export async function listCatalogItems(): Promise<SquareCatalogItem[]> {
  const items: SquareCatalogItem[] = [];
  let cursor: string | undefined;

  do {
    const qs = new URLSearchParams({ types: 'ITEM' });
    if (cursor) qs.set('cursor', cursor);
    const res = await squareFetch(`/v2/catalog/list?${qs.toString()}`, { method: 'GET' });
    const data = (await res.json()) as {
      objects?: RawCatalogObject[];
      cursor?: string;
      errors?: Array<{ detail?: string }>;
    };
    if (!res.ok || data.errors?.length) {
      throw new Error(data.errors?.[0]?.detail ?? `Square catalog error (${res.status})`);
    }
    for (const obj of data.objects ?? []) {
      if (obj.type !== 'ITEM') continue;
      items.push({
        id: obj.id,
        name: obj.item_data?.name ?? '',
        isDeleted: Boolean(obj.is_deleted),
        variations: (obj.item_data?.variations ?? []).map((v) => ({
          id: v.id,
          name: v.item_variation_data?.name ?? '',
          priceCents: v.item_variation_data?.price_money?.amount ?? null,
        })),
      });
    }
    cursor = data.cursor;
  } while (cursor);

  return items;
}

/** Create a Square catalog ITEM with one variation per payable option. */
export async function createCatalogItem(item: CatalogItem): Promise<{ id: string }> {
  const objectId = `#${item.id}`;
  const body = {
    idempotency_key: newIdempotencyKey(),
    object: {
      type: 'ITEM',
      id: objectId,
      item_data: {
        name: item.name,
        description: item.description,
        variations: item.variations.map((v) => ({
          type: 'ITEM_VARIATION',
          id: `#${item.id}_${v.id}`,
          item_variation_data: {
            name: v.name,
            pricing_type: 'FIXED_PRICING',
            price_money: { amount: v.priceCents, currency: item.currency },
          },
        })),
      },
    },
  };

  const res = await squareFetch('/v2/catalog/object', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    catalog_object?: { id: string };
    errors?: Array<{ detail?: string }>;
  };
  if (!res.ok || data.errors?.length) {
    throw new Error(data.errors?.[0]?.detail ?? `Square upsert error (${res.status})`);
  }
  return { id: data.catalog_object?.id ?? '' };
}

/* ── Catalog comparison (website ⇄ Square) ───────────────────────────────── */

export interface FeeMismatch {
  slug: string;
  name: string;
  feeId: string;
  feeLabel: string;
  kind: 'required-fee' | 'optional-addon';
  websiteCents: number;
  squareCents: number | null;
  status: 'missing-in-square' | 'price-mismatch';
}

export interface CatalogComparison {
  matched: Array<{ slug: string; name: string }>;
  missingInSquare: Array<{ slug: string; name: string }>;
  priceMismatches: Array<{
    slug: string;
    name: string;
    variation: string;
    websiteCents: number;
    squareCents: number | null;
  }>;
  feeMismatches: FeeMismatch[];
  addonMismatches: FeeMismatch[];
  duplicatesInSquare: Array<{ name: string; count: number }>;
  inactiveInSquare: Array<{ id: string; name: string }>;
}

function norm(name: string): string {
  return name.trim().toLowerCase();
}

/** Compares only payable website items (those with variations) against Square. */
export function compareCatalog(
  website: CatalogItem[],
  square: SquareCatalogItem[]
): CatalogComparison {
  const comparison: CatalogComparison = {
    matched: [],
    missingInSquare: [],
    priceMismatches: [],
    feeMismatches: [],
    addonMismatches: [],
    duplicatesInSquare: [],
    inactiveInSquare: [],
  };

  // Index Square items by normalized name.
  const byName = new Map<string, SquareCatalogItem[]>();
  for (const s of square) {
    const key = norm(s.name);
    const list = byName.get(key) ?? [];
    list.push(s);
    byName.set(key, list);
    if (s.isDeleted) comparison.inactiveInSquare.push({ id: s.id, name: s.name });
  }

  for (const [key, list] of byName) {
    if (list.length > 1) {
      comparison.duplicatesInSquare.push({ name: list[0].name, count: list.length });
    }
    void key;
  }

  const payable = website.filter((w) => w.variations.length > 0 && !w.contactOnly);
  for (const w of payable) {
    const matches = byName.get(norm(w.name));
    if (!matches || matches.length === 0) {
      comparison.missingInSquare.push({ slug: w.slug, name: w.name });
      continue;
    }
    comparison.matched.push({ slug: w.slug, name: w.name });

    const squareItem = matches[0];
    for (const v of w.variations) {
      const sv = squareItem.variations.find((x) => norm(x.name) === norm(v.name));
      if (!sv || sv.priceCents !== v.priceCents) {
        comparison.priceMismatches.push({
          slug: w.slug,
          name: w.name,
          variation: v.name,
          websiteCents: v.priceCents,
          squareCents: sv?.priceCents ?? null,
        });
      }
    }
  }


  // ── Required fees & optional add-on catalog comparison ──────────────────
  // Fees/add-ons may be modelled as separate Square ITEM_VARIATION or
  // ITEM entries. We look for a Square item whose normalised name matches
  // the fee/add-on label. Report missing or price-mismatched entries so the
  // operator can align the Square catalog.
  for (const w of payable) {
    for (const fee of (w.requiredFees ?? [])) {
      const feeMatches = byName.get(norm(fee.label));
      if (!feeMatches || feeMatches.length === 0) {
        comparison.feeMismatches.push({
          slug: w.slug, name: w.name,
          feeId: fee.id, feeLabel: fee.label, kind: 'required-fee',
          websiteCents: fee.amountCents, squareCents: null,
          status: 'missing-in-square',
        });
        continue;
      }
      const sv = feeMatches[0].variations[0];
      if (sv && sv.priceCents !== fee.amountCents) {
        comparison.feeMismatches.push({
          slug: w.slug, name: w.name,
          feeId: fee.id, feeLabel: fee.label, kind: 'required-fee',
          websiteCents: fee.amountCents, squareCents: sv.priceCents,
          status: 'price-mismatch',
        });
      }
    }
    for (const addon of (w.optionalAddOns ?? [])) {
      const addonMatches = byName.get(norm(addon.label));
      if (!addonMatches || addonMatches.length === 0) {
        comparison.addonMismatches.push({
          slug: w.slug, name: w.name,
          feeId: addon.id, feeLabel: addon.label, kind: 'optional-addon',
          websiteCents: addon.amountCents, squareCents: null,
          status: 'missing-in-square',
        });
        continue;
      }
      const sv = addonMatches[0].variations[0];
      if (sv && sv.priceCents !== addon.amountCents) {
        comparison.addonMismatches.push({
          slug: w.slug, name: w.name,
          feeId: addon.id, feeLabel: addon.label, kind: 'optional-addon',
          websiteCents: addon.amountCents, squareCents: sv.priceCents,
          status: 'price-mismatch',
        });
      }
    }
  }

  return comparison;
}

/** Shared admin guard for catalog-check / catalog-sync routes. */
export function isAdminAuthorized(request: Request): boolean {
  const expected = process.env.SQUARE_ADMIN_TOKEN;
  const provided = request.headers.get('x-admin-token');
  if (!expected) {
    // No admin token configured: allow only outside production.
    return process.env.NODE_ENV !== 'production';
  }
  return Boolean(provided) && provided === expected;
}
