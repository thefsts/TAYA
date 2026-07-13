import { useState, useEffect } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, FileText } from "lucide-react";

const POLICY_TYPES = [
  { type: "privacy",       label: "Privacy Policy",        defaultTitle: "Privacy Policy" },
  { type: "terms",         label: "Terms of Service",      defaultTitle: "Terms of Service" },
  { type: "cookie",        label: "Cookie Policy",         defaultTitle: "Cookie Policy" },
  { type: "accessibility", label: "Accessibility Statement", defaultTitle: "Accessibility Statement" },
];

function PolicyTab({ siteId, type, defaultTitle }: { siteId: Id<"sites">; type: string; defaultTitle: string }) {
  const { toast } = useToast();
  const policy = useQuery(api.contentModules.getPolicy, { siteId, type });
  const upsert = useMutation(api.contentModules.upsertPolicy);

  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (policy !== undefined) {
      setTitle(policy?.title ?? defaultTitle);
      setBody(policy?.body ?? "");
      setDirty(false);
    }
  }, [policy, defaultTitle]);

  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Title and body are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await upsert({ siteId, type, title, body });
      toast({ title: "Policy saved" });
      setDirty(false);
    } catch (err) {
      toast({ title: "Error saving policy", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (policy === undefined) return <Skeleton className="h-64 mt-4" />;

  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label>Page Title</Label>
        <Input className="mt-1" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
      </div>
      <div>
        <Label>Content <span className="text-slate-400 font-normal text-xs ml-1">(Markdown supported)</span></Label>
        <Textarea
          className="mt-1 font-mono text-sm"
          rows={20}
          value={body}
          onChange={(e) => { setBody(e.target.value); setDirty(true); }}
          placeholder={`# ${defaultTitle}\n\nEnter your policy content here…`}
        />
      </div>
      {policy?.lastUpdated && (
        <p className="text-xs text-slate-400">Last updated: {new Date(policy.lastUpdated).toLocaleString()}</p>
      )}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save Policy"}
        </Button>
      </div>
    </div>
  );
}

export default function PolicyEditor({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policy Pages</h1>
          <p className="text-sm text-slate-500 mt-0.5">Edit your site's legal and accessibility policy documents.</p>
        </div>
      </div>

      <Tabs defaultValue="privacy">
        <TabsList className="mb-2">
          {POLICY_TYPES.map((p) => (
            <TabsTrigger key={p.type} value={p.type}>{p.label}</TabsTrigger>
          ))}
        </TabsList>
        {POLICY_TYPES.map((p) => (
          <TabsContent key={p.type} value={p.type}>
            <PolicyTab siteId={siteId} type={p.type} defaultTitle={p.defaultTitle} />
          </TabsContent>
        ))}
      </Tabs>
    </AppLayout>
  );
}
