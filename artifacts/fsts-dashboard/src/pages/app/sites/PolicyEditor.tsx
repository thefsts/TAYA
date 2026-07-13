import { useState, useEffect } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save } from "lucide-react";

const POLICY_TYPES = [
  { key: "privacy", label: "Privacy Policy" },
  { key: "terms", label: "Terms of Service" },
  { key: "cookie", label: "Cookie Policy" },
  { key: "accessibility", label: "Accessibility Statement" },
] as const;

function PolicyTab({
  siteId,
  policyType,
  label,
}: {
  siteId: Id<"sites">;
  policyType: string;
  label: string;
}) {
  const { toast } = useToast();
  const existing = useQuery(api.policies.get, { siteId, policyType });
  const upsert = useMutation(api.policies.upsert);
  const [content, setContent] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing !== undefined && !loaded) {
      setContent(existing?.content ?? "");
      setLoaded(true);
    }
  }, [existing, loaded]);

  async function handleSave() {
    setIsPending(true);
    try {
      await upsert({ siteId, policyType, content });
      toast({ title: `${label} saved` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  if (existing === undefined) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
          {existing?.updatedAt && (
            <p className="text-xs text-slate-400 mt-0.5">
              Last saved: {new Date(existing.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      <Textarea
        className="min-h-[480px] font-mono text-sm"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Enter your ${label} content here. Markdown is supported.`}
      />
      <p className="text-xs text-slate-400">
        Tip: Markdown formatting (headings, bold, lists) is supported and will be rendered on your website.
      </p>
    </div>
  );
}

export default function PolicyEditor({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const [activeTab, setActiveTab] = useState<string>("privacy");

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-start gap-2 mb-6">
        <Shield className="w-6 h-6 text-slate-500 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policy Pages</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Edit your site&apos;s legal and compliance pages. Content is saved per document.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-0">
        {POLICY_TYPES.map((pt) => (
          <button
            key={pt.key}
            onClick={() => setActiveTab(pt.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === pt.key
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {POLICY_TYPES.map((pt) =>
        activeTab === pt.key ? (
          <PolicyTab key={pt.key} siteId={siteId} policyType={pt.key} label={pt.label} />
        ) : null,
      )}
    </AppLayout>
  );
}
