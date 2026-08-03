import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { PERMISSIONS, userHasPermission } from "@/lib/permissions";

interface DesignLockGuardProps {
  children: React.ReactNode;
}

/**
 * DesignLockGuard — wraps routes that are restricted to FSTS super-admins.
 *
 * If the current user is not a super-admin they are immediately redirected
 * to the site dashboard. The guard shows nothing while loading so there is
 * no flash of the locked page.
 */
export default function DesignLockGuard({ children }: DesignLockGuardProps) {
  const me = useQuery(api.users.me);
  const [, setLocation] = useLocation();

  const isLoading = me === undefined;
  // Uses PERMISSIONS.DESIGN_MANAGE as the canonical lock — mirrors backend requirePermission check.
  const isLocked = me !== undefined && me !== null && !userHasPermission(me.isSuperAdmin, PERMISSIONS.DESIGN_MANAGE);

  useEffect(() => {
    if (isLocked) {
      setLocation("/app");
    }
  }, [isLocked, setLocation]);

  if (isLoading) return null;
  if (isLocked) return null;
  if (me === null) return null;

  return <>{children}</>;
}
