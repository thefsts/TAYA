import { useState, useEffect } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Save } from "lucide-react";

export default function PopupManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const popup = useQuery(api.contentModules.getPopup, { siteId });
  const upsert = useMutation(api.contentModules.upsertPopup);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [triggerType, setTriggerType] = useState("timed");
  const [delaySeconds, setDelaySeconds] = useState<string>("5");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (popup !== undefined) {
      setTitle(popup?.title ?? "");
      setBody(popup?.body ?? "");
      setCtaLabel(popup?.ctaLabel ?? "");
      setCtaUrl(popup?.ctaUrl ?? "");
      setTriggerType(popup?.triggerType ?? "timed");
      setDelaySeconds(String(popup?.delaySeconds ?? 5));
      setEnabled(popup?.enabled ?? false);
      setDirty(false);
    }
  }, [popup]);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  async function handleSave() {
    if (!title.trim() || !body.trim()) { toast({ title: "Title and body are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await upsert({
        siteId,
        title,
        body,
        ctaLabel: ctaLabel || undefined,
        ctaUrl: ctaUrl || undefined,
        triggerType,
        delaySeconds: triggerType === "timed" ? (parseInt(delaySeconds, 10) || 5) : undefined,
        enabled,
      });
      toast({ title: "Popup configuration saved" });
      setDirty(false);
    } catch (err) {
      toast({ title: "Error saving popup", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  }

  if (popup === undefined) return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Popup Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure a promotional or lead-capture popup for your visitors.</p>
        </div>
      </div>

      <div className="max-w-xl space-y-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <Switch checked={enabled} onCheckedChange={mark(setEnabled)} id="popup-enabled" />
          <Label htmlFor="popup-enabled" className="cursor-pointer">
            Popup is <span className={enabled ? "text-green-600 font-semibold" : "text-slate-400"}>{enabled ? "active" : "disabled"}</span>
          </Label>
        </div>

        <div><Label>Headline</Label><Input className="mt-1" value={title} onChange={(e) => mark(setTitle)(e.target.value)} placeholder="Don't miss our next class!" /></div>
        <div><Label>Body Text</Label><Textarea className="mt-1" rows={3} value={body} onChange={(e) => mark(setBody)(e.target.value)} placeholder="Enter your popup message…" /></div>

        <div className="grid grid-cols-2 gap-4">
          <div><Label>CTA Button Label <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input className="mt-1" value={ctaLabel} onChange={(e) => mark(setCtaLabel)(e.target.value)} placeholder="View Schedule" /></div>
          <div><Label>CTA URL <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input className="mt-1" value={ctaUrl} onChange={(e) => mark(setCtaUrl)(e.target.value)} placeholder="/courses" /></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Trigger</Label>
            <Select value={triggerType} onValueChange={(v) => { mark(setTriggerType)(v); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="timed">Timed (after delay)</SelectItem>
                <SelectItem value="exit">Exit Intent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {triggerType === "timed" && (
            <div>
              <Label>Delay (seconds)</Label>
              <Input type="number" min={0} className="mt-1" value={delaySeconds} onChange={(e) => mark(setDelaySeconds)(e.target.value)} />
            </div>
          )}
        </div>

        {enabled && title && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Preview</p>
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-lg max-w-sm">
              <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
              {body && <p className="text-sm text-slate-600 mb-3">{body}</p>}
              {ctaLabel && <button className="bg-primary text-white text-sm font-medium px-3 py-1.5 rounded pointer-events-none">{ctaLabel}</button>}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save Popup Config"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
