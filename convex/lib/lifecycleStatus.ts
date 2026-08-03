/**
 * Lifecycle status calculator for courses and events.
 *
 * This is a pure function — it reads no DB state. Callers must pass in
 * the current confirmed-registration count and the current timestamp.
 *
 * Lifecycle states (in rough chronological order):
 *   Draft → Scheduled → RegistrationOpen → NearlyFull → Full →
 *   WaitlistOpen → RegistrationClosed → InProgress → Completed →
 *   (Cancelled | Archived)
 */

import { NEARLY_FULL_THRESHOLD } from "./constants";

export type LifecycleStatus =
  | "Draft"
  | "Scheduled"
  | "RegistrationOpen"
  | "NearlyFull"
  | "Full"
  | "WaitlistOpen"
  | "RegistrationClosed"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | "Archived";

interface Entity {
  status: string;
  capacity?: number;
  waitlistCapacity?: number;
  registrationOpenAt?: number;
  registrationCloseAt?: number;
  startDateTime?: number;
  endDateTime?: number;
  cancelledAt?: number;
  completedAt?: number;
  lifecycleStatus?: string;
}

/**
 * Derive the lifecycle status for a course or event.
 *
 * @param entity   - The course or event document (or partial projection).
 * @param confirmedCount - Current number of confirmed registrations.
 * @param now      - Current unix timestamp in milliseconds.
 */
export function calculateLifecycleStatus(
  entity: Entity,
  confirmedCount: number,
  now: number,
): LifecycleStatus {
  // Terminal states take priority
  if (entity.status === "archived" || entity.lifecycleStatus === "Archived") {
    return "Archived";
  }
  if (entity.cancelledAt || entity.status === "cancelled" || entity.lifecycleStatus === "Cancelled") {
    return "Cancelled";
  }
  if (entity.completedAt || entity.lifecycleStatus === "Completed") {
    return "Completed";
  }

  const start = entity.startDateTime;
  const end = entity.endDateTime;
  const regOpen = entity.registrationOpenAt;
  const regClose = entity.registrationCloseAt;
  const capacity = entity.capacity;
  const waitlist = entity.waitlistCapacity ?? 0;

  // In-progress: event has started but not ended
  if (start && start <= now && (!end || end > now)) {
    return "InProgress";
  }

  // Completed: end time has passed
  if (end && end <= now) {
    return "Completed";
  }

  // Registration window is open (or implicitly open before regClose)
  const regWindowOpen = regOpen ? regOpen <= now : true;
  const regWindowClosed = regClose ? regClose <= now : false;

  if (regWindowClosed) {
    return "RegistrationClosed";
  }

  // No capacity configured — just use draft/published logic
  if (!capacity) {
    if (!regWindowOpen) return "Scheduled";
    return entity.status === "published" ? "RegistrationOpen" : "Draft";
  }

  // Capacity is full
  if (confirmedCount >= capacity) {
    // Waitlist still has room
    if (waitlist > 0) {
      return "WaitlistOpen";
    }
    return "Full";
  }

  // Not yet open for registration
  if (!regWindowOpen) {
    return "Scheduled";
  }

  // Nearly full threshold check
  if (confirmedCount / capacity >= NEARLY_FULL_THRESHOLD) {
    return "NearlyFull";
  }

  // Registration is open and seats available
  if (entity.status === "published") {
    return "RegistrationOpen";
  }

  return "Draft";
}
