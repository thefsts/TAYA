import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLocation, useParams } from "wouter";
import { useEffect } from "react";

interface SuperAdminRouteGuardProps {
  children: React.ReactNode;
}

/**
 * SuperAdminRouteGuard — HOTFIX (production no-go, BLOCKER 1).
 *
 * Site Verification (/app/sites/:siteId/verification) is an FSTS admin /
 * connection-management surface. Hiding the sidebar entry alone would leave
 * the route deep-linkable — this guard denies the ROUTE itself:
 *
 *   - while the viewer query loads → nothing renders (no flash of the panel)
 *   - non-superAdmin (read_only, content_editor, manager, owner — any client
 *     role, even site members) → immediate redirect to their site dashboard
 *   - unprovisioned signed-in user (me === null) → denied the same way
 *   - superAdmin (FSTS platform admin) → children render: the intended
 *     admin verification surface
 *
 * Mirrors DesignLockGuard's proven shape (null while loading / denied, no
 * locked-content flash) with a different target: the client's own site
 * dashboard, so a stray bookmark lands somewhere useful.
 */
export default function SuperAdminRouteGuard({ children }: SuperAdminRouteGuardProps) {
  const me = useQuery(api.users.me);
  const [, setLocation] = useLocation();
  const params = useParams<{ siteId?: string }>();

  const isLoading = me === undefined;
  const denied = me !== undefined && (me === null || !me.isSuperAdmin);

  useEffect(() => {
    if (!denied) return;
    // Send the client back to their own workspace — never the admin surface.
    if (params?.siteId) {
      setLocation(`/app/sites/${params.siteId}`, { replace: true });
    } else {
      setLocation("/app", { replace: true });
    }
  }, [denied, params?.siteId, setLocation]);

  if (isLoading) return null;
  if (denied) return null;

  return <>{children}</>;
}
