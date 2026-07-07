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
import { Plus, Trash2 } from "lucide-react";

type LinkColumn = { heading: string; links: { label: string; url: string }[] };
type SocialLink = { platform: string; url: string };

function asColumns(raw: unknown[]): LinkColumn[] {
  return (raw as LinkColumn[]) ?? [];
}
function asSocialLinks(raw: unknown[]): SocialLink[] {
  return (raw as SocialLink[]) ?? [];
}

export default function FooterEditor({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.footer.get, { siteId });
  const updateFooterContent = useMutation(api.footer.update);

  const [copyrightText, setCopyrightText] = useState("");
  const [columns, setColumns] = useState<LinkColumn[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (data) {
      setCopyrightText(data.copyrightText ?? "");
      setColumns(asColumns((data.columns as unknown[]) ?? []));
      setSocialLinks(asSocialLinks((data.socialLinks as unknown[]) ?? []));
    }
  }, [data]);

  async function handleSave() {
    setIsPending(true);
    try {
      await updateFooterContent({ siteId, copyrightText, columns, socialLinks });
      toast({ title: "Footer updated" });
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

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Footer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Footer link columns, social links, and copyright text.</p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="space-y-6 max-w-3xl">
        <div className="bg-white p-6 border border-slate-200 rounded-md shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-900">Link Columns</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setColumns([...columns, { heading: "", links: [] }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Column
            </Button>
          </div>
          <div className="space-y-4">
            {columns.map((col, ci) => (
              <div key={ci} className="border border-slate-200 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Column heading"
                    value={col.heading}
                    onChange={(e) => {
                      const next = [...columns];
                      next[ci] = { ...col, heading: e.target.value };
                      setColumns(next);
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setColumns(columns.filter((_, i) => i !== ci))}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                {col.links.map((link, li) => (
                  <div key={li} className="flex items-center gap-2 pl-4">
                    <Input
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => {
                        const next = [...columns];
                        const links = [...col.links];
                        links[li] = { ...link, label: e.target.value };
                        next[ci] = { ...col, links };
                        setColumns(next);
                      }}
                    />
                    <Input
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) => {
                        const next = [...columns];
                        const links = [...col.links];
                        links[li] = { ...link, url: e.target.value };
                        next[ci] = { ...col, links };
                        setColumns(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const next = [...columns];
                        next[ci] = { ...col, links: col.links.filter((_, i) => i !== li) };
                        setColumns(next);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = [...columns];
                    next[ci] = { ...col, links: [...col.links, { label: "", url: "" }] };
                    setColumns(next);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Link
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-md shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-900">Social Links</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSocialLinks([...socialLinks, { platform: "", url: "" }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {socialLinks.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Platform (e.g. LinkedIn)"
                  value={s.platform}
                  onChange={(e) => {
                    const next = [...socialLinks];
                    next[i] = { ...s, platform: e.target.value };
                    setSocialLinks(next);
                  }}
                />
                <Input
                  placeholder="URL"
                  value={s.url}
                  onChange={(e) => {
                    const next = [...socialLinks];
                    next[i] = { ...s, url: e.target.value };
                    setSocialLinks(next);
                  }}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setSocialLinks(socialLinks.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-md shadow-sm">
          <Label>Copyright Text</Label>
          <Textarea rows={2} className="mt-1.5" value={copyrightText} onChange={(e) => setCopyrightText(e.target.value)} />
        </div>
      </div>
    </AppLayout>
  );
}
