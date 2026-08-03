/**
 * Timezone-aware date utilities for the lifecycle engine.
 *
 * Convex's V8 runtime has full `Intl.DateTimeFormat` support, so we use
 * offset math via `Intl.DateTimeFormat` to convert between UTC and a given
 * IANA timezone — no third-party library required.
 */

/**
 * Returns the current wall-clock time in the given IANA timezone expressed as
 * a Date whose `.getTime()` still returns UTC milliseconds — the date
 * arithmetic is done in timezone-local terms.
 *
 * For lifecycle comparisons, pass the entity's `timezone` field (e.g.
 * `"America/New_York"`). Falls back to `"UTC"` for any unrecognised timezone.
 *
 * @param timezone - IANA timezone string, e.g. "America/Chicago"
 * @param nowMs    - UTC timestamp in milliseconds (default: Date.now())
 * @returns UTC milliseconds whose wall-clock value matches the entity's
 *          local "now". Suitable for comparing against stored epoch timestamps.
 */
export function nowInTimezone(timezone: string, nowMs: number = Date.now()): number {
  return toLocalEpoch(timezone, nowMs);
}

/**
 * Converts an ISO 8601 string to a millisecond timestamp adjusted for the
 * entity's configured timezone. Useful when an entity stores a date as an
 * ISO string that should be interpreted in a specific timezone.
 *
 * @param isoString - ISO 8601 date string, e.g. "2026-09-01T09:00:00"
 * @param timezone  - IANA timezone string, e.g. "America/Los_Angeles"
 * @returns UTC epoch milliseconds representing that wall-clock time in the
 *          given timezone.
 */
export function toEntityLocalTime(isoString: string, timezone: string): number {
  // Parse as UTC first, then adjust by the timezone offset at that instant.
  const utcMs = new Date(isoString).getTime();
  if (Number.isNaN(utcMs)) return 0;
  return toLocalEpoch(timezone, utcMs);
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Returns the UTC epoch milliseconds that, when rendered in the given
 * timezone, equal the wall-clock time corresponding to `utcMs` rendered in
 * UTC.
 *
 * Put differently: "what is `utcMs` o'clock in `timezone`, expressed as a UTC
 * epoch?" — used so lifecycle date comparisons can be done purely with epoch
 * arithmetic while respecting the entity's local calendar.
 */
function toLocalEpoch(timezone: string, utcMs: number): number {
  const tz = validTimezone(timezone);
  const offsetMs = getTimezoneOffsetMs(tz, utcMs);
  return utcMs + offsetMs;
}

/**
 * Returns the UTC offset for `timezone` at the instant `utcMs` in
 * milliseconds (positive = east of UTC).
 *
 * We derive the offset by comparing two `Intl.DateTimeFormat` renderings of
 * the same instant — one in UTC, one in the target timezone — then computing
 * the difference. This correctly accounts for DST transitions.
 */
function getTimezoneOffsetMs(timezone: string, utcMs: number): number {
  try {
    const d = new Date(utcMs);

    // Render the date in both UTC and the target timezone using numeric parts
    // so we can compute the difference arithmetically.
    const utcParts = getDateParts(d, "UTC");
    const tzParts  = getDateParts(d, timezone);

    const utcRef = Date.UTC(
      utcParts.year, utcParts.month - 1, utcParts.day,
      utcParts.hour, utcParts.minute, utcParts.second,
    );
    const tzRef = Date.UTC(
      tzParts.year, tzParts.month - 1, tzParts.day,
      tzParts.hour, tzParts.minute, tzParts.second,
    );

    return tzRef - utcRef;
  } catch {
    // Unknown timezone — fall through to UTC
    return 0;
  }
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getDateParts(d: Date, timezone: string): DateParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(d);
  const get = (type: string) =>
    parseInt(parts.find(p => p.type === type)?.value ?? "0", 10);

  return {
    year:   get("year"),
    month:  get("month"),
    day:    get("day"),
    hour:   get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Returns the UTC epoch milliseconds for 23:59:59.999 on the same local
 * calendar date as `refMs` in the given IANA timezone.
 *
 * Used by public queries to compute an end-of-day cutoff when an entity has
 * no explicit `endDateTime`.
 *
 * @param timezone - IANA timezone string, e.g. "America/Chicago"
 * @param refMs    - Any UTC timestamp within the target local day
 */
export function endOfDayMs(timezone: string, refMs: number): number {
  const tz = validTimezone(timezone);
  // 1. Get the local calendar date at refMs.
  const parts = getDateParts(new Date(refMs), tz);
  // 2. Build the "local 23:59:59.999" as a fake UTC epoch (no tz adjustment yet).
  const localEodFakeUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999);
  // 3. Compute the timezone offset at approximately noon on that local day so DST
  //    edge-cases near midnight don't affect us.
  const noonUtcApprox = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  const offsetMs = getTimezoneOffsetMs(tz, noonUtcApprox);
  // 4. Real UTC end-of-day = local fake-UTC - offset.
  //    (getTimezoneOffsetMs returns tzRef - utcRef, i.e. local-as-UTC minus actual-UTC)
  return localEodFakeUtc - offsetMs;
}

/** Return the timezone string if valid, else "UTC". */
function validTimezone(tz: string | undefined | null): string {
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
