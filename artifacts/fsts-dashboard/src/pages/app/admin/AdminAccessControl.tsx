import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Redirect, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RotateCcw, Info } from "lucide-react";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  DASHBOARD_MODULES,
  MODULE_LABELS,
  MODULE_SECTIONS,
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABELS,
  PERMISSION_LEVEL_COLORS,
  ROLE_CAPABILITIES,
  type Role,
  type DashboardModule,
  type PermissionLevel,
} from "@/lib/roleCapabilities";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function LevelBadge({ level }: { level: PermissionLevel }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${PERMISSION_LEVEL_COLORS[level]}`}>
      {PERMISSION_LEVEL_LABELS[level]}
    </span>
  );
}

function LevelSelect({
  value,
  defaultValue,
  onChange,
  pending,
}: {
  value: PermissionLevel;
  defaultValue: PermissionLevel;
  onChange: (level: PermissionLevel | "__remove__") => void;
  pending: boolean;
}) {
  const isOverridden = value !== defaultValue;

  return (
    <div className="flex items-center gap-1">
      <Select
        value={value}
        onValueChange={(v) => onChange(v as PermissionLevel)}
        disabled={pending}
      >
        <SelectTrigger aria-label="value" className={`h-7 text-xs w-28 ${isOverridden ? "border-amber-400 bg-amber-50" : ""}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERMISSION_LEVELS.map((lvl) => (
            <SelectItem key={lvl} value={lvl} className="text-xs">
              {PERMISSION_LEVEL_LABELS[lvl]}
              {lvl === defaultValue && " (default)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOverridden && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Reset"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-amber-600 hover:text-amber-800"
              onClick={() => onChange("__remove__")}
              disabled={pending}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Reset to default ({PERMISSION_LEVEL_LABELS[defaultValue]})
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default function AdminAccessControl() {
  const me = useQuery(api.users.me);
  const sites = useQuery(api.sites.list);
  const { toast } = useToast();

  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const matrix = useQuery(
    api.accessControl.getSiteCapabilityMatrix,
    selectedSiteId ? { siteId: selectedSiteId as Id<"sites"> } : "skip",
  );

  const setOverride = useMutation(api.accessControl.setRoleModuleOverride);
  const resetOverrides = useMutation(api.accessControl.resetSiteOverrides);

  if (me === undefined) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  async function handleChange(role: Role, mod: DashboardModule, level: PermissionLevel | "__remove__") {
    if (!selectedSiteId) return;
    const key = `${role}:${mod}`;
    setPendingCell(key);
    try {
      await setOverride({
        siteId: selectedSiteId as Id<"sites">,
        role,
        module: mod,
        level,
      });
    } catch (err) {
      toast({
        title: "Failed to update",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setPendingCell(null);
    }
  }

  async function handleReset() {
    if (!selectedSiteId) return;
    try {
      const result = await resetOverrides({ siteId: selectedSiteId as Id<"sites"> });
      toast({ title: `Reset ${(result as any).removed} override(s) to defaults` });
    } catch (err) {
      toast({
        title: "Failed to reset",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setResetDialogOpen(false);
    }
  }

  const effectiveMatrix: Record<Role, Record<DashboardModule, PermissionLevel>> | null =
    matrix?.matrix as any ?? null;

  const overridesMap = matrix?.overrides as Record<string, Record<string, string>> | undefined;
  const hasOverrides = overridesMap ? Object.values(overridesMap).some((m) => Object.keys(m).length > 0) : false;

  return (
    <div className="p-8 max-w-full mx-auto">
      <div className="mb-6">
        <Link href="/app" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Access Control</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Override the default role capabilities for any site. Changes take effect immediately.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-72">
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a site to configure…" />
            </SelectTrigger>
            <SelectContent>
              {sites?.map((s: any) => (
                <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSiteId && hasOverrides && (
          <Button
            variant="outline"
            size="sm"
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
            onClick={() => setResetDialogOpen(true)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All to Defaults
          </Button>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${PERMISSION_LEVEL_COLORS.none}`}>No access</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${PERMISSION_LEVEL_COLORS.view}`}>View</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${PERMISSION_LEVEL_COLORS.edit}`}>Edit</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${PERMISSION_LEVEL_COLORS.manage}`}>Manage</span>
          <span className="ml-2 text-amber-600 font-medium">Amber border = custom override</span>
        </div>
      </div>

      {!selectedSiteId && (
        <div className="text-center py-20 text-slate-400">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a site above to view and edit its role capabilities.</p>
        </div>
      )}

      {selectedSiteId && matrix === undefined && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {selectedSiteId && effectiveMatrix && (
        <div className="space-y-8">
          {MODULE_SECTIONS.map((section) => (
            <div key={section.label}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">{section.label}</h2>
              <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium text-xs w-40">Module</th>
                      {ROLES.map((role) => (
                        <th key={role} className="text-center px-2 py-2.5 font-medium text-xs text-slate-700 min-w-[130px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">{ROLE_LABELS[role]}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              {ROLE_DESCRIPTIONS[role]}
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {section.modules.map((mod) => (
                      <tr key={mod} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-medium text-slate-700 text-xs">{MODULE_LABELS[mod]}</td>
                        {ROLES.map((role) => {
                          const current: PermissionLevel = effectiveMatrix[role]?.[mod] ?? "none";
                          const defaultLevel: PermissionLevel = ROLE_CAPABILITIES[role][mod];
                          const key = `${role}:${mod}`;
                          const isPending = pendingCell === key;
                          return (
                            <td key={role} className="px-2 py-1.5 text-center">
                              <LevelSelect
                                value={current}
                                defaultValue={defaultLevel}
                                onChange={(lvl) => handleChange(role, mod, lvl)}
                                pending={isPending}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all overrides?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all custom capability overrides for this site and revert every role to its default permissions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
