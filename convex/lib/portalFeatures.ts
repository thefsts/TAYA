/**
 * Client Portal™ enabled-feature key normalization.
 *
 * History: the original portal seeds (seedClient.ts / seedCorsair.ts) stored
 * feature flags under ad-hoc keys — `courseMaterials`, `bookingHistory`,
 * `messaging` — while the PortalManager admin UI and the member-facing
 * PortalDashboard both speak the canonical key set (`courses`, `events`,
 * `documents`, `messages`, `invoices`, `certificates`, `support`). Production
 * configs written by the seeds therefore never matched the dashboard's
 * lookups, so members saw no feature sections even though the admin believed
 * features were enabled.
 *
 * This module is the single source of truth for the canonical key set and for
 * mapping any legacy keys onto it. All portal reads (member view + admin view)
 * and all portal config writes normalize through here, so:
 *   - legacy-seeded configs keep working (read-time aliasing),
 *   - any save rewrites the config with canonical keys only (no drift),
 *   - the UI, seeds, and backend can never disagree about key names again.
 *
 * Semantics: an explicit canonical value always wins — even `false` — because
 * it represents a deliberate admin toggle. A legacy alias is only consulted
 * when the canonical key is absent. Unknown keys are dropped.
 */

/** Canonical member-portal feature keys (must match PortalManager toggles). */
export const PORTAL_FEATURE_KEYS = [
  "courses",
  "events",
  "documents",
  "messages",
  "invoices",
  "certificates",
  "support",
] as const;

export type PortalFeatureKey = (typeof PORTAL_FEATURE_KEYS)[number];

/**
 * Legacy seed-era keys → canonical key. `certificates` needs no alias because
 * the seed key already matches the canonical key.
 */
const LEGACY_ALIASES: Partial<Record<PortalFeatureKey, string[]>> = {
  courses: ["courseMaterials", "courses_materials", "myCourses"],
  events: ["bookingHistory", "booking_history", "myEvents"],
  messages: ["messaging", "messageCenter"],
};

/**
 * Normalize any raw enabledFeatures object (possibly null/undefined, possibly
 * containing legacy or unknown keys) into a Record keyed ONLY by canonical
 * feature keys with concrete booleans.
 */
export function normalizeEnabledFeatures(
  raw: Record<string, unknown> | null | undefined,
): Record<PortalFeatureKey, boolean> {
  const source: Record<string, unknown> = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<PortalFeatureKey, boolean>;
  for (const key of PORTAL_FEATURE_KEYS) {
    if (key in source) {
      out[key] = source[key] === true;
      continue;
    }
    const aliases = LEGACY_ALIASES[key] ?? [];
    const aliasHit = aliases.find((a) => a in source);
    out[key] = aliasHit ? source[aliasHit] === true : false;
  }
  return out;
}
