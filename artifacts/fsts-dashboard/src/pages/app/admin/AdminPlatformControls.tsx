import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Redirect, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ShieldCheck, Building2, CheckCircle2, XCircle, AlertCircle,
  Settings, Flag, FileText,
} from "lucide-react";
import {
  AGENCY_FEATURE_FLAGS,
  AGENCY_FEATURE_FLAG_LABELS,
  AGENCY_FEATURE_FLAG_DESCRIPTIONS,
} from "@/lib/roleCapabilities";
import { MODULE_KEYS, MODULE_LABELS } from "@/lib/siteModules";

const LICENSING_STATUSES = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
  { value: "trial", label: "Trial", color: "bg-blue-100 text-blue-800" },
  { value: "suspended", label: "Suspended", color: "bg-red-100 text-red-800" },
  { value: "expired", label: "Expired", color: "bg-slate-100 text-slate-600" },
];

export default function AdminPlatformControls() {
  const me = useQuery(api.users.me);
  const agencies = useQuery(api.agencies.list);
  const { toast } = useToast();

  const updateAgency = useMutation(api.agencies.update);
  const updateFlags = useMutation(api.agencies.updateFeatureFlags);

  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<"features" | "modules" | "licensing">("features");

  if (me === undefined) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  const selectedAgency = (agencies ?? []).find((a: any) => a._id === selectedAgencyId);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/app" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Controls</h1>
        </div>
        <p className="text-sm text-slate-500 ml-11">FSTS-level controls for agency licensing, module availability, and feature flags.</p>
      </div>

      {/* Agency selector */}
      <div className="bg-white border border-slate-200 rounded-md p-5 mb-6">
        <Label className="mb-2 block text-sm font-medium">Select Agency</Label>
        {agencies === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : agencies === null || agencies.length === 0 ? (
          <div className="text-sm text-slate-500 py-2">No agencies configured yet. <a href="/app/admin/agencies" className="text-primary hover:underline">Create one first.</a></div>
        ) : (
          <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Choose an agency…" />
            </SelectTrigger>
            <SelectContent>
              {(agencies ?? []).map((agency: any) => (
                <SelectItem key={agency._id} value={agency._id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    {agency.name}
                    <span className="text-xs text-slate-400">({agency.slug})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedAgency && (
        <>
          {/* Agency status bar */}
          <div className="bg-white border border-slate-200 rounded-md p-4 mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {selectedAgency.isActive ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium text-slate-700">
                {selectedAgency.isActive ? "Agency Active" : "Agency Disabled"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-600">Licensing: </span>
              <Badge className={LICENSING_STATUSES.find((s) => s.value === selectedAgency.licensingStatus)?.color ?? ""}>
                {selectedAgency.licensingStatus}
              </Badge>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={async () => {
                  try {
                    await updateAgency({ agencyId: selectedAgency._id, isActive: !selectedAgency.isActive });
                    toast({ title: `Agency ${selectedAgency.isActive ? "disabled" : "enabled"}` });
                  } catch (err) {
                    toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
                  }
                }}
              >
                {selectedAgency.isActive ? "Disable Agency" : "Enable Agency"}
              </Button>
            </div>
          </div>

          {/* Section nav */}
          <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-md w-fit">
            {[
              { id: "features" as const, label: "Feature Flags", icon: Flag },
              { id: "modules" as const, label: "Module Availability", icon: Settings },
              { id: "licensing" as const, label: "Licensing & Billing", icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  activeSection === id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Feature Flags */}
          {activeSection === "features" && (
            <PlatformFeatureFlagsPanel
              agency={selectedAgency}
              onUpdate={async (flags) => {
                await updateFlags({ agencyId: selectedAgency._id, featureFlags: flags });
                toast({ title: "Feature flags saved" });
              }}
            />
          )}

          {/* Module Availability */}
          {activeSection === "modules" && (
            <PlatformModulePanel
              agency={selectedAgency}
              onUpdate={async (flags) => {
                await updateFlags({ agencyId: selectedAgency._id, featureFlags: { ...selectedAgency.featureFlags, _modules: flags } });
                toast({ title: "Module availability saved" });
              }}
            />
          )}

          {/* Licensing & Billing */}
          {activeSection === "licensing" && (
            <PlatformLicensingPanel
              agency={selectedAgency}
              onUpdate={async (data) => {
                await updateAgency({ agencyId: selectedAgency._id, ...data });
                toast({ title: "Licensing updated" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function PlatformFeatureFlagsPanel({
  agency,
  onUpdate,
}: {
  agency: any;
  onUpdate: (flags: Record<string, boolean>) => Promise<void>;
}) {
  const [local, setLocal] = useState<Record<string, boolean>>(agency.featureFlags ?? {});
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(local) !== JSON.stringify(agency.featureFlags ?? {});

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900 text-sm">Feature Flags</h2>
        <p className="text-xs text-slate-500 mt-0.5">Control which platform capabilities this agency can offer its clients.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {AGENCY_FEATURE_FLAGS.map((flag) => (
          <div key={flag} className="flex items-start justify-between px-5 py-4">
            <div className="flex-1 pr-6">
              <div className="text-sm font-medium text-slate-800">{AGENCY_FEATURE_FLAG_LABELS[flag]}</div>
              <div className="text-xs text-slate-500 mt-0.5">{AGENCY_FEATURE_FLAG_DESCRIPTIONS[flag]}</div>
            </div>
            <Switch
              checked={local[flag] ?? false}
              onCheckedChange={(v) => setLocal((f) => ({ ...f, [flag]: v }))}
            />
          </div>
        ))}
      </div>
      {hasChanges && (
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try { await onUpdate(local); } finally { setSaving(false); }
            }}
          >
            {saving ? "Saving…" : "Save Feature Flags"}
          </Button>
        </div>
      )}
    </div>
  );
}

function PlatformModulePanel({
  agency,
  onUpdate,
}: {
  agency: any;
  onUpdate: (modules: Record<string, boolean>) => Promise<void>;
}) {
  const existingModules: Record<string, boolean> = agency.featureFlags?._modules ?? {};
  const [local, setLocal] = useState<Record<string, boolean>>(
    Object.fromEntries(MODULE_KEYS.map((k) => [k, existingModules[k] ?? true]))
  );
  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900 text-sm">Module Availability</h2>
        <p className="text-xs text-slate-500 mt-0.5">Control which site modules are available to client sites under this agency.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {MODULE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between px-5 py-3">
            <div className="text-sm font-medium text-slate-800">{MODULE_LABELS[key]}</div>
            <Switch
              checked={local[key] ?? true}
              onCheckedChange={(v) => setLocal((m) => ({ ...m, [key]: v }))}
            />
          </div>
        ))}
      </div>
      <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try { await onUpdate(local); } finally { setSaving(false); }
          }}
        >
          {saving ? "Saving…" : "Save Module Availability"}
        </Button>
      </div>
    </div>
  );
}

function PlatformLicensingPanel({
  agency,
  onUpdate,
}: {
  agency: any;
  onUpdate: (data: { licensingStatus?: string; billingNotes?: string }) => Promise<void>;
}) {
  const [status, setStatus] = useState(agency.licensingStatus ?? "active");
  const [notes, setNotes] = useState(agency.billingNotes ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-md p-5 space-y-5">
      <div>
        <h2 className="font-semibold text-slate-900 text-sm mb-3">Licensing & Billing</h2>
      </div>

      <div className="space-y-1.5">
        <Label>Licensing Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LICENSING_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Suspended agencies cannot log in or access the dashboard.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Billing Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Contract terms, renewal dates, invoice references, payment history…"
        />
        <p className="text-xs text-slate-500">Manual billing notes — automated invoicing is not yet available.</p>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onUpdate({ licensingStatus: status, billingNotes: notes || undefined });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
