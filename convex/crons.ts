/**
 * Scheduled background jobs for the FSTS Client Dashboard.
 *
 * - Daily auto-backup: 3 AM UTC every day, captures a full snapshot of every
 *   active site and writes it to the `backups` table.
 * - Hourly health check: pings each active site's domain and logs
 *   uptime/response-time to `siteHealthLogs`.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

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

export default crons;
