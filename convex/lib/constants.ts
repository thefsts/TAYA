/**
 * Shared constants used across Convex backend functions.
 */

/** Fraction of capacity at which a class/event is considered "nearly full". */
export const NEARLY_FULL_THRESHOLD = 0.9;

/**
 * Number of days a course or event must remain in `Completed` lifecycle status
 * before the daily auto-archive sweep (`autoArchive: true`) moves it to
 * `Archived`. Configurable here; referenced by `convex/lifecycle.ts`.
 */
export const AUTO_ARCHIVE_DAYS = 90;
