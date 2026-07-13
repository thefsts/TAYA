import { useState, useEffect } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MousePointerClick, Save } from "lucide-react";

export default function CtaManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const cta = useQuery(api.contentModules.getCta, { siteId });
  const upsert = useMutation(api.contentModules.upsertCta);

  const [primaryLabel, setPrimaryLabel] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [secondaryLabel, setSecondaryLabel] = useState("");
  const [secondaryUrl, setSecondaryUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (cta !== undefined) {
      setPrimaryLabel(cta?.primaryLabel ?? "");
      setPrimaryUrl(cta?.primaryUrl ?? "");
      setSecondaryLabel(cta?.secondaryLabel ?? "");
      setSecondaryUrl(cta?.secondaryUrl ?? "");
      setDirty(false);
    }
  }, [cta]);

  function field<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  async function handleSave() {
    if (!primaryLabel.trim() || !primaryUrl.trim()) {
      toast({ title: "Primary label and URL are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await upsert({ siteId, primaryLabel, primaryUrl, secondaryLabel: secondaryLabel || undefined, secondaryUrl: secondaryUrl || undefined });
      toast({ title: "CTA configuration saved" });
      setDirty(false);
    } catch (err) {
      toast({ title: "Error saving CTA", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (cta === undefined) return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center gap-3 mb-6">
        <MousePointerClick className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CTA Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure the primary and secondary call-to-action buttons used sitewide.</p>
        </div>
      </div>

      <div className="max-w-xl bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">Primary CTA</h2>
          <div className="space-y-3">
            <div>
              <Label>Button Label</Label>
              <Input className="mt-1" value={primaryLabel} onChange={(e) => field(setPrimaryLabel)(e.target.value)} placeholder="Book a Consultation" />
            </div>
            <div>
              <Label>URL</Label>
              <Input className="mt-1" value={primaryUrl} onChange={(e) => field(setPrimaryUrl)(e.target.value)} placeholder="/contact" />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h2 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">Secondary CTA <span className="text-slate-400 font-normal normal-case">(optional)</span></h2>
          <div className="space-y-3">
            <div>
              <Label>Button Label</Label>
              <Input className="mt-1" value={secondaryLabel} onChange={(e) => field(setSecondaryLabel)(e.target.value)} placeholder="View Courses" />
            </div>
            <div>
              <Label>URL</Label>
              <Input className="mt-1" value={secondaryUrl} onChange={(e) => field(setSecondaryUrl)(e.target.value)} placeholder="/courses" />
            </div>
          </div>
        </div>

        {(primaryLabel || secondaryLabel) && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500 mb-2">Preview</p>
            <div className="flex items-center gap-3">
              {primaryLabel && <button className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium pointer-events-none">{primaryLabel}</button>}
              {secondaryLabel && <button className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium pointer-events-none">{secondaryLabel}</button>}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save CTA Config"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
