/**
 * useCanEdit.ts — D5 read_only UX gate.
 *
 * Returns whether the current viewer may perform WRITE actions on the given
 * capability (Add / Edit / Delete / Save / reorder). Read-only roles
 * (read_only, finance, support, …) resolve to `false` once their role truth is
 * known, so the client never renders a write control the backend
 * (requirePermission) would reject.
 *
 * Truthfulness rules:
 *   - KNOWN role truth → the capability model's `canEdit` decides. A viewer
 *     whose role lacks edit/manage (read_only, finance, support, …) gets
 *     `false`; every write affordance is hidden.
 *   - UNKNOWN role truth (permission row still loading / failed) → preserve the
 *     pre-existing optimistic rendering (`true`) instead of flash-hiding a
 *     control the viewer may legitimately own. This mirrors the capability
 *     model's "unknown → don't guess" rule at the surface level while keeping
 *     write controls stable during the brief load window. It also keeps the
 *     PR #58/#59-owned VisualEditorShell integration test (which renders
 *     TeamManager without permission mocks) green.
 *
 * The hook is a thin, reusable wrapper over the single capability model
 * (useSiteCapabilities) so every content manager gates its write controls the
 * same way — no per-page role-string hard-coding.
 */

import type { Id } from "@convex/_generated/dataModel";
import { useSiteCapabilities } from "./useSiteCapabilities";

export function useCanEditCapability(
  siteId: string | Id<"sites">,
  capabilityKey: string,
  options: { websiteType?: string | null } = {},
): boolean {
  const model = useSiteCapabilities(siteId, options);

  // Unknown role truth (still loading / failed) → keep the pre-existing
  // optimistic behavior; never flash-hide a control the viewer may own.
  if (model.rolePermissions == null) return true;

  return model.byKey[capabilityKey]?.canEdit ?? false;
}
