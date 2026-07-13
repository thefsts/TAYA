import { useState, useEffect } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Layers, Save } from "lucide-react";

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
  title: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  triggerType: "timed",
  delaySecs: "5",
  isEnabled: false,
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
      toast({ title: "Popup config saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  if (existing === undefined) {
    return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-start gap-2 mb-6">
        <Layers className="w-6 h-6 text-slate-500 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Popup / Modal Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure a timed or exit-intent popup shown to visitors on your website.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))}
            />
            <div>
              <Label className="text-base">Enable popup</Label>
              <p className="text-xs text-slate-400">Show this popup to visitors on your website</p>
            </div>
          </div>

          <div>
            <Label>Popup Title *</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Special Offer — Register Today!"
            />
          </div>

          <div>
            <Label>Body Text *</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="The message shown in the popup body…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CTA Button Label</Label>
              <Input
                className="mt-1"
                value={form.ctaLabel}
                onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                placeholder="e.g. Register Now"
              />
            </div>
            <div>
              <Label>CTA Button URL</Label>
              <Input
                className="mt-1"
                value={form.ctaUrl}
                onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                placeholder="/register or https://…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Trigger Type</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.triggerType}
                onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
              >
                <option value="timed">Timed (after delay)</option>
                <option value="exit">Exit Intent</option>
                <option value="scroll">Scroll (50% page)</option>
              </select>
            </div>
            {form.triggerType === "timed" && (
              <div>
                <Label>Delay (seconds)</Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  className="mt-1"
                  value={form.delaySecs}
                  onChange={(e) => setForm((f) => ({ ...f, delaySecs: e.target.value }))}
                />
              </div>
            )}
          </div>

          {form.title && form.body && (
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Preview</p>
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm max-w-sm">
                <p className="font-bold text-slate-900 text-sm mb-2">{form.title}</p>
                <p className="text-slate-600 text-sm mb-4">{form.body}</p>
                {form.ctaLabel && (
                  <button className="bg-primary text-white text-sm px-4 py-2 rounded font-medium">
                    {form.ctaLabel}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Saving…" : "Save Popup Config"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
