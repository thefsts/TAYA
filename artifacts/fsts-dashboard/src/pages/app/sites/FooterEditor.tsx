import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { VisualEditorShell } from "@/components/VisualEditorShell";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copyright, ExternalLink, Link2, Plus, Save, Share2, Trash2 } from "lucide-react";
import { LockedField, DesignLockBanner } from "@/components/LockedField";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

type LinkColumn = { heading: string; links: { label: string; url: string }[] };
type SocialLink = { platform: string; url: string };

const NAMED_PLATFORMS = ["Instagram", "Facebook", "TikTok", "YouTube"] as const;
type NamedPlatform = typeof NAMED_PLATFORMS[number];

function asColumns(raw: unknown[]): LinkColumn[] { return (raw as LinkColumn[]) ?? []; }
function asSocialLinks(raw: unknown[]): SocialLink[] { return (raw as SocialLink[]) ?? []; }
function extractNamed(links: SocialLink[]): Record<NamedPlatform, string> {
  const result = {} as Record<NamedPlatform, string>;
  for (const platform of NAMED_PLATFORMS) {
    const found = links.find((link) => link.platform.toLowerCase() === platform.toLowerCase());
    result[platform] = found?.url ?? "";
  }
  return result;
}
function extractCustom(links: SocialLink[]): SocialLink[] {
  return links.filter((link) => !NAMED_PLATFORMS.some((platform) => platform.toLowerCase() === link.platform.toLowerCase()));
}
function mergeLinks(named: Record<NamedPlatform, string>, custom: SocialLink[]): SocialLink[] {
  const namedLinks = NAMED_PLATFORMS.filter((platform) => named[platform].trim() !== "").map((platform) => ({ platform, url: named[platform].trim() }));
  return [...namedLinks, ...custom.filter((link) => link.platform.trim() || link.url.trim())];
}

export default function FooterEditor({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.footer.get, { siteId });
  const updateFooterContent = useMutation(api.footer.update);

  const [copyrightText, setCopyrightText] = useState("");
  const [columns, setColumns] = useState<LinkColumn[]>([]);
  const [namedPlatforms, setNamedPlatforms] = useState<Record<NamedPlatform, string>>({ Instagram: "", Facebook: "", TikTok: "", YouTube: "" });
  const [customLinks, setCustomLinks] = useState<SocialLink[]>([]);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (data) {
      setCopyrightText(data.copyrightText ?? "");
      setColumns(asColumns((data.columns as unknown[]) ?? []));
      const links = asSocialLinks((data.socialLinks as unknown[]) ?? []);
      setNamedPlatforms(extractNamed(links));
      setCustomLinks(extractCustom(links));
    }
  }, [data]);

  async function handleSave() {
    setIsPending(true);
    try {
      await updateFooterContent({ siteId, copyrightText, columns, socialLinks: mergeLinks(namedPlatforms, customLinks) });
      toast({ title: "Footer updated" });
    } catch (err) {
      toast({ title: "Something went wrong", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  if (data === undefined) return <AppLayout siteId={params.siteId}><ClientLoadingList rows={4} /></AppLayout>;

  const totalLinks = columns.reduce((count, column) => count + column.links.length, 0);
  const socialCount = mergeLinks(namedPlatforms, customLinks).length;

  const isDirty = !!(data && (
    copyrightText !== (data.copyrightText ?? "") ||
    JSON.stringify(columns) !== JSON.stringify(asColumns((data.columns as unknown[]) ?? [])) ||
    JSON.stringify(mergeLinks(namedPlatforms, customLinks)) !== JSON.stringify(asSocialLinks((data.socialLinks as unknown[]) ?? []))
  ));

  function handleDiscard() {
    if (data) {
      setCopyrightText(data.copyrightText ?? "");
      setColumns(asColumns((data.columns as unknown[]) ?? []));
      const links = asSocialLinks((data.socialLinks as unknown[]) ?? []);
      setNamedPlatforms(extractNamed(links));
      setCustomLinks(extractCustom(links));
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <DesignLockBanner label="Footer Layout" />
      <VisualEditorShell
        siteId={siteId}
        title="Footer Editor"
        subtitle="Manage footer link content, social destinations, and copyright text."
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={isPending}
        historyHref={`/app/sites/${params.siteId}/history`}
        moduleId="footer"
        showPublish={false}
      >
      <ClientPageHeader
        eyebrow="Website Structure"
        title="Footer Editor"
        description="Manage footer link content, social destinations, and copyright text while the approved footer layout remains protected."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Link2 className="h-3.5 w-3.5" />Link columns</div><p className="mt-1 text-2xl font-semibold text-slate-900">{columns.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><ExternalLink className="h-3.5 w-3.5" />Footer links</div><p className="mt-1 text-2xl font-semibold text-slate-900">{totalLinks}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Share2 className="h-3.5 w-3.5" />Social links</div><p className="mt-1 text-2xl font-semibold text-slate-900">{socialCount}</p></div>
      </div>

      <div className="space-y-6">
        <LockedField capabilityLabel="Footer Layout">
          <ClientSection title="Link Columns" description="Organize the footer links visitors use to reach important pages and resources." actions={<Button type="button" variant="outline" size="sm" onClick={() => setColumns([...columns, { heading: "", links: [] }])}><Plus className="mr-1.5 h-4 w-4" />Add Column</Button>}>
            {columns.length === 0 ? (
              <ClientEmptyState icon={Link2} compact title="No footer link columns" description="Add a column for grouped footer links such as Company, Resources, or Support." action={<Button type="button" variant="outline" onClick={() => setColumns([{ heading: "", links: [] }])}><Plus className="mr-2 h-4 w-4" />Add First Column</Button>} />
            ) : (
              <div className="grid gap-4 p-4 lg:grid-cols-2 sm:p-5">
                {columns.map((column, columnIndex) => (
                  <div key={columnIndex} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-2">
                      <Input aria-label="Column heading" placeholder="Column heading" value={column.heading} onChange={(e) => { const next = [...columns]; next[columnIndex] = { ...column, heading: e.target.value }; setColumns(next); }} />
                      <Button aria-label="Delete" type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setColumns(columns.filter((_, index) => index !== columnIndex))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {column.links.map((link, linkIndex) => (
                        <div key={linkIndex} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-center">
                          <Input aria-label="Label" placeholder="Label" value={link.label} onChange={(e) => { const next = [...columns]; const links = [...column.links]; links[linkIndex] = { ...link, label: e.target.value }; next[columnIndex] = { ...column, links }; setColumns(next); }} />
                          <Input aria-label="/page or https://…" placeholder="/page or https://…" value={link.url} onChange={(e) => { const next = [...columns]; const links = [...column.links]; links[linkIndex] = { ...link, url: e.target.value }; next[columnIndex] = { ...column, links }; setColumns(next); }} />
                          <Button aria-label="Delete" type="button" variant="ghost" size="sm" className="justify-self-start text-slate-400 hover:bg-red-50 hover:text-red-600 sm:h-9 sm:w-9 sm:p-0" onClick={() => { const next = [...columns]; next[columnIndex] = { ...column, links: column.links.filter((_, index) => index !== linkIndex) }; setColumns(next); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => { const next = [...columns]; next[columnIndex] = { ...column, links: [...column.links, { label: "", url: "" }] }; setColumns(next); }}><Plus className="mr-1.5 h-4 w-4" />Add Link</Button>
                  </div>
                ))}
              </div>
            )}
          </ClientSection>
        </LockedField>

        <LockedField capabilityLabel="Footer Layout">
          <ClientSection title="Social Links" description="Leave a platform blank to keep it out of the public footer.">
            <div className="space-y-6 p-4 sm:p-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Common Platforms</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {NAMED_PLATFORMS.map((platform) => (
                    <div key={platform} className="space-y-1.5"><Label>{platform}</Label><Input aria-label={platform} placeholder={`https://${platform.toLowerCase()}.com/yourpage`} value={namedPlatforms[platform]} onChange={(e) => setNamedPlatforms((previous) => ({ ...previous, [platform]: e.target.value }))} /></div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">Additional Platforms</h3><p className="mt-0.5 text-xs text-slate-500">Add LinkedIn, X, Pinterest, or another approved network.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setCustomLinks([...customLinks, { platform: "", url: "" }])}><Plus className="mr-1.5 h-4 w-4" />Add</Button></div>
                {customLinks.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No additional social platforms configured.</p> : <div className="mt-4 space-y-2">{customLinks.map((social, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]"><Input aria-label="Platform" placeholder="Platform" value={social.platform} onChange={(e) => { const next = [...customLinks]; next[index] = { ...social, platform: e.target.value }; setCustomLinks(next); }} /><Input aria-label="https://…" placeholder="https://…" value={social.url} onChange={(e) => { const next = [...customLinks]; next[index] = { ...social, url: e.target.value }; setCustomLinks(next); }} /><Button aria-label="Delete" type="button" variant="ghost" size="sm" className="justify-self-start text-slate-400 hover:bg-red-50 hover:text-red-600 sm:h-9 sm:w-9 sm:p-0" onClick={() => setCustomLinks(customLinks.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
              </div>
            </div>
          </ClientSection>
        </LockedField>

        <LockedField capabilityLabel="Footer Layout">
          <ClientSection title="Copyright Text" description="Set the copyright or legal line displayed in the footer.">
            <div className="p-4 sm:p-5"><Label className="flex items-center gap-2"><Copyright className="h-3.5 w-3.5 text-slate-400" />Footer copyright</Label><Textarea aria-label="Footer copyright" rows={3} className="mt-2" value={copyrightText} onChange={(e) => setCopyrightText(e.target.value)} placeholder="© 2026 Your Company. All rights reserved." /></div>
          </ClientSection>
        </LockedField>
      </div>
      </VisualEditorShell>
    </AppLayout>
  );
}
