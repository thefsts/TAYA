import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useGetHomepageContent, useUpdateHomepageContent } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Section = { heading: string; body: string };

function asSections(raw: unknown[]): Section[] {
  return (raw as Section[]) ?? [];
}

export default function HomepageEditor({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useGetHomepageContent(siteId);
  const updateMutation = useUpdateHomepageContent();

  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubheadline, setHeroSubheadline] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (data) {
      setHeroHeadline(data.heroHeadline);
      setHeroSubheadline(data.heroSubheadline);
      setHeroImageUrl(data.heroImageUrl ?? "");
      setSections(asSections(data.sections));
    }
  }, [data]);

  function handleSave() {
    updateMutation.mutate(
      {
        siteId,
        data: {
          heroHeadline,
          heroSubheadline,
          heroImageUrl: heroImageUrl || undefined,
          sections,
        },
      },
      {
        onSuccess: () => toast({ title: "Homepage updated" }),
        onError: (err) =>
          toast({
            title: "Something went wrong",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
  }

  if (isLoading) {
    return (
      <AppLayout siteId={params.siteId}>
        <Skeleton className="h-64" />
      </AppLayout>
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Homepage Editor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Edit the hero section and content sections shown on the homepage.</p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="space-y-6 max-w-3xl">
        <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-slate-900">Hero Section</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Headline</Label>
              <Input value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Subheadline</Label>
              <Input value={heroSubheadline} onChange={(e) => setHeroSubheadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hero Image URL</Label>
              <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} />
            </div>
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
                    placeholder="Section heading"
                    value={s.heading}
                    onChange={(e) => {
                      const next = [...sections];
                      next[i] = { ...s, heading: e.target.value };
                      setSections(next);
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSections(sections.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                <Textarea
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
    </AppLayout>
  );
}
