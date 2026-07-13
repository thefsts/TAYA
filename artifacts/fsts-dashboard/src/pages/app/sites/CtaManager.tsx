import { useState, useEffect } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MousePointer, Save } from "lucide-react";

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
      toast({ title: "CTA config saved" });
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
        <MousePointer className="w-6 h-6 text-slate-500 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CTA Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure the primary and secondary call-to-action buttons used across your website.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Primary CTA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Button Label *</Label>
              <Input
                className="mt-1"
                value={form.primaryLabel}
                onChange={(e) => setForm((f) => ({ ...f, primaryLabel: e.target.value }))}
                placeholder="e.g. Book a Class"
              />
            </div>
            <div>
              <Label>URL *</Label>
              <Input
                className="mt-1"
                value={form.primaryUrl}
                onChange={(e) => setForm((f) => ({ ...f, primaryUrl: e.target.value }))}
                placeholder="/register or https://…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Secondary CTA <span className="text-slate-400 font-normal text-sm">(optional)</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Button Label</Label>
              <Input
                className="mt-1"
                value={form.secondaryLabel}
                onChange={(e) => setForm((f) => ({ ...f, secondaryLabel: e.target.value }))}
                placeholder="e.g. Learn More"
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                className="mt-1"
                value={form.secondaryUrl}
                onChange={(e) => setForm((f) => ({ ...f, secondaryUrl: e.target.value }))}
                placeholder="/about or https://…"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Saving…" : "Save CTA Config"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
