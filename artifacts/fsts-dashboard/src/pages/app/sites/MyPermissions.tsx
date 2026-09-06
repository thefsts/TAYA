import { useParams } from "wouter";
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
  type DashboardModule,
  type PermissionLevel,
  type Role,
} from "@/lib/roleCapabilities";
import { ShieldCheck, UserRound, LockKeyhole, Globe2, Mail, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function PermBadge({ level }: { level: PermissionLevel }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PERMISSION_LEVEL_COLORS[level]}`}>
      {PERMISSION_LEVEL_LABELS[level]}
    </span>
  );
}

function AccountSettings({ data, siteId }: { data: any; siteId: Id<"sites"> }) {
  const site = useQuery(api.sites.get, { siteId });
  const me = useQuery(api.users.me);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-sm text-slate-500">Your TAYA account and website access in one safe place.</p>
        </div>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-slate-900">Profile</h2>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">{me?.name || "Account user"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-800"><Mail className="h-3.5 w-3.5 text-slate-400" />{me?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">{data.isSuperAdmin ? "Super Admin" : ROLE_LABELS[data.role as Role] ?? data.role ?? "User"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</dt>
                <dd className="mt-1 text-sm font-medium text-emerald-700">Active</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-slate-900">Website Access</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">{site?.name ?? "Your website"}</div>
              <div className="mt-1 text-xs text-slate-500">{site?.domain ?? site?.slug ?? String(siteId)}</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Website access is controlled by TAYA. This account cannot add another website or change tenant ownership from Account Settings.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-slate-900">Security & Sign-in</h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              TAYA uses Clerk for secure authentication, but normal client account management stays inside TAYA. Password recovery is available from the branded TAYA sign-in screen. Website access, billing entitlement, and tenant assignment cannot be changed from Clerk.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.location.assign(`/app/sites/${siteId}/help`)}>
                Get Help
              </Button>
              <Button variant="outline" onClick={() => window.location.assign(`/app/sites/${siteId}/permissions`)}>
                View My Permissions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MyPermissions() {
  const params = useParams();
  const siteId = params.siteId as unknown as Id<"sites">;
  const data = useQuery(api.accessControl.getMyPermissions, { siteId });
  const showAccount = new URLSearchParams(window.location.search).get("tab") === "account";

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

  if (showAccount) {
    return (
      <AppLayout siteId={siteId}>
        <AccountSettings data={data} siteId={siteId} />
      </AppLayout>
    );
  }

  const permissions = data.permissions as Record<DashboardModule, PermissionLevel>;
  const isInternalQa = data.role === "internal_qa";

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
            : `Your role on this site is ${ROLE_LABELS[data.role as Role] ?? data.role}. Below is exactly what your account can access.`}
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

            const visibleModules = data.isSuperAdmin || isInternalQa
              ? sectionModules
              : sectionModules.filter((mod) => permissions[mod] !== "none");
            if (visibleModules.length === 0) return null;

            return (
              <div key={section.label}>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  {section.label}
                </h2>
                <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {visibleModules.map((mod) => {
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
                              {level === "manage" && "You have full control for this site."}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {!data.isSuperAdmin && !isInternalQa && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            This page only shows permissions assigned to your account. Internal TAYA roles and platform-level permissions are intentionally hidden from client accounts.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
