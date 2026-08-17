/**
 * Shared price display formatter for the FSTS dashboard.
 *
 * Single source of truth — import this everywhere a price needs to be shown.
 * Never use raw arithmetic like `$${(cents / 100).toFixed(2)}` in JSX.
 */

/**
 * Format a cents value as a localized currency string.
 *
 * Fallback behaviour (ordered):
 *   - null / undefined / NaN / Infinite → "Contact for pricing"
 *   - 0                                 → "Free"
 *   - positive integer                  → "$X.XX" (USD by default)
 *
 * @param cents    - price in minor units (integer), or null/undefined for unknown
 * @param currency - ISO 4217 currency code (default "USD")
 */
export function formatPrice(
  cents: number | null | undefined,
  currency = "USD",
): string {
  if (cents == null || !isFinite(cents as number) || isNaN(cents as number)) {
    return "Contact for pricing";
  }
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format((cents as number) / 100);
}

/**
 * Normalize a legacy string price to cents (integer), or return null.
 * Use this when consuming the `services.price` string field client-side.
 *
 * "$99" → 9900
 * "99.00" → 9900
 * "Free" / "" / null → null
 */
export function parsePriceStringToCents(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const dollars = parseFloat(cleaned);
  if (!isFinite(dollars) || isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}
