import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, MousePointerClick } from "lucide-react";
import { ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";
import { VisualEditorShell } from "@/components/VisualEditorShell";

type CtaForm = {
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
};

const defaultForm: CtaForm = {
  primaryLabel: "",
  primaryUrl: "",
  secondaryLabel: "",
  secondaryUrl: "",
};

export default function CtaManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const existing = useQuery(api.cta.get, { siteId });
  const upsert = useMutation(api.cta.upsert);
  const [form, setForm] = useState<CtaForm>(defaultForm);
  const [isPending, setIsPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing !== undefined && !loaded) {
      if (existing) {
        setForm({
          primaryLabel: existing.primaryLabel ?? "",
          primaryUrl: existing.primaryUrl ?? "",
          secondaryLabel: existing.secondaryLabel ?? "",
          secondaryUrl: existing.secondaryUrl ?? "",
        });
      }
      setLoaded(true);
    }
  }, [existing, loaded]);

  async function handleSave() {
    if (!form.primaryLabel.trim() || !form.primaryUrl.trim()) {
      toast({ title: "Primary CTA label and URL are required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      await upsert({
        siteId,
        primaryLabel: form.primaryLabel,
        primaryUrl: form.primaryUrl,
        secondaryLabel: form.secondaryLabel || undefined,
        secondaryUrl: form.secondaryUrl || undefined,
      });
      toast({ title: "CTA settings saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  if (existing === undefined) {
    return <AppLayout siteId={params.siteId}><ClientLoadingList rows={3} /></AppLayout>;
  }

  const primaryReady = Boolean(form.primaryLabel.trim() && form.primaryUrl.trim());
  const secondaryReady = Boolean(form.secondaryLabel.trim() && form.secondaryUrl.trim());

  // Track unsaved changes against the saved singleton so the shell's
  // "Unsaved changes" indicator, Discard action, and save button reflect
  // the real editing state.
  const isDirty = !!(existing && (
    form.primaryLabel !== (existing.primaryLabel ?? "") ||
    form.primaryUrl !== (existing.primaryUrl ?? "") ||
    form.secondaryLabel !== (existing.secondaryLabel ?? "") ||
    form.secondaryUrl !== (existing.secondaryUrl ?? "")
  ));

  function handleDiscard() {
    if (existing) {
      setForm({
        primaryLabel: existing.primaryLabel ?? "",
        primaryUrl: existing.primaryUrl ?? "",
        secondaryLabel: existing.secondaryLabel ?? "",
        secondaryUrl: existing.secondaryUrl ?? "",
      });
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <VisualEditorShell
        siteId={siteId}
        title="Call-to-Action Manager"
        subtitle="Control the primary and optional secondary buttons used across your website without changing the site layout."
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={isPending}
        saveLabel="Save Changes"
        historyHref={`/app/sites/${params.siteId}/history`}
        moduleId="cta"
        previewPath="/"
        showPublish={false}
      >
      <ClientPageHeader
        eyebrow="Website Actions"
        title="Call-to-Action Manager"
        description="Control the primary and optional secondary buttons used across your website without changing the site layout."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="space-y-6">
          <ClientSection title="Primary CTA" description="This is the main action visitors should take on your website.">
            <div className="space-y-5 p-4 sm:p-5">
              <div className="space-y-1.5">
                <Label>Button Label *</Label>
                <Input aria-label="primary label" value={form.primaryLabel} onChange={(e) => setForm((f) => ({ ...f, primaryLabel: e.target.value }))} placeholder="e.g. Book a Class" />
              </div>
              <div className="space-y-1.5">
                <Label>Destination URL *</Label>
                <Input aria-label="primary url" value={form.primaryUrl} onChange={(e) => setForm((f) => ({ ...f, primaryUrl: e.target.value }))} placeholder="/register or https://…" />
                <p className="text-xs leading-5 text-slate-400">Use a website path for an internal page or a full https:// link for an external destination.</p>
              </div>
            </div>
          </ClientSection>

          <ClientSection title="Secondary CTA" description="Optional supporting action for visitors who are not ready to take the primary action.">
            <div className="space-y-5 p-4 sm:p-5">
              <div className="space-y-1.5">
                <Label>Button Label</Label>
                <Input aria-label="secondary label" value={form.secondaryLabel} onChange={(e) => setForm((f) => ({ ...f, secondaryLabel: e.target.value }))} placeholder="e.g. Learn More" />
              </div>
              <div className="space-y-1.5">
                <Label>Destination URL</Label>
                <Input aria-label="secondary url" value={form.secondaryUrl} onChange={(e) => setForm((f) => ({ ...f, secondaryUrl: e.target.value }))} placeholder="/about or https://…" />
              </div>
            </div>
          </ClientSection>
        </div>

        <aside>
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <MousePointerClick className="h-5 w-5 text-emerald-300" />
            </div>
            <h2 className="text-base font-semibold">CTA Preview</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">This preview shows button labels and destinations only. Website styling and placement remain controlled by the site design.</p>
            <div className="mt-5 space-y-3 border-t border-slate-800 pt-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primary</p>
                <p className="mt-1 font-semibold text-white">{form.primaryLabel || "Primary button label"}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400"><ExternalLink className="h-3 w-3" />{form.primaryUrl || "No URL entered"}</p>
                <p className={`mt-2 text-xs font-medium ${primaryReady ? "text-emerald-300" : "text-amber-300"}`}>{primaryReady ? "Ready to publish" : "Label and URL required"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Secondary</p>
                <p className="mt-1 font-semibold text-white">{form.secondaryLabel || "Optional secondary button"}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400"><ExternalLink className="h-3 w-3" />{form.secondaryUrl || "No URL entered"}</p>
                <p className={`mt-2 text-xs font-medium ${secondaryReady ? "text-emerald-300" : "text-slate-500"}`}>{secondaryReady ? "Ready to publish" : "Optional"}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
      </VisualEditorShell>
    </AppLayout>
  );
}
