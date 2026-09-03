/**
 * AdminRoles — Role Reference & Permissions Grid
 *
 * Shows every site role alongside the named RBAC permissions it grants,
 * grouped by category. Sourced from ROLE_PERMISSIONS in roleCapabilities.ts.
 * Design-tier permissions always show a lock icon — they are never grantable
 * to site roles.
 */

import { useState } from "react";
import { Redirect, Link } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, CheckCircle2, Circle, ShieldCheck, ChevronDown, ChevronRight } from "lucide-react";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  SUPERADMIN_ONLY_PERMISSIONS,
  type Role,
  type Permission,
} from "@/lib/roleCapabilities";
import { PERMISSION_LABELS, PERMISSION_CATEGORIES } from "@/components/RolePermissionsPanel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ROLE_BADGE_COLORS: Record<Role, string> = {
  owner:           "bg-green-100 text-green-800 border-green-200",
  manager:         "bg-blue-100 text-blue-800 border-blue-200",
  marketing:       "bg-purple-100 text-purple-800 border-purple-200",
  content_editor:  "bg-amber-100 text-amber-800 border-amber-200",
  course_manager:  "bg-indigo-100 text-indigo-800 border-indigo-200",
  events_manager:  "bg-pink-100 text-pink-800 border-pink-200",
  finance:         "bg-teal-100 text-teal-800 border-teal-200",
  support:         "bg-orange-100 text-orange-800 border-orange-200",
  read_only:       "bg-slate-100 text-slate-600 border-slate-200",
};

/** Cell for a single role × permission intersection */
function PermCell({ granted, isSuperAdminOnly }: { granted: boolean; isSuperAdminOnly: boolean }) {
  if (isSuperAdminOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex justify-center">
            <Lock className="h-3.5 w-3.5 text-amber-300" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          FSTS Admin only — cannot be granted to site roles.
        </TooltipContent>
      </Tooltip>
    );
  }
  if (granted) {
    return (
      <span className="inline-flex justify-center">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      </span>
    );
  }
  return (
    <span className="inline-flex justify-center">
      <Circle className="h-3.5 w-3.5 text-slate-200" />
    </span>
  );
}

export default function AdminRoles() {
  const me = useQuery(api.users.me);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(PERMISSION_CATEGORIES.map((c) => c.label)),
  );

  if (me === undefined) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  // Build a lookup: role → Set<Permission>
  const grantedMap: Record<Role, Set<Permission>> = {} as any;
  for (const role of ROLES) {
    grantedMap[role] = new Set(ROLE_PERMISSIONS[role]);
  }

  function toggleCategory(label: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="p-8 max-w-full mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <ShieldCheck className="h-7 w-7 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <Link href="/app" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Role Permissions Reference</h1>
          <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
            Every named RBAC permission and which site roles receive it.
            Use this before assigning roles so you know exactly what actions
            each team member will be able to perform.
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-6 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          Granted by role
        </span>
        <span className="flex items-center gap-1.5">
          <Circle className="h-3.5 w-3.5 text-slate-300" />
          Not granted
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-amber-400" />
          FSTS Admin only — never grantable to site roles
        </span>
      </div>

      {/* Role header cards */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* Permission label column */}
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs w-52 sticky left-0 bg-slate-50 z-10">
                Permission
              </th>
              {ROLES.map((role) => (
                <th key={role} className="px-3 py-3 min-w-[110px] text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-default">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${ROLE_BADGE_COLORS[role]}`}
                        >
                          {ROLE_LABELS[role]}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      <p className="font-medium mb-0.5">{ROLE_LABELS[role]}</p>
                      <p>{ROLE_DESCRIPTIONS[role]}</p>
                    </TooltipContent>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PERMISSION_CATEGORIES.map((cat) => {
              const isExpanded = expandedCategories.has(cat.label);

              return [
                /* Category header row */
                <tr
                  key={`cat-${cat.label}`}
                  className="bg-slate-50/70 border-t border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleCategory(cat.label)}
                >
                  <td
                    colSpan={ROLES.length + 1}
                    className="px-4 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {cat.label}
                      </span>
                      {cat.adminOnly && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium text-amber-600 border-amber-300 bg-amber-50 px-1.5 py-0"
                        >
                          <Lock className="h-2.5 w-2.5 mr-0.5" />
                          FSTS Admin only
                        </Badge>
                      )}
                      <span className="text-[10px] text-slate-400 font-normal normal-case tracking-normal">
                        {cat.permissions.length} permission{cat.permissions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </td>
                </tr>,

                /* Permission rows — only shown when category expanded */
                ...(isExpanded
                  ? cat.permissions.map((perm) => {
                      const isSuperAdminOnly = SUPERADMIN_ONLY_PERMISSIONS.has(perm);
                      return (
                        <tr
                          key={perm}
                          className={`border-t border-slate-100 hover:bg-slate-50/50 transition-colors ${
                            isSuperAdminOnly ? "opacity-60" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 sticky left-0 bg-white">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-700 text-xs font-medium">
                                {PERMISSION_LABELS[perm]}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {perm}
                              </span>
                            </div>
                          </td>
                          {ROLES.map((role) => (
                            <td key={role} className="px-3 py-2.5 text-center">
                              <PermCell
                                granted={grantedMap[role].has(perm)}
                                isSuperAdminOnly={isSuperAdminOnly}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  : []),
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Permission count summary per role */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {ROLES.map((role) => {
          const count = grantedMap[role].size;
          return (
            <div
              key={role}
              className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm"
            >
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium mb-2 ${ROLE_BADGE_COLORS[role]}`}
              >
                {ROLE_LABELS[role]}
              </span>
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-400">
                permission{count !== 1 ? "s" : ""} granted
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
