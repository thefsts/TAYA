/**
 * Price normalization helpers for the Convex backend.
 *
 * Storage canonical form: integer minor-units (priceCents: number).
 * These helpers coerce legacy string prices and guard against invalid values
 * at the API boundary so NaN/undefined never escapes to the browser.
 */

/**
 * Coerce any stored price representation to an integer cents value, or null
 * when the input is absent, non-numeric, NaN, or Infinite.
 *
 * Handles:
 *   - number  → rounded integer (already in cents)
 *   - string  → parse as dollars and multiply by 100 (legacy `price` field)
 *   - null/undefined → null
 */
export function normalizePriceCents(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!isFinite(value) || isNaN(value)) return null;
    return Math.round(value);
  }
  if (typeof value === "string") {
    // Strip currency symbols, commas, and extra whitespace
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const dollars = parseFloat(cleaned);
    if (!isFinite(dollars) || isNaN(dollars)) return null;
    return Math.round(dollars * 100);
  }
  return null;
}

/**
 * Validate that a priceCents value is safe to pass to a payment provider.
 * Throws a descriptive error if the value would cause a broken checkout.
 *
 * @param cents - the priceCents value being submitted
 * @param label - human-readable name for the error message (e.g. "course price")
 */
export function assertValidPriceCents(
  cents: number | null | undefined,
  label = "price",
): void {
  if (cents == null) return; // null/undefined = free / contact-for-pricing; allowed
  if (typeof cents !== "number" || !isFinite(cents) || isNaN(cents)) {
    throw new Error(
      `Invalid ${label}: received ${String(cents)} — only a finite integer (cents) is accepted.`,
    );
  }
  if (cents < 0) {
    throw new Error(`Invalid ${label}: negative price (${cents} cents) is not allowed.`);
  }
  if (!Number.isInteger(cents)) {
    throw new Error(
      `Invalid ${label}: ${cents} is not an integer. Price must be in whole cents (e.g. $9.99 → 999).`,
    );
  }
}
