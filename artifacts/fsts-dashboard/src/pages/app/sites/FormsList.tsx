import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Copy, ClipboardCopy, FormInput, Globe, Inbox, Archive,
} from "lucide-react";

const TEMPLATES = [
  { value: "contact", label: "Contact Form" },
  { value: "quote_request", label: "Quote Request" },
  { value: "course_registration", label: "Course Registration" },
  { value: "event_registration", label: "Event Registration" },
  { value: "employment", label: "Employment Application" },
  { value: "newsletter", label: "Newsletter Signup" },
  { value: "custom", label: "Custom (blank)" },
];

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "published") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

function SubmissionCount({ siteId, formId }: { siteId: Id<"sites">; formId: Id<"forms"> }) {
  const count = useQuery(api.forms.getSubmissionCount, { siteId, formId });
  if (count === undefined) return null;
  return (
    <span className="flex items-center gap-1">
      <Inbox className="h-3 w-3" />
      {count} {count === 1 ? "submission" : "submissions"}
    </span>
  );
}

function EmbedDialog({ form, siteSlug, onClose }: { form: any; siteSlug: string; onClose: () => void }) {
  const { toast } = useToast();
  const publicUrl = `${window.location.origin}/forms/${siteSlug}/${form.slug}`;
  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`;
  const scriptCode = `<div id="fsts-form-${form.slug}"></div>\n<script src="${window.location.origin}/embed.js" data-form="${form.slug}" data-site="${siteSlug}"></script>`;

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  }

  function openPublic() {
    window.open(publicUrl, "_blank", "noopener");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Embed Code — {form.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              Public Page URL
            </Label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 font-mono text-slate-700 overflow-x-auto whitespace-nowrap">
                {publicUrl}
              </code>
              <Button size="icon" variant="outline" onClick={() => copy(publicUrl)} title="Copy URL">
                <ClipboardCopy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={openPublic} title="Preview form">
                <Globe className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              iFrame Embed
            </Label>
            <div className="flex gap-2 items-start">
              <textarea
                readOnly
                value={iframeCode}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 font-mono text-slate-700 resize-none h-20"
              />
              <Button aria-label="Copy to clipboard" size="icon" variant="outline" onClick={() => copy(iframeCode)}>
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              Script Embed
            </Label>
            <div className="flex gap-2 items-start">
              <textarea
                readOnly
                value={scriptCode}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 font-mono text-slate-700 resize-none h-24"
              />
              <Button aria-label="Copy to clipboard" size="icon" variant="outline" onClick={() => copy(scriptCode)}>
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FormsList({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const site = useQuery(api.sites.get, { siteId });
  const forms = useQuery(api.forms.list, { siteId });
  const createForm = useMutation(api.forms.create);
  const removeForm = useMutation(api.forms.remove);
  const duplicateForm = useMutation(api.forms.duplicate);
  const updateForm = useMutation(api.forms.update);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTemplate, setCreateTemplate] = useState("custom");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [embedForm, setEmbedForm] = useState<any>(null);

  async function handleCreate() {
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      const id = await createForm({ siteId, name: createName.trim(), templateType: createTemplate });
      setCreateOpen(false);
      setCreateName("");
      setCreateTemplate("custom");
      navigate(`/app/sites/${siteId}/forms/${id}`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDuplicate(formId: string) {
    try {
      const newId = await duplicateForm({ siteId, formId: formId as Id<"forms"> });
      toast({ title: "Form duplicated" });
      navigate(`/app/sites/${siteId}/forms/${newId}`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await removeForm({ siteId, formId: deleteId as Id<"forms"> });
      setDeleteId(null);
      toast({ title: "Form deleted" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  async function handleArchive() {
    if (!archiveId) return;
    try {
      await updateForm({ siteId, formId: archiveId as Id<"forms">, status: "archived" });
      setArchiveId(null);
      toast({ title: "Form archived" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  return (
    <AppLayout siteId={siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FormInput className="h-6 w-6 text-primary" />
            Forms
          </h1>
          <p className="text-slate-500 mt-1">Build and publish custom forms. Submissions appear in Contact Inbox.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Form
        </Button>
      </div>

      {forms === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <FormInput className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No forms yet</p>
          <p className="text-sm text-slate-400 mb-4">Create your first form to start collecting submissions.</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form: any) => (
            <div key={form.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-slate-900 truncate">{form.name}</h3>
                  <Badge variant={statusVariant(form.status)} className="capitalize text-xs">
                    {form.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="font-mono">/{form.slug}</span>
                  {form.templateType && form.templateType !== "custom" && (
                    <span>Template: {TEMPLATES.find(t => t.value === form.templateType)?.label ?? form.templateType}</span>
                  )}
                  <span>{Array.isArray(form.fields) ? form.fields.length : 0} fields</span>
                  <SubmissionCount siteId={siteId} formId={form.id as Id<"forms">} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {form.status === "published" && site?.slug && (
                  <Button size="sm" variant="outline" onClick={() => setEmbedForm(form)}>
                    <Globe className="h-3.5 w-3.5 mr-1" />
                    Embed
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  title="View submissions"
                  onClick={() => navigate(`/app/sites/${siteId}/inbox`)}
                >
                  <Inbox className="h-3.5 w-3.5" />
                </Button>
                <Button aria-label="Duplicate" size="sm" variant="outline" onClick={() => handleDuplicate(form.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/app/sites/${siteId}/forms/${form.id}`)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                {form.status !== "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    title="Archive form"
                    onClick={() => setArchiveId(form.id)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button aria-label="Delete" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(form.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="form-name">Form Name</Label>
              <Input
                id="form-name"
                placeholder="e.g. Contact Us"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Starting Template</Label>
              <Select value={createTemplate} onValueChange={setCreateTemplate}>
                <SelectTrigger aria-label="create template" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Templates pre-fill the canvas with relevant fields.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || isCreating}>
              {isCreating ? "Creating…" : "Create & Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <AlertDialog open={!!archiveId} onOpenChange={(o) => !o && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Form?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived forms stop accepting new submissions but remain visible in your list. You can unarchive by editing the form status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the form. Existing submissions will remain in your inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {embedForm && site?.slug && (
        <EmbedDialog form={embedForm} siteSlug={site.slug} onClose={() => setEmbedForm(null)} />
      )}
    </AppLayout>
  );
}
