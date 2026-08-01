/**
 * VETSPOUSE2 fixed-cent discount tests — Task #337
 *
 * Confirms that the VETSPOUSE2 promo code correctly applies a fixed-cent
 * discount when the registry entry includes `fixedCents`, and falls back to
 * the percentage path when `fixedCents` is absent.
 *
 * Context:
 *   The validate-promo route builds the VETSPOUSE2 registry entry as:
 *     { fixedCents: getEnvCents('PROMO_VETSPOUSE2_CENTS'), percent: ... }
 *
 *   When PROMO_VETSPOUSE2_CENTS is set in the environment, getEnvCents returns
 *   a positive integer and `fixedCents` is defined. computePromoDiscount must
 *   apply Math.min(fixedCents, subtotal) rather than the percentage path.
 *   When PROMO_VETSPOUSE2_CENTS is absent, fixedCents is undefined and the
 *   percentage discount applies.
 *
 * These tests inject a deterministic registry so no environment variables or
 * network calls are required.
 */

import { describe, it, expect } from 'vitest';
import { computePromoDiscount, type PromoRule } from '@/lib/promo';

// ── Shared constants ──────────────────────────────────────────────────────────

/** Representative subtotal: one seat at $125.00 (tuition + range fee). */
const SUBTOTAL_CENTS = 12_500;

/** Shared eligibility fields that mirror the live registry entry. */
const SHARED_FIELDS = {
  eligibilityNote:
    'I confirm that I am the spouse of a current or former U.S. military service member.',
  requiresDeclaration: true,
  tuitionOnly: true,
  active: true,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. fixedCents path — applies when the registry entry includes fixedCents
// ═══════════════════════════════════════════════════════════════════════════════

describe('VETSPOUSE2 — fixedCents path (PROMO_VETSPOUSE2_CENTS set)', () => {
  const FIXED_CENTS = 1_500; // $15.00 fixed discount

  const registry: Record<string, PromoRule> = {
    VETSPOUSE2: {
      fixedCents: FIXED_CENTS,
      percent: 10,
      ...SHARED_FIELDS,
    },
  };

  it('returns valid=true when VETSPOUSE2 is submitted', () => {
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    expect(result.valid).toBe(true);
  });

  it('applies the fixed-cent amount, not the percentage', () => {
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    // fixedCents=1500 < subtotal=12500, so discount = 1500
    // (percentage path would yield floor(12500*10/100) = 1250 — different value)
    expect(result.discountCents).toBe(FIXED_CENTS);
  });

  it('caps the discount at the subtotal when fixedCents exceeds it', () => {
    const tinySubtotal = 500; // $5.00 — less than the $15 fixed discount
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: tinySubtotal,
      registry,
    });

    // Math.min(1500, 500) = 500 — never more than the order total
    expect(result.discountCents).toBe(tinySubtotal);
  });

  it('carries requiresDeclaration through the result', () => {
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    expect(result.requiresDeclaration).toBe(true);
  });

  it('carries eligibilityNote through the result', () => {
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    expect(result.eligibilityNote).toMatch(/spouse/i);
  });

  it('normalizes lower-case input to the canonical code', () => {
    const result = computePromoDiscount({
      promoCode: 'vetspouse2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    expect(result.valid).toBe(true);
    expect(result.normalizedCode).toBe('VETSPOUSE2');
    expect(result.discountCents).toBe(FIXED_CENTS);
  });

  it('returns valid=false when the code is deactivated', () => {
    const inactiveRegistry: Record<string, PromoRule> = {
      VETSPOUSE2: { fixedCents: FIXED_CENTS, percent: 10, ...SHARED_FIELDS, active: false },
    };

    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry: inactiveRegistry,
    });

    expect(result.valid).toBe(false);
    expect(result.discountCents).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Percentage fallback — applies when fixedCents is absent from the registry
// ═══════════════════════════════════════════════════════════════════════════════

describe('VETSPOUSE2 — percentage fallback (PROMO_VETSPOUSE2_CENTS not set)', () => {
  /** Registry without fixedCents — mirrors the env-variable-absent case. */
  const registry: Record<string, PromoRule> = {
    VETSPOUSE2: {
      percent: 10,
      ...SHARED_FIELDS,
    },
  };

  it('returns valid=true', () => {
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    expect(result.valid).toBe(true);
  });

  it('computes the percentage discount against the subtotal', () => {
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    // floor(12500 * 10 / 100) = 1250
    expect(result.discountCents).toBe(1_250);
  });

  it('scales the percentage discount correctly for a larger subtotal', () => {
    const twoSeatSubtotal = SUBTOTAL_CENTS * 2; // 25 000 cents
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 2,
      subtotalCents: twoSeatSubtotal,
      registry,
    });

    // floor(25000 * 10 / 100) = 2500
    expect(result.discountCents).toBe(2_500);
  });

  it('returns zero discount when subtotal is 0', () => {
    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: 0,
      registry,
    });

    expect(result.valid).toBe(true);
    expect(result.discountCents).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. fixedCents vs percent disambiguation
// ═══════════════════════════════════════════════════════════════════════════════

describe('VETSPOUSE2 — fixedCents takes precedence over percent', () => {
  it('uses fixedCents and ignores percent when both are present', () => {
    // When PROMO_VETSPOUSE2_CENTS is set, computePromoDiscount must use the
    // fixed amount even though a percent value is also on the rule.
    const registry: Record<string, PromoRule> = {
      VETSPOUSE2: {
        fixedCents: 2_000, // $20.00 fixed
        percent: 50,       // 50% — would yield 6250 on a 12500-cent subtotal
        ...SHARED_FIELDS,
      },
    };

    const result = computePromoDiscount({
      promoCode: 'VETSPOUSE2',
      attendeeCount: 1,
      subtotalCents: SUBTOTAL_CENTS,
      registry,
    });

    expect(result.discountCents).toBe(2_000);   // fixed, not 6250
    expect(result.discountCents).not.toBe(6_250);
  });
});
