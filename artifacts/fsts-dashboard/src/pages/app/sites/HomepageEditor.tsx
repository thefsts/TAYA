import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, History } from "lucide-react";
import { Link } from "wouter";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import { PublishValidationModal } from "@/components/PublishValidationModal";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";

type Section = { heading: string; body: string };

function asSections(raw: unknown[]): Section[] {
  return (raw as Section[]) ?? [];
}

export default function HomepageEditor({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.homepage.get, { siteId });
  const updateHomepageContent = useMutation(api.homepage.update);

  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubheadline, setHeroSubheadline] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  useEffect(() => {
    if (data) {
      setHeroHeadline(data.heroHeadline ?? "");
      setHeroSubheadline(data.heroSubheadline ?? "");
      setHeroImageUrl(data.heroImageUrl ?? "");
      setSections(asSections((data.sections as unknown[]) ?? []));
    }
  }, [data]);

  async function handleSave() {
    setIsPending(true);
    try {
      await updateHomepageContent({
        siteId,
        heroHeadline,
        heroSubheadline,
        heroImageUrl: heroImageUrl || undefined,
        sections,
      });
      toast({ title: "Homepage updated" });
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  if (data === undefined) {
    return (
      <AppLayout siteId={params.siteId}>
        <Skeleton className="h-64" />
      </AppLayout>
    );
  }

  if (data === null) {
    return (
      <AppLayout siteId={params.siteId}>
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Unable to load Homepage Editor — you may not have access to this site or the homepage module is disabled.
        </div>
      </AppLayout>
    );
  }

  const validationData = {
    title: heroHeadline,
    imageUrl: heroImageUrl || undefined,
    description: heroSubheadline,
    body: sections.map((s) => `${s.heading} ${s.body}`).join(" "),
  };

  const pageContext = [
    `Page: Homepage Editor`,
    heroHeadline ? `Hero headline: "${heroHeadline}" (${heroHeadline.split(/\s+/).filter(Boolean).length} words)` : `Hero headline: (empty)`,
    heroSubheadline ? `Hero subheadline: "${heroSubheadline}"` : `Hero subheadline: (empty)`,
    heroImageUrl ? `Hero image: set` : `Hero image: not set`,
    sections.length > 0
      ? `Content sections (${sections.length}): ${sections.map((s, i) => `${i + 1}. "${s.heading || "(untitled)"}"`).join(", ")}`
      : `Content sections: none`,
    ...sections.map((s, i) =>
      s.body ? `Section ${i + 1} body preview: "${s.body.slice(0, 120)}${s.body.length > 120 ? "…" : ""}"` : `Section ${i + 1} body: (empty)`
    ),
  ].join("\n");

  return (
    <AppLayout siteId={params.siteId} pageContext={pageContext}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Homepage Editor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Edit the hero section and content sections shown on the homepage.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={() => setValidationOpen(true)} disabled={isPending}>
            Publish
          </Button>
        </div>
      </div>

      <LivePreviewPanel siteId={siteId} section="homepage">
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-slate-900">Hero Section</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input aria-label="hero headline" value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Subheadline</Label>
                <Input aria-label="hero subheadline" value={heroSubheadline} onChange={(e) => setHeroSubheadline(e.target.value)} />
              </div>
              <ImagePickerField
                siteId={params.siteId}
                label="Hero Image"
                value={heroImageUrl}
                onChange={setHeroImageUrl}
                initialPreset={SITE_PRESETS.find((p) => p.label === "Hero Banner")}
                hint="Recommended: 1920×600 px, wide landscape format."
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-slate-900">Content Sections</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSections([...sections, { heading: "", body: "" }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Section
              </Button>
            </div>
            <div className="space-y-4">
              {sections.map((s, i) => (
                <div key={i} className="border border-slate-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Section heading"
                      placeholder="Section heading"
                      value={s.heading}
                      onChange={(e) => {
                        const next = [...sections];
                        next[i] = { ...s, heading: e.target.value };
                        setSections(next);
                      }}
                    />
                    <Button aria-label="Delete" type="button" variant="ghost" size="sm" onClick={() => setSections(sections.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <Textarea
                    aria-label="Section body"
                    rows={3}
                    placeholder="Section body"
                    value={s.body}
                    onChange={(e) => {
                      const next = [...sections];
                      next[i] = { ...s, body: e.target.value };
                      setSections(next);
                    }}
                  />
                </div>
              ))}
              {sections.length === 0 && <p className="text-sm text-slate-500">No content sections yet.</p>}
            </div>
          </div>
        </div>
      </LivePreviewPanel>

      <div className="mt-4 flex justify-end">
        <Link href={`/app/sites/${params.siteId}/history`}>
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
            <History className="mr-1.5 h-4 w-4" />
            Revision History
          </Button>
        </Link>
      </div>

      <PublishValidationModal
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        onPublish={handleSave}
        data={validationData}
        title="Homepage"
      />
    </AppLayout>
  );
}
