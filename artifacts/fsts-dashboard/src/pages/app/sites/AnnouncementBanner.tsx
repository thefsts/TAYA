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
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Save } from "lucide-react";

type BannerForm = {
  text: string;
  bgColor: string;
  link: string;
  isEnabled: boolean;
};

const defaultForm: BannerForm = {
  text: "",
  bgColor: "#1e3a5f",
  link: "",
  isEnabled: false,
};

export default function AnnouncementBanner({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const existing = useQuery(api.announcement.get, { siteId });
  const upsert = useMutation(api.announcement.upsert);

  const [form, setForm] = useState<BannerForm>(defaultForm);
  const [isPending, setIsPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing !== undefined && !loaded) {
      if (existing) {
        setForm({
          text: existing.text ?? "",
          bgColor: existing.bgColor ?? "#1e3a5f",
          link: existing.link ?? "",
          isEnabled: existing.isEnabled ?? false,
        });
      }
      setLoaded(true);
    }
  }, [existing, loaded]);

  async function handleSave() {
    if (!form.text.trim()) {
      toast({ title: "Banner text is required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      await upsert({
        siteId,
        text: form.text,
        bgColor: form.bgColor,
        link: form.link || undefined,
        isEnabled: form.isEnabled,
      });
      toast({ title: "Announcement banner saved" });
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
        <Megaphone className="w-6 h-6 text-slate-500 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcement Banner</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Display a site-wide banner at the top of your website.
          </p>
        </div>
      </div>

      {form.text && (
        <div
          className="mb-6 px-4 py-3 rounded-lg text-white text-sm flex items-center justify-between gap-4"
          style={{ backgroundColor: form.bgColor }}
        >
          <span>{form.text}</span>
          {form.link && (
            <a href={form.link} className="underline text-white/80 hover:text-white text-xs shrink-0">
              Learn more →
            </a>
          )}
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))}
            />
            <div>
              <Label className="text-base">Enable banner</Label>
              <p className="text-xs text-slate-400">Show this banner on your website</p>
            </div>
          </div>

          <div>
            <Label>Banner Text *</Label>
            <Input
              className="mt-1"
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="e.g. 🎉 New classes available — register now!"
            />
          </div>

          <div>
            <Label>Link URL (optional)</Label>
            <Input
              className="mt-1"
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="https://… or /register"
            />
            <p className="text-xs text-slate-400 mt-1">A "Learn more" link will appear if set.</p>
          </div>

          <div>
            <Label>Background Color</Label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="color"
                value={form.bgColor}
                onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                className="h-10 w-14 rounded border border-slate-200 cursor-pointer p-0.5"
              />
              <Input
                value={form.bgColor}
                onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                className="font-mono w-36"
                placeholder="#1e3a5f"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Saving…" : "Save Banner"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
