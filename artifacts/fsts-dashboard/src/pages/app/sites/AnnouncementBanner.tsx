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
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Save } from "lucide-react";

export default function AnnouncementBannerPage({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const banner = useQuery(api.contentModules.getAnnouncement, { siteId });
  const upsert = useMutation(api.contentModules.upsertAnnouncement);

  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [bgColor, setBgColor] = useState("#1e3a5f");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (banner !== undefined) {
      setText(banner?.text ?? "");
      setLinkUrl(banner?.linkUrl ?? "");
      setLinkLabel(banner?.linkLabel ?? "");
      setBgColor(banner?.bgColor ?? "#1e3a5f");
      setEnabled(banner?.enabled ?? false);
      setDirty(false);
    }
  }, [banner]);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  async function handleSave() {
    if (!text.trim()) { toast({ title: "Banner text is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await upsert({ siteId, text, linkUrl: linkUrl || undefined, linkLabel: linkLabel || undefined, bgColor: bgColor || undefined, enabled });
      toast({ title: "Announcement banner saved" });
      setDirty(false);
    } catch (err) {
      toast({ title: "Error saving banner", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (banner === undefined) return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center gap-3 mb-6">
        <Megaphone className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcement Banner</h1>
          <p className="text-sm text-slate-500 mt-0.5">A sitewide banner displayed at the top of every page.</p>
        </div>
      </div>

      <div className="max-w-xl space-y-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
          <Switch checked={enabled} onCheckedChange={mark(setEnabled)} id="banner-enabled" />
          <Label htmlFor="banner-enabled" className="cursor-pointer">
            Banner is <span className={enabled ? "text-green-600 font-semibold" : "text-slate-400"}>{enabled ? "active" : "hidden"}</span>
          </Label>
        </div>

        {enabled && (
          <div
            className="rounded-md px-4 py-2.5 text-sm font-medium text-white flex items-center justify-between gap-4"
            style={{ background: bgColor }}
          >
            <span>{text || "Your banner text will appear here"}</span>
            {linkLabel && linkUrl && <span className="underline text-xs whitespace-nowrap">{linkLabel}</span>}
          </div>
        )}

        <div>
          <Label>Banner Text</Label>
          <Input className="mt-1" value={text} onChange={(e) => mark(setText)(e.target.value)} placeholder="e.g. 🎉 New courses available now — view schedule" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Link URL <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
            <Input className="mt-1" value={linkUrl} onChange={(e) => mark(setLinkUrl)(e.target.value)} placeholder="/courses" />
          </div>
          <div>
            <Label>Link Label <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
            <Input className="mt-1" value={linkLabel} onChange={(e) => mark(setLinkLabel)(e.target.value)} placeholder="View Schedule" />
          </div>
        </div>
        <div>
          <Label>Background Color</Label>
          <div className="flex items-center gap-3 mt-1">
            <input type="color" value={bgColor} onChange={(e) => mark(setBgColor)(e.target.value)} className="h-9 w-16 rounded border border-slate-200 cursor-pointer p-0.5" />
            <Input value={bgColor} onChange={(e) => mark(setBgColor)(e.target.value)} className="font-mono" placeholder="#1e3a5f" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save Banner"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
