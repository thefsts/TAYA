import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Settings2,
  ArrowRight,
  Eye,
} from "lucide-react";

/* ── Constants ──────────────────────────────────────────────────────────── */

const TRIGGER_TYPES = [
  { value: "article_published", label: "Article Published" },
  { value: "form_submitted", label: "Form Submitted" },
  { value: "payment_received", label: "Payment Received" },
  { value: "course_registration", label: "Course Registration" },
  { value: "event_registration", label: "Event Registration" },
  { value: "crm_sync_completed", label: "CRM Sync Completed" },
  { value: "backup_created", label: "Backup Created" },
];

const CONDITION_FIELDS_BY_TRIGGER: Record<string, { value: string; label: string }[]> = {
  article_published: [
    { value: "title", label: "Title" },
    { value: "author", label: "Author" },
    { value: "category", label: "Category" },
  ],
  form_submitted: [
    { value: "formType", label: "Form Type" },
    { value: "submitterEmail", label: "Submitter Email" },
    { value: "submitterName", label: "Submitter Name" },
  ],
  payment_received: [
    { value: "provider", label: "Provider" },
    { value: "status", label: "Status" },
    { value: "eventType", label: "Event Type" },
  ],
  default: [
    { value: "status", label: "Status" },
    { value: "type", label: "Type" },
  ],
};

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const ACTION_TYPES = [
  { value: "notify_crm", label: "Notify Operon CRM", description: "Push trigger data to the connected CRM" },
  { value: "send_email", label: "Send Email", description: "Send a notification email" },
  { value: "create_backup", label: "Create Backup", description: "Snapshot the entire site" },
  { value: "log_activity", label: "Log Activity", description: "Write a custom entry to the activity log" },
  { value: "post_webhook", label: "Post to Webhook URL", description: "Send trigger data to an external URL via HTTPS POST" },
  { value: "create_social_task", label: "Create Social Task (stub)", description: "Queue a social media post task" },
];

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface ActionItem {
  type: string;
  order: number;
  config: Record<string, string>;
}

interface RuleFormState {
  name: string;
  description: string;
  triggerType: string;
  conditions: Condition[];
  actions: ActionItem[];
}

const emptyForm = (): RuleFormState => ({
  name: "",
  description: "",
  triggerType: "form_submitted",
  conditions: [],
  actions: [],
});

/* ── Status badge ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-slate-400 text-xs">Never run</span>;
  if (status === "success") return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs font-medium">Success</Badge>;
  if (status === "partial_failure") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs font-medium">Partial</Badge>;
  if (status === "failure") return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs font-medium">Failed</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function ActionStatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
  if (status === "failure") return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  return <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />;
}

/* ── Action config forms ────────────────────────────────────────────────── */

function ActionConfigForm({
  action,
  onChange,
}: {
  action: ActionItem;
  onChange: (config: Record<string, string>) => void;
}) {
  const cfg = action.config ?? {};
  switch (action.type) {
    case "send_email":
      return (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-100">
          <div>
            <Label className="text-xs text-slate-500">To</Label>
            <Input
              className="h-7 text-sm mt-0.5"
              placeholder="e.g. admin@example.com"
              value={cfg.to ?? ""}
              onChange={(e) => onChange({ ...cfg, to: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Subject</Label>
            <Input
              className="h-7 text-sm mt-0.5"
              placeholder="Email subject"
              value={cfg.subject ?? ""}
              onChange={(e) => onChange({ ...cfg, subject: e.target.value })}
            />
          </div>
        </div>
      );
    case "log_activity":
      return (
        <div className="mt-2 pl-2 border-l-2 border-slate-100">
          <Label className="text-xs text-slate-500">Log Message</Label>
          <Input
            className="h-7 text-sm mt-0.5"
            placeholder="Custom activity log message"
            value={cfg.message ?? ""}
            onChange={(e) => onChange({ ...cfg, message: e.target.value })}
          />
        </div>
      );
    case "post_webhook":
      return (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-100">
          <div>
            <Label className="text-xs text-slate-500">Webhook URL (https://)</Label>
            <Input
              className="h-7 text-sm mt-0.5"
              placeholder="https://hooks.example.com/..."
              value={cfg.url ?? ""}
              onChange={(e) => onChange({ ...cfg, url: e.target.value })}
            />
          </div>
        </div>
      );
    case "notify_crm":
      return (
        <div className="mt-2 pl-2 border-l-2 border-slate-100">
          <Label className="text-xs text-slate-500">Entity Type (optional)</Label>
          <Input
            className="h-7 text-sm mt-0.5"
            placeholder="e.g. contact_form"
            value={cfg.entityType ?? ""}
            onChange={(e) => onChange({ ...cfg, entityType: e.target.value })}
          />
        </div>
      );
    case "create_social_task":
      return (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-100">
          <div>
            <Label className="text-xs text-slate-500">Platform</Label>
            <Input
              className="h-7 text-sm mt-0.5"
              placeholder="e.g. twitter, linkedin"
              value={cfg.platform ?? ""}
              onChange={(e) => onChange({ ...cfg, platform: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Task Description</Label>
            <Input
              className="h-7 text-sm mt-0.5"
              placeholder="What to post"
              value={cfg.taskDescription ?? ""}
              onChange={(e) => onChange({ ...cfg, taskDescription: e.target.value })}
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}

/* ── Rule editor dialog ─────────────────────────────────────────────────── */

function RuleEditorDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: { id?: Id<"automationRules">; form: RuleFormState };
  onSave: (id: Id<"automationRules"> | undefined, form: RuleFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<RuleFormState>(initial.form);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof RuleFormState>(key: K, val: RuleFormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addCondition() {
    const fields = CONDITION_FIELDS_BY_TRIGGER[form.triggerType] ?? CONDITION_FIELDS_BY_TRIGGER.default;
    setField("conditions", [
      ...form.conditions,
      { field: fields[0]?.value ?? "status", operator: "equals", value: "" },
    ]);
  }

  function updateCondition(i: number, patch: Partial<Condition>) {
    setField(
      "conditions",
      form.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    );
  }

  function removeCondition(i: number) {
    setField("conditions", form.conditions.filter((_, idx) => idx !== i));
  }

  function addAction() {
    const nextOrder = form.actions.length > 0 ? Math.max(...form.actions.map((a) => a.order)) + 1 : 0;
    setField("actions", [...form.actions, { type: "log_activity", order: nextOrder, config: {} }]);
  }

  function updateAction(i: number, patch: Partial<ActionItem>) {
    setField(
      "actions",
      form.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    );
  }

  function removeAction(i: number) {
    setField("actions", form.actions.filter((_, idx) => idx !== i));
  }

  function moveAction(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= form.actions.length) return;
    const updated = [...form.actions];
    const temp = updated[i].order;
    updated[i] = { ...updated[i], order: updated[j].order };
    updated[j] = { ...updated[j], order: temp };
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setField("actions", updated);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(initial.id, form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const conditionFields = CONDITION_FIELDS_BY_TRIGGER[form.triggerType] ?? CONDITION_FIELDS_BY_TRIGGER.default;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Edit Automation Rule" : "New Automation Rule"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Name + Description */}
          <div className="space-y-3">
            <div>
              <Label>Rule Name</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Notify CRM on new contact form"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={2}
                placeholder="What does this rule do?"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>
          </div>

          {/* Trigger */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Trigger
            </Label>
            <Select value={form.triggerType} onValueChange={(v) => setField("triggerType", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-blue-500" /> Conditions
                <span className="text-xs text-slate-400 font-normal ml-1">(all must match)</span>
              </Label>
              <Button variant="outline" size="sm" onClick={addCondition} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {form.conditions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No conditions — rule fires on every trigger event.</p>
            ) : (
              <div className="space-y-2">
                {form.conditions.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Select value={c.field} onValueChange={(v) => updateCondition(i, { field: v })}>
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionFields.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={c.operator} onValueChange={(v) => updateCondition(i, { operator: v })}>
                      <SelectTrigger className="h-8 text-sm w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!["is_empty", "is_not_empty"].includes(c.operator) && (
                      <Input
                        className="h-8 text-sm flex-1"
                        placeholder="value"
                        value={c.value}
                        onChange={(e) => updateCondition(i, { value: e.target.value })}
                      />
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => removeCondition(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-green-500" /> Actions
                <span className="text-xs text-slate-400 font-normal ml-1">(run in order)</span>
              </Label>
              <Button variant="outline" size="sm" onClick={addAction} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {form.actions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No actions yet — add at least one.</p>
            ) : (
              <div className="space-y-2">
                {form.actions.map((a, i) => {
                  const meta = ACTION_TYPES.find((t) => t.value === a.type);
                  return (
                    <div key={i} className="border border-slate-200 rounded-md p-3 bg-slate-50">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-slate-400 font-mono w-5">{i + 1}.</span>
                        <Select value={a.type} onValueChange={(v) => updateAction(i, { type: v, config: {} })}>
                          <SelectTrigger className="h-8 text-sm flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                <div>
                                  <div className="font-medium">{t.label}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => moveAction(i, -1)} disabled={i === 0}>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => moveAction(i, 1)} disabled={i === form.actions.length - 1}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => removeAction(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {meta && (
                        <p className="text-xs text-slate-500 mt-1 ml-5">{meta.description}</p>
                      )}
                      <ActionConfigForm
                        action={a}
                        onChange={(config) => updateAction(i, { config })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || form.actions.length === 0}>
            {saving ? "Saving…" : initial.id ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Run log drawer ─────────────────────────────────────────────────────── */

function RunLogDrawer({
  open,
  onClose,
  siteId,
  ruleId,
  ruleName,
}: {
  open: boolean;
  onClose: () => void;
  siteId: Id<"sites">;
  ruleId: Id<"automationRules">;
  ruleName: string;
}) {
  const logs = useQuery(api.automation.listRunLogs, open ? { siteId, ruleId, limit: 30 } : "skip");
  const retryRun = useMutation(api.automation.retryRun);
  const { toast } = useToast();

  async function handleRetry(runLogId: Id<"automationRunLog">) {
    try {
      await retryRun({ siteId, runLogId });
      toast({ title: "Retry scheduled", description: "The rule will re-run shortly." });
    } catch (err) {
      toast({ title: "Retry failed", description: String(err), variant: "destructive" });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-500" />
            Run Log — {ruleName}
          </SheetTitle>
        </SheetHeader>

        {logs === undefined ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No runs recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log: any) => (
              <div key={log._id} className="border border-slate-200 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={log.status} />
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(log.completedAt).toLocaleString()}
                    </span>
                  </div>
                  {log.status !== "success" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleRetry(log._id)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  Trigger: <span className="font-medium text-slate-700">{log.triggerType}</span>
                </div>
                <div className="space-y-1.5">
                  {log.actionResults.map((r: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <ActionStatusIcon status={r.status} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-slate-700 capitalize">{r.actionType.replace(/_/g, " ")}</span>
                        {r.message && (
                          <p className={`mt-0.5 truncate ${r.status === "failure" ? "text-red-600" : "text-slate-500"}`}>
                            {r.message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Failure alerts panel ───────────────────────────────────────────────── */

function FailureAlertsPanel({ siteId }: { siteId: Id<"sites"> }) {
  const failed = useQuery(api.automation.getFailedRuns, { siteId });
  const retryRun = useMutation(api.automation.retryRun);
  const { toast } = useToast();

  async function handleRetry(runLogId: Id<"automationRunLog">) {
    try {
      await retryRun({ siteId, runLogId });
      toast({ title: "Retry scheduled" });
    } catch (err) {
      toast({ title: "Retry failed", description: String(err), variant: "destructive" });
    }
  }

  if (!failed || failed.length === 0) return null;

  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <h3 className="text-sm font-semibold text-red-800">
          {failed.length} failed automation run{failed.length > 1 ? "s" : ""}
        </h3>
      </div>
      <div className="space-y-2">
        {failed.slice(0, 5).map((log: any) => (
          <div key={log._id} className="flex items-center justify-between bg-white rounded border border-red-100 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{log.ruleName}</p>
              <p className="text-xs text-slate-500">
                {log.triggerType} · {new Date(log.completedAt).toLocaleString()}
              </p>
              {log.actionResults.filter((r: any) => r.status === "failure").map((r: any, i: number) => (
                <p key={i} className="text-xs text-red-600 mt-0.5 truncate">
                  ✗ {r.actionType.replace(/_/g, " ")}: {r.message}
                </p>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-3 h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => handleRetry(log._id)}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function AutomationRules({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const rules = useQuery(api.automation.list, { siteId });
  const createRule = useMutation(api.automation.create);
  const updateRule = useMutation(api.automation.update);
  const removeRule = useMutation(api.automation.remove);
  const setEnabled = useMutation(api.automation.setEnabled);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<{ id?: Id<"automationRules">; form: RuleFormState }>({
    form: emptyForm(),
  });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [logDrawer, setLogDrawer] = useState<{ ruleId: Id<"automationRules">; ruleName: string } | null>(null);

  function openCreateDialog() {
    setEditorInitial({ form: emptyForm() });
    setEditorOpen(true);
  }

  function openEditDialog(rule: any) {
    setEditorInitial({
      id: rule._id,
      form: {
        name: rule.name,
        description: rule.description ?? "",
        triggerType: rule.triggerType,
        conditions: rule.conditions ?? [],
        actions: rule.actions ?? [],
      },
    });
    setEditorOpen(true);
  }

  async function handleSave(id: Id<"automationRules"> | undefined, form: RuleFormState) {
    try {
      if (id) {
        await updateRule({
          siteId,
          ruleId: id,
          name: form.name,
          description: form.description || undefined,
          triggerType: form.triggerType,
          conditions: form.conditions,
          actions: form.actions,
        });
        toast({ title: "Rule updated" });
      } else {
        await createRule({
          siteId,
          name: form.name,
          description: form.description || undefined,
          triggerType: form.triggerType,
          conditions: form.conditions,
          actions: form.actions,
          enabled: true,
        });
        toast({ title: "Automation rule created" });
      }
    } catch (err) {
      toast({ title: "Save failed", description: String(err), variant: "destructive" });
      throw err;
    }
  }

  async function handleToggle(rule: any) {
    try {
      await setEnabled({ siteId, ruleId: rule._id, enabled: !rule.enabled });
    } catch (err) {
      toast({ title: "Failed to toggle", description: String(err), variant: "destructive" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await removeRule({ siteId, ruleId: deleteTarget._id });
      toast({ title: "Rule deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: "Delete failed", description: String(err), variant: "destructive" });
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Automation Engine™
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create trigger → condition → action rules to automate workflows across your site.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" /> New Rule
        </Button>
      </div>

      <FailureAlertsPanel siteId={siteId} />

      {rules === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <Zap className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No automation rules yet</h3>
          <p className="text-slate-500 mt-1 text-sm max-w-sm mx-auto">
            Rules fire automatically when events happen on your site — publishing an article, submitting a form, receiving a payment, and more.
          </p>
          <Button onClick={openCreateDialog} className="mt-4">
            <Plus className="h-4 w-4 mr-2" /> Create your first rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => {
            const triggerLabel = TRIGGER_TYPES.find((t) => t.value === rule.triggerType)?.label ?? rule.triggerType;
            const actionLabels = (rule.actions as ActionItem[])
              .sort((a, b) => a.order - b.order)
              .map((a) => ACTION_TYPES.find((t) => t.value === a.type)?.label ?? a.type);

            return (
              <div key={rule._id} className="bg-white border border-slate-200 rounded-md p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => handleToggle(rule)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{rule.name}</h3>
                      {!rule.enabled && (
                        <Badge variant="outline" className="text-xs text-slate-400">Disabled</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-500 mt-0.5">{rule.description}</p>
                    )}

                    {/* Rule summary */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                        <Zap className="h-3 w-3 text-amber-500" /> {triggerLabel}
                      </span>
                      {(rule.conditions as Condition[]).length > 0 && (
                        <span className="text-slate-400">
                          + {(rule.conditions as Condition[]).length} condition{(rule.conditions as Condition[]).length > 1 ? "s" : ""}
                        </span>
                      )}
                      <ArrowRight className="h-3 w-3 text-slate-300" />
                      {actionLabels.map((label, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                          {label}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        Last run: <StatusBadge status={rule.lastRunStatus} />
                      </div>
                      {rule.lastRunAt && (
                        <span className="text-slate-400">{new Date(rule.lastRunAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-500"
                      onClick={() => setLogDrawer({ ruleId: rule._id, ruleName: rule.name })}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Logs
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-500"
                      onClick={() => openEditDialog(rule)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 text-slate-400 hover:text-red-500 p-0"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trigger info callout */}
      {rules && rules.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-md p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">How automation triggers work</p>
          <p className="text-blue-700 text-xs">
            Rules fire automatically when site events occur. <strong>Article Published</strong> fires when an article status changes to published.{" "}
            <strong>Form Submitted</strong> fires when any visitor submits a form. Trigger payloads are passed to conditions and included in webhook posts.
          </p>
        </div>
      )}

      {/* Rule editor */}
      {editorOpen && (
        <RuleEditorDialog
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          initial={editorInitial}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This rule and its entire run history will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run log drawer */}
      {logDrawer && (
        <RunLogDrawer
          open={!!logDrawer}
          onClose={() => setLogDrawer(null)}
          siteId={siteId}
          ruleId={logDrawer.ruleId}
          ruleName={logDrawer.ruleName}
        />
      )}
    </AppLayout>
  );
}
