import type { Request, Response, NextFunction } from "express";
import type { UserSiteRole } from "@workspace/db";

export type Role = "super_admin" | "client_admin" | "editor" | "marketing" | "training_manager" | "read_only";

function parseSiteId(req: Request): number | null {
  const raw = Array.isArray(req.params.siteId) ? req.params.siteId[0] : req.params.siteId;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.dashboardUser?.isSuperAdmin) {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}

export function requireSiteRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.dashboardUser;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (user.isSuperAdmin) {
      next();
      return;
    }
    const siteId = parseSiteId(req);
    if (siteId === null) {
      res.status(400).json({ error: "Invalid site id" });
      return;
    }
    const assignment = user.roleAssignments.find((r: UserSiteRole) => r.siteId === siteId);
    if (!assignment || !allowedRoles.includes(assignment.role as Role)) {
      res.status(403).json({ error: "Insufficient permissions for this site" });
      return;
    }
    next();
  };
}

export const anySiteRole: Role[] = [
  "super_admin",
  "client_admin",
  "editor",
  "marketing",
  "training_manager",
  "read_only",
];

export const contentEditorRoles: Role[] = ["client_admin", "editor"];
export const marketingRoles: Role[] = ["client_admin", "editor", "marketing"];
export const trainingRoles: Role[] = ["client_admin", "editor", "training_manager"];
export const adminRoles: Role[] = ["client_admin"];
