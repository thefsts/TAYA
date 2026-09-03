/**
 * Shared frontend constants for the TAYA System.
 */

/**
 * Fraction of capacity at which a class/event is considered "Nearly Full".
 * Mirrors the value in convex/lib/constants.ts - keep them in sync.
 */
export const NEARLY_FULL_THRESHOLD = 0.9;

/** Lifecycle status values for display labels and badge variants. */
export const LIFECYCLE_STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  Scheduled: "Scheduled",
  RegistrationOpen: "Open",
  NearlyFull: "Nearly Full",
  Full: "Full",
  WaitlistOpen: "Waitlist Open",
  RegistrationClosed: "Reg. Closed",
  InProgress: "In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Archived: "Archived",
};

export type LifecycleStatus = keyof typeof LIFECYCLE_STATUS_LABELS;
