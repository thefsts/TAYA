import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Clock3, Layers, MousePointerClick, Save, Sparkles } from "lucide-react";
import { ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

type PopupForm = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  triggerType: string;
  delaySecs: string;
  isEnabled: boolean;
};

const defaultForm: PopupForm = {
  title: "", body: "", ctaLabel: "", ctaUrl: "", triggerType: "timed", delaySecs: "5", isEnabled: false,
};

const triggerLabels: Record<string, string> = {
  timed: "Timed delay",
  exit: "Exit intent",
  scroll: "50% page scroll",
};

export default function PopupManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const existing = useQuery(api.popup.get, { siteId });
  const upsert = useMutation(api.popup.upsert);
  const [form, setForm] = useState<PopupForm>(defaultForm);
  const [isPending, setIsPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing !== undefined && !loaded) {
      if (existing) {
        setForm({
          title: existing.title ?? "",
          body: existing.body ?? "",
          ctaLabel: existing.ctaLabel ?? "",
          ctaUrl: existing.ctaUrl ?? "",
          triggerType: existing.triggerType ?? "timed",
          delaySecs: String(existing.delaySecs ?? 5),
          isEnabled: existing.isEnabled ?? false,
        });
      }
      setLoaded(true);
    }
  }, [existing, loaded]);

  async function handleSave() {
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Title and body text are required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      await upsert({
        siteId,
        title: form.title,
        body: form.body,
        ctaLabel: form.ctaLabel || undefined,
        ctaUrl: form.ctaUrl || undefined,
        triggerType: form.triggerType,
        delaySecs: form.triggerType === "timed" ? Number(form.delaySecs) || 5 : undefined,
        isEnabled: form.isEnabled,
      });
      toast({ title: "Popup settings saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  if (existing === undefined) return <AppLayout siteId={params.siteId}><ClientLoadingList rows={4} /></AppLayout>;

  const contentReady = Boolean(form.title.trim() && form.body.trim());
  const ctaReady = Boolean(form.ctaLabel.trim() && form.ctaUrl.trim());

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader
        eyebrow="Visitor Engagement"
        title="Popup Manager"
        description="Create an approved website popup for promotions, registrations, announcements, or other visitor actions."
        actions={<Button onClick={handleSave} disabled={isPending} className="shadow-sm"><Save className="mr-2 h-4 w-4" />{isPending ? "Saving…" : "Save Popup"}</Button>}
        meta={<span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${form.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{form.isEnabled ? "Enabled" : "Disabled"}</span>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <div className="space-y-6">
          <ClientSection title="Popup Content" description="Control the visitor-facing message and optional action button.">
            <div className="space-y-5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div><Label className="text-sm font-semibold text-slate-900">Show popup on website</Label><p className="mt-0.5 text-xs leading-5 text-slate-500">Turn this off to keep the popup saved without showing it publicly.</p></div>
                <Switch checked={form.isEnabled} onCheckedChange={(value) => setForm((current) => ({ ...current, isEnabled: value }))} />
              </div>
              <div className="space-y-1.5"><Label>Popup Title *</Label><Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="e.g. Registration is now open" /></div>
              <div className="space-y-1.5"><Label>Body Text *</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm((current) => ({ ...current, body: e.target.value }))} placeholder="Add a short message explaining what visitors should know or do." /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>CTA Button Label</Label><Input value={form.ctaLabel} onChange={(e) => setForm((current) => ({ ...current, ctaLabel: e.target.value }))} placeholder="e.g. Register Now" /></div>
                <div className="space-y-1.5"><Label>CTA Button URL</Label><Input value={form.ctaUrl} onChange={(e) => setForm((current) => ({ ...current, ctaUrl: e.target.value }))} placeholder="/register or https://…" /></div>
              </div>
              {(form.ctaLabel && !form.ctaUrl) || (!form.ctaLabel && form.ctaUrl) ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">For a working action button, enter both the button label and destination URL.</p> : null}
            </div>
          </ClientSection>

          <ClientSection title="Display Trigger" description="Choose when the popup should appear for a website visitor.">
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div className="space-y-1.5">
                <Label>Trigger Type</Label>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={form.triggerType} onChange={(e) => setForm((current) => ({ ...current, triggerType: e.target.value }))}>
                  <option value="timed">Timed (after delay)</option><option value="exit">Exit Intent</option><option value="scroll">Scroll (50% page)</option>
                </select>
              </div>
              {form.triggerType === "timed" && <div className="space-y-1.5"><Label>Delay (seconds)</Label><Input type="number" min="1" max="60" value={form.delaySecs} onChange={(e) => setForm((current) => ({ ...current, delaySecs: e.target.value }))} /><p className="text-xs text-slate-400">Recommended: 3–10 seconds.</p></div>}
            </div>
          </ClientSection>
        </div>

        <aside>
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">Popup Preview</p><h2 className="mt-1 text-base font-semibold">Visitor view</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"><Layers className="h-5 w-5 text-slate-300" /></div></div>
              {contentReady ? <div className="rounded-xl bg-white p-5 text-slate-900 shadow-lg"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10"><Sparkles className="h-4 w-4 text-primary" /></div><p className="font-bold">{form.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{form.body}</p>{form.ctaLabel && <button type="button" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">{form.ctaLabel}</button>}</div> : <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">Add a title and message to preview the popup.</div>}
              <div className="mt-4 space-y-2 border-t border-slate-800 pt-4 text-xs"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-400"><Clock3 className="h-3.5 w-3.5" />Trigger</span><span className="font-medium text-slate-200">{triggerLabels[form.triggerType] ?? form.triggerType}</span></div><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-400"><MousePointerClick className="h-3.5 w-3.5" />Action</span><span className={`font-medium ${ctaReady ? "text-emerald-300" : "text-slate-500"}`}>{ctaReady ? "Configured" : "Optional"}</span></div></div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">Clients control popup content, timing, and visibility here. The approved website layout and styling remain protected.</div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
