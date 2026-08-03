/**
 * Scheduled background jobs for the FSTS Client Dashboard.
 *
 * - Lifecycle clock (every 5 min): drives time-based status transitions for
 *   courses, events, and flyers via `internal.lifecycle.tick`.
 * - Daily auto-archive: marks Completed entities older than 90 days as
 *   Archived when `autoArchive` is true (handled inside the same tick).
 * - Daily auto-backup: 3 AM UTC every day, captures a full snapshot of every
 *   active site and writes it to the `backups` table.
 * - Hourly health check: pings each active site's domain and logs
 *   uptime/response-time to `siteHealthLogs`.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/* ── Lifecycle clock — every 5 minutes ──────────────────────────────────── */
// Drives time-based transitions: registration opening/closing, InProgress,
// Completed, flyer expiration, flyer scheduling, waitlist promotion, and the
// 90-day auto-archive for completed entities.
crons.interval(
  "lifecycleClock",
  { minutes: 5 },
  (internal as any).lifecycle.tick,
);

/* ── Daily auto-archive sweep at 01:00 UTC ─────────────────────────────── */
// A dedicated daily run ensures auto-archive is applied even when the 5-min
// tick is briefly delayed (e.g. cold-start). The tick itself is idempotent so
// double-processing is safe.
crons.daily(
  "daily-lifecycle-archive",
  { hourUTC: 1, minuteUTC: 0 },
  (internal as any).lifecycle.tick,
);

/* ── Daily auto-backup at 03:00 UTC ──────────────────────────────────────── */
crons.daily(
  "daily-site-backups",
  { hourUTC: 3, minuteUTC: 0 },
  internal.backups.autoBackupAllSites,
);

/* ── Hourly health check ─────────────────────────────────────────────────── */
crons.hourly(
  "hourly-health-checks",
  { minuteUTC: 5 },
  internal.health.checkAllSites,
);

/* ── Daily comprehensive health scans ───────────────────────────────────── */
crons.daily(
  "daily-health-scans",
  { hourUTC: 4, minuteUTC: 0 },
  internal.healthScans.runScanForAllSites,
);

/* ── CRM inbound sync polling every 30 minutes ───────────────────────────── */
crons.interval(
  "crm-inbound-sync",
  { minutes: 30 },
  internal.crm.pollAllSitesInbound,
);

/* ── Daily review sync at 02:00 UTC ─────────────────────────────────────── */
crons.daily(
  "daily-review-sync",
  { hourUTC: 2, minuteUTC: 0 },
  internal.reviews.syncAllSitesReviews,
);

/* ── Payment email retry sweep — every 10 minutes ─────────────────────────── */
// Finds squareOrders with failed email delivery and nextRetryAt in the past,
// then re-attempts delivery up to MAX_EMAIL_ATTEMPTS (5). After that,
// status is permanently set to "permanentlyFailed".
crons.interval(
  "payment-email-retry",
  { minutes: 10 },
  internal.squareOrders.retryFailedPaymentEmails,
);

export default crons;
