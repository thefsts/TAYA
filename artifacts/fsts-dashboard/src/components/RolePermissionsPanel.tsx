/**
 * RolePermissionsPanel
 *
 * Shows the named RBAC permissions granted by a given role, grouped by
 * category. Design-tier (superAdmin-only) permissions are shown with a lock
 * icon and a muted style to make clear they cannot be granted to site roles.
 *
 * Sourced exclusively from ROLE_PERMISSIONS in roleCapabilities.ts — no
 * duplication of permission data.
 */

import { Lock, CheckCircle2, Circle } from "lucide-react";
import {
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  PERMISSIONS,
  SUPERADMIN_ONLY_PERMISSIONS,
  type Role,
  type Permission,
} from "@/lib/roleCapabilities";
import { Badge } from "@/components/ui/badge";

// ── Human-readable labels for each named permission ──────────────────────────

export const PERMISSION_LABELS: Record<Permission, string> = {
  "content.view":        "View content",
  "content.create":      "Create content",
  "content.update":      "Edit content",
  "content.delete":      "Delete content",
  "media.view":          "View media",
  "media.upload":        "Upload media",
  "media.delete":        "Delete media",
  "flyers.create":       "Create flyers",
  "flyers.update":       "Edit flyers",
  "flyers.publish":      "Publish flyers",
  "flyers.archive":      "Archive flyers",
  "events.manage":       "Manage events",
  "classes.manage":      "Manage classes & courses",
  "design.manage":       "Manage site design",
  "layout.manage":       "Manage page layouts",
  "code.manage":         "Edit custom code",
  "integrations.manage": "Manage integrations",
  "deployment.manage":   "Deploy site",
};

// ── Permission categories ─────────────────────────────────────────────────────

type PermissionCategory = {
  label: string;
  permissions: Permission[];
  /** If true every permission in this group is superAdmin-only */
  adminOnly?: boolean;
};

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    label: "Content",
    permissions: [
      PERMISSIONS.CONTENT_VIEW,
      PERMISSIONS.CONTENT_CREATE,
      PERMISSIONS.CONTENT_UPDATE,
      PERMISSIONS.CONTENT_DELETE,
    ],
  },
  {
    label: "Media",
    permissions: [
      PERMISSIONS.MEDIA_VIEW,
      PERMISSIONS.MEDIA_UPLOAD,
      PERMISSIONS.MEDIA_DELETE,
    ],
  },
  {
    label: "Flyers",
    permissions: [
      PERMISSIONS.FLYERS_CREATE,
      PERMISSIONS.FLYERS_UPDATE,
      PERMISSIONS.FLYERS_PUBLISH,
      PERMISSIONS.FLYERS_ARCHIVE,
    ],
  },
  {
    label: "Scheduling",
    permissions: [
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.CLASSES_MANAGE,
    ],
  },
  {
    label: "Design & Integrations",
    adminOnly: true,
    permissions: [
      PERMISSIONS.DESIGN_MANAGE,
      PERMISSIONS.LAYOUT_MANAGE,
      PERMISSIONS.CODE_MANAGE,
      PERMISSIONS.INTEGRATIONS_MANAGE,
      PERMISSIONS.DEPLOYMENT_MANAGE,
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface RolePermissionsPanelProps {
  role: Role;
  /** Show the role name/description header. Default: true */
  showHeader?: boolean;
  /** Compact mode hides categories with no granted permissions. Default: false */
  compact?: boolean;
}

export function RolePermissionsPanel({
  role,
  showHeader = true,
  compact = false,
}: RolePermissionsPanelProps) {
  const granted = new Set<Permission>(ROLE_PERMISSIONS[role]);

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm">
                {ROLE_LABELS[role]}
              </span>
              <Badge variant="outline" className="text-xs font-mono text-slate-500">
                {role}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {PERMISSION_CATEGORIES.map((cat) => {
          const hasAny = cat.permissions.some((p) => granted.has(p));
          if (compact && !hasAny && !cat.adminOnly) return null;

          return (
            <div key={cat.label}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {cat.label}
                </span>
                {cat.adminOnly && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    <Lock className="h-2.5 w-2.5" />
                    TAYA Admin only
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {cat.permissions.map((perm) => {
                  const isSuperAdminOnly = SUPERADMIN_ONLY_PERMISSIONS.has(perm);
                  const isGranted = granted.has(perm);

                  if (isSuperAdminOnly) {
                    return (
                      <li
                        key={perm}
                        className="flex items-center gap-2 text-xs text-slate-300"
                      >
                        <Lock className="h-3 w-3 flex-shrink-0 text-amber-300" />
                        <span className="flex-1">{PERMISSION_LABELS[perm]}</span>
                        <span className="font-mono text-[10px] text-slate-300 truncate max-w-[140px]">
                          {perm}
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={perm}
                      className={`flex items-center gap-2 text-xs ${
                        isGranted ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      {isGranted ? (
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                      ) : (
                        <Circle className="h-3 w-3 flex-shrink-0 text-slate-200" />
                      )}
                      <span className="flex-1">{PERMISSION_LABELS[perm]}</span>
                      <span className={`font-mono text-[10px] truncate max-w-[140px] ${isGranted ? "text-slate-400" : "text-slate-200"}`}>
                        {perm}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
          <Lock className="h-2.5 w-2.5 inline mr-0.5 text-amber-400" />
          Design &amp; Integrations permissions are reserved for TAYA admin
          accounts and cannot be granted to site roles.
        </p>
      )}
    </div>
  );
}
