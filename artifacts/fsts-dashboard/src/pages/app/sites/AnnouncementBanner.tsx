import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Megaphone, Save } from "lucide-react";
import { ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

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
    return <AppLayout siteId={params.siteId}><ClientLoadingList rows={3} /></AppLayout>;
  }

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader
        eyebrow="Site-Wide Message"
        title="Announcement Banner"
        description="Create a short message that can appear across the top of your website for important updates, promotions, or alerts."
        actions={
          <Button onClick={handleSave} disabled={isPending} className="shadow-sm">
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Saving…" : "Save Banner"}
          </Button>
        }
        meta={
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${form.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            {form.isEnabled ? "Enabled" : "Disabled"}
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-6">
          <ClientSection title="Banner Settings" description="Control the message, optional link, visibility, and display color.">
            <div className="space-y-5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <Label className="text-sm font-semibold text-slate-900">Show banner on website</Label>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Turn this off to keep the message saved without displaying it publicly.</p>
                </div>
                <Switch checked={form.isEnabled} onCheckedChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))} />
              </div>

              <div className="space-y-1.5">
                <Label>Banner Text *</Label>
                <Input value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} placeholder="e.g. New classes available — register now!" />
                <p className="text-xs leading-5 text-slate-400">Keep the message short so it remains readable on mobile devices.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Link URL</Label>
                <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="/register or https://…" />
                <p className="text-xs leading-5 text-slate-400">Optional. Add an internal page path or a complete external URL.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Background Color</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="color"
                    value={form.bgColor}
                    onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                    className="h-11 w-16 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                    aria-label="Choose banner background color"
                  />
                  <Input value={form.bgColor} onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))} className="font-mono sm:max-w-44" placeholder="#1e3a5f" />
                </div>
              </div>
            </div>
          </ClientSection>
        </div>

        <aside>
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary/80">Live Preview</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">Website banner</h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <Megaphone className="h-5 w-5 text-slate-500" />
              </div>
            </div>

            {form.text ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm">
                <div className="flex flex-col gap-2 px-4 py-3 text-sm text-white sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: form.bgColor }}>
                  <span className="font-medium">{form.text}</span>
                  {form.link && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white/85">
                      Learn more <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Enter banner text to see the preview.
              </div>
            )}

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              The dashboard controls the message content and status. The website keeps its approved layout and responsive behavior.
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
