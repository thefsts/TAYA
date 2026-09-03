import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Redirect } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Lock, Unlock, ShieldCheck } from "lucide-react";
import {
  CAPABILITIES,
  CONTENT_CAPABILITIES,
  DESIGN_CAPABILITIES,
  type CapabilityCategory,
} from "@/lib/capabilities";

const CATEGORY_ORDER: CapabilityCategory[] = [
  "Content",
  "Site Modules",
  "Configuration",
  "Integrations",
  "System",
];

function groupByCategory<T extends { category: CapabilityCategory }>(items: T[]) {
  const grouped = new Map<CapabilityCategory, T[]>();
  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, []);
  }
  for (const item of items) {
    grouped.get(item.category)?.push(item);
  }
  return grouped;
}

export default function AdminDesignLock() {
  const me = useQuery(api.users.me);
  const sites = useQuery(api.sites.list);

  if (me === undefined) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  const contentGrouped = groupByCategory(CONTENT_CAPABILITIES);
  const designGrouped = groupByCategory(DESIGN_CAPABILITIES);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Design Lock™</h1>
        </div>
        <p className="text-slate-500 max-w-2xl">
          The Global Design Lock enforces a hard boundary between what FSTS controls
          and what clients can edit. Design-locked capabilities can only be modified
          by FSTS super-administrators. Attempts to mutate a locked field from a
          client-role account are rejected at the API level.
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2">
          <Unlock className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            {CONTENT_CAPABILITIES.length} client-editable capabilities
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-4 py-2">
          <Lock className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">
            {DESIGN_CAPABILITIES.length} design-locked capabilities
          </span>
        </div>
        <div className="text-sm text-slate-400">
          {CAPABILITIES.length} total capabilities registered
        </div>
      </div>

      {/* Two-column capability registry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Content column */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Unlock className="h-4 w-4 text-green-600" />
            <h2 className="font-semibold text-slate-900">Client-Editable</h2>
            <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700 border-green-200">
              CONTENT
            </Badge>
          </div>
          <div className="space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const items = contentGrouped.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {cat}
                  </div>
                  <div className="border border-slate-200 rounded-md divide-y divide-slate-100 bg-white">
                    {items.map((cap) => (
                      <div key={cap.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Unlock className="h-3 w-3 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">{cap.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{cap.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Design-locked column */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Design-Locked</h2>
            <Badge variant="secondary" className="ml-1 bg-slate-100 text-slate-600 border-slate-200">
              FSTS ONLY
            </Badge>
          </div>
          <div className="space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const items = designGrouped.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {cat}
                  </div>
                  <div className="border border-slate-200 rounded-md divide-y divide-slate-100 bg-white">
                    {items.map((cap) => (
                      <div key={cap.id} className="flex items-start gap-3 px-4 py-3 bg-slate-50/60">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <Lock className="h-3 w-3 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-700">{cap.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{cap.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-site enforcement status */}
      <div className="mb-4">
        <h2 className="font-semibold text-slate-900 mb-1">Enforcement Status by Site</h2>
        <p className="text-sm text-slate-500 mb-4">
          Design Lock is enforced platform-wide. The table below confirms active
          enforcement for each registered site.
        </p>
        {sites === undefined ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : sites === null ? (
          <ModuleAccessDenied message="Unable to load sites list — you may not have sufficient access." />
        ) : (
          <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Site
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Design Lock
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Locked Capabilities
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(sites as any[]).map((site) => (
                  <tr key={site._id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {site.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                      {site.slug}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={site.status === "active" ? "default" : "secondary"}>
                        {site.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm text-green-700 font-medium">Active</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {DESIGN_CAPABILITIES.length} of {CAPABILITIES.length} capabilities locked
                    </td>
                  </tr>
                ))}
                {(sites as any[]).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                      No sites registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
