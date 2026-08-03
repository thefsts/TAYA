import { useParams } from "wouter";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/pages/app/SiteDashboard";
import {
  MODULE_LABELS,
  MODULE_SECTIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  PERMISSION_LEVEL_LABELS,
  PERMISSION_LEVEL_COLORS,
  ROLES,
  type DashboardModule,
  type PermissionLevel,
  type Role,
} from "@/lib/roleCapabilities";
import { RolePermissionsPanel } from "@/components/RolePermissionsPanel";
import { ShieldCheck, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function PermBadge({ level }: { level: PermissionLevel }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PERMISSION_LEVEL_COLORS[level]}`}>
      {PERMISSION_LEVEL_LABELS[level]}
    </span>
  );
}

export default function MyPermissions() {
  const params = useParams();
  const siteId = params.siteId as unknown as Id<"sites">;
  const [selectedRole, setSelectedRole] = useState<Role>(ROLES[0]);

  const data = useQuery(api.accessControl.getMyPermissions, { siteId });

  if (data === undefined) {
    return (
      <AppLayout siteId={siteId}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout siteId={siteId}>
        <div className="text-center py-12 text-slate-500">
          You do not have access to this site.
        </div>
      </AppLayout>
    );
  }

  const permissions = data.permissions as Record<DashboardModule, PermissionLevel>;

  return (
    <AppLayout siteId={siteId}>
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-slate-900">My Permissions</h1>
        </div>
        <p className="text-slate-500 mb-6">
          {data.isSuperAdmin
            ? "You are a super-admin and have full manage access to all modules on every site."
            : `Your role on this site is ${ROLE_LABELS[data.role as Role] ?? data.role}. The table below shows what you can access.`}
        </p>

        {!data.isSuperAdmin && data.role && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-start gap-3">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {ROLE_LABELS[data.role as Role] ?? data.role}
                </Badge>
                <p className="text-sm text-slate-600 flex-1 min-w-0">
                  {ROLE_DESCRIPTIONS[data.role as Role] ?? ""}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {MODULE_SECTIONS.map((section) => {
            const sectionModules = section.modules.filter(
              (mod) => permissions[mod] !== undefined,
            );
            if (sectionModules.length === 0) return null;

            const hasAnyAccess = sectionModules.some((mod) => permissions[mod] !== "none");

            return (
              <div key={section.label}>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  {section.label}
                </h2>
                <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {sectionModules.map((mod) => {
                        const level = permissions[mod] ?? "none";
                        return (
                          <tr key={mod} className={level === "none" ? "opacity-50" : ""}>
                            <td className="px-4 py-2.5 font-medium text-slate-700 w-56">
                              {MODULE_LABELS[mod]}
                            </td>
                            <td className="px-4 py-2.5">
                              <PermBadge level={level} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">
                              {level === "none" && "You cannot access this module."}
                              {level === "view" && "You can view but not make changes."}
                              {level === "edit" && "You can create and edit content."}
                              {level === "manage" && "You have full control including configuration."}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!hasAnyAccess && (
                    <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
                      You have no access to modules in this section.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Role Reference — read-only, visible to all site users */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">Role Reference</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Review the permissions granted to each role before adding a team member.
            Permissions in the <span className="font-medium">Design &amp; Integrations</span> category
            are reserved for FSTS admin accounts and cannot be assigned to site roles.
          </p>

          {/* Role tab strip */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedRole === role
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-md shadow-sm p-4">
            <RolePermissionsPanel role={selectedRole} showHeader compact={false} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
