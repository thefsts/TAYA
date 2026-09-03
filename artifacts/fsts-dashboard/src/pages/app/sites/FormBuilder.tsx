import { useState, useCallback } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, GripVertical, Plus, Trash2, ChevronDown, ChevronUp,
  Settings2, Eye, EyeOff, Save, Globe, FileText, X, LayoutTemplate,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type FieldType =
  | "short_text" | "long_text" | "email" | "phone" | "number"
  | "dropdown" | "checkbox" | "radio" | "file_upload" | "date"
  | "hidden" | "section_heading";

interface ConditionalRule {
  sourceFieldId: string;
  operator: "is" | "is_not" | "contains" | "not_contains";
  value: string;
}

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
  validationRegex?: string;
  validationMessage?: string;
  hiddenValue?: string;
  condition?: ConditionalRule | null;
}

interface FormSettings {
  submitLabel: string;
  successMessage: string;
  redirectUrl: string;
  notificationEmails: string[];
  crmRouting: boolean;
  honeypot: boolean;
}

/* ─── Field type palette ───────────────────────────────────────────────────── */

const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: "short_text", label: "Short Text", icon: "T" },
  { type: "long_text", label: "Long Text", icon: "¶" },
  { type: "email", label: "Email", icon: "@" },
  { type: "phone", label: "Phone", icon: "☎" },
  { type: "number", label: "Number", icon: "#" },
  { type: "dropdown", label: "Dropdown", icon: "▾" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "radio", label: "Radio", icon: "◎" },
  { type: "file_upload", label: "File Upload", icon: "⇪" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "hidden", label: "Hidden Field", icon: "⊘" },
  { type: "section_heading", label: "Section Heading", icon: "H" },
];

function newField(type: FieldType): FormField {
  const id = `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const base: FormField = { id, type, label: FIELD_TYPES.find(f => f.type === type)?.label ?? type, required: false };
  if (type === "dropdown" || type === "radio" || type === "checkbox") {
    base.options = ["Option 1", "Option 2"];
  }
  return base;
}

/* ─── Sortable field row ───────────────────────────────────────────────────── */

function SortableField({
  field, isSelected, onClick, onDelete,
}: {
  field: FormField;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      <button aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {FIELD_TYPES.find(f => f.type === field.type)?.icon}
          </span>
          <span className={`text-sm font-medium truncate ${field.type === "section_heading" ? "text-slate-600 font-semibold" : "text-slate-800"}`}>
            {field.label}
          </span>
          {field.required && <span className="text-red-400 text-xs">*</span>}
          {field.condition && (
            <span className="text-xs text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              conditional
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {FIELD_TYPES.find(f => f.type === field.type)?.label}
          {field.type === "hidden" && field.hiddenValue && ` — "${field.hiddenValue}"`}
        </p>
      </div>
      <button aria-label="Delete"
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-destructive transition-opacity flex-shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ─── Field editor panel ───────────────────────────────────────────────────── */

function FieldEditor({
  field, allFields, onChange, onClose,
}: {
  field: FormField;
  allFields: FormField[];
  onChange: (updates: Partial<FormField>) => void;
  onClose: () => void;
}) {
  const hasOptions = field.type === "dropdown" || field.type === "radio" || field.type === "checkbox";
  const hasPlaceholder = !["checkbox", "radio", "section_heading", "hidden", "file_upload", "date"].includes(field.type);
  const hasRequired = field.type !== "section_heading" && field.type !== "hidden";
  const otherFields = allFields.filter(f => f.id !== field.id && f.type !== "section_heading" && f.type !== "hidden");

  function updateOption(idx: number, val: string) {
    const opts = [...(field.options ?? [])];
    opts[idx] = val;
    onChange({ options: opts });
  }
  function addOption() {
    onChange({ options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] });
  }
  function removeOption(idx: number) {
    onChange({ options: field.options?.filter((_, i) => i !== idx) });
  }

  return (
    <div className="w-72 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800 text-sm">Field Properties</h3>
        <button aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        <div>
          <Label className="text-xs font-medium text-slate-600">Label</Label>
          <Input
            aria-label="Label"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="mt-1 text-sm"
            placeholder="Field label"
          />
        </div>

        {hasPlaceholder && (
          <div>
            <Label className="text-xs font-medium text-slate-600">Placeholder</Label>
            <Input
              aria-label="Placeholder"
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              className="mt-1 text-sm"
              placeholder="Hint text…"
            />
          </div>
        )}

        <div>
          <Label className="text-xs font-medium text-slate-600">Help Text</Label>
          <Input
            aria-label="Help Text"
            value={field.helpText ?? ""}
            onChange={(e) => onChange({ helpText: e.target.value })}
            className="mt-1 text-sm"
            placeholder="Optional description"
          />
        </div>

        {hasRequired && (
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-slate-600">Required</Label>
            <Switch
              checked={field.required ?? false}
              onCheckedChange={(v) => onChange({ required: v })}
            />
          </div>
        )}

        {field.type === "hidden" && (
          <div>
            <Label className="text-xs font-medium text-slate-600">Hidden Value</Label>
            <Input
              aria-label="Hidden Value"
              value={field.hiddenValue ?? ""}
              onChange={(e) => onChange({ hiddenValue: e.target.value })}
              className="mt-1 text-sm font-mono"
              placeholder="static value or {variable}"
            />
          </div>
        )}

        {hasOptions && (
          <div>
            <Label className="text-xs font-medium text-slate-600 mb-2 block">Options</Label>
            <div className="space-y-1.5">
              {(field.options ?? []).map((opt, idx) => (
                <div key={idx} className="flex gap-1">
                  <Input
                    aria-label="opt"
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className="text-sm flex-1"
                  />
                  <Button aria-label="Remove"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0 text-slate-400 hover:text-destructive"
                    onClick={() => removeOption(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-2 w-full text-xs" onClick={addOption}>
              <Plus className="h-3 w-3 mr-1" /> Add Option
            </Button>
          </div>
        )}

        {(field.type === "short_text" || field.type === "email" || field.type === "phone" || field.type === "number") && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Validation</Label>
            <div>
              <Label className="text-xs font-medium text-slate-600">Regex Pattern</Label>
              <Input
                aria-label="Regex Pattern"
                value={field.validationRegex ?? ""}
                onChange={(e) => onChange({ validationRegex: e.target.value })}
                className="mt-1 text-sm font-mono"
                placeholder="e.g. ^[A-Za-z]+$"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600">Validation Error Message</Label>
              <Input
                aria-label="Validation Error Message"
                value={field.validationMessage ?? ""}
                onChange={(e) => onChange({ validationMessage: e.target.value })}
                className="mt-1 text-sm"
                placeholder="Invalid format"
              />
            </div>
          </div>
        )}

        {/* Conditional logic */}
        {hasRequired && otherFields.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conditional Logic</Label>
              {field.condition ? (
                <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => onChange({ condition: null })}>
                  Remove
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onChange({ condition: { sourceFieldId: otherFields[0].id, operator: "is", value: "" } })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Rule
                </Button>
              )}
            </div>
            {field.condition && (
              <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 font-medium">Show this field when:</p>
                <Select
                  value={field.condition.sourceFieldId}
                  onValueChange={(v) => onChange({ condition: { ...field.condition!, sourceFieldId: v } })}
                >
                  <SelectTrigger aria-label="Source field" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {otherFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={field.condition.operator}
                  onValueChange={(v: any) => onChange({ condition: { ...field.condition!, operator: v } })}
                >
                  <SelectTrigger aria-label="Condition operator" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is">is</SelectItem>
                    <SelectItem value="is_not">is not</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="not_contains">does not contain</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  aria-label="value…"
                  value={field.condition.value}
                  onChange={(e) => onChange({ condition: { ...field.condition!, value: e.target.value } })}
                  className="h-8 text-xs"
                  placeholder="value…"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Form preview ─────────────────────────────────────────────────────────── */

function FormPreview({ fields, settings }: { fields: FormField[]; settings: FormSettings }) {
  return (
    <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <p className="text-xs text-slate-400 text-center mb-4 uppercase tracking-wide font-medium">Form Preview</p>
      {fields.map((field) => (
        <PreviewField key={field.id} field={field} />
      ))}
      {settings.honeypot && (
        <div style={{ display: "none" }}>
          <input tabIndex={-1} name="_honeypot" autoComplete="off" />
        </div>
      )}
      <Button className="w-full">{settings.submitLabel || "Submit"}</Button>
    </div>
  );
}

function PreviewField({ field }: { field: FormField }) {
  if (field.type === "section_heading") {
    return (
      <div className="border-b border-slate-200 pb-2">
        <h3 className="font-semibold text-slate-800">{field.label}</h3>
        {field.helpText && <p className="text-sm text-slate-500">{field.helpText}</p>}
      </div>
    );
  }
  if (field.type === "hidden") return null;

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-red-400 ml-1">*</span>}
      </Label>
      {field.helpText && <p className="text-xs text-slate-400">{field.helpText}</p>}
      {(field.type === "short_text" || field.type === "email" || field.type === "phone" || field.type === "number") && (
        <Input aria-label={field.placeholder} placeholder={field.placeholder} type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : "text"} disabled className="bg-slate-50" />
      )}
      {field.type === "long_text" && (
        <Textarea aria-label={field.placeholder} placeholder={field.placeholder} disabled className="bg-slate-50 resize-none" rows={3} />
      )}
      {field.type === "date" && (
        <Input aria-label="date" type="date" disabled className="bg-slate-50" />
      )}
      {field.type === "file_upload" && (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-sm text-slate-400">
          Click to upload or drag & drop
        </div>
      )}
      {field.type === "dropdown" && (
        <Select disabled>
          <SelectTrigger aria-label={field.placeholder || "Select an option"} className="bg-slate-50">
            <SelectValue placeholder={field.placeholder || "Select an option"} />
          </SelectTrigger>
        </Select>
      )}
      {(field.type === "radio" || field.type === "checkbox") && (
        <div className="space-y-1">
          {(field.options ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-slate-700 cursor-default">
              <input type={field.type === "radio" ? "radio" : "checkbox"} disabled />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Settings tab ─────────────────────────────────────────────────────────── */

function SettingsTab({ settings, onChange }: { settings: FormSettings; onChange: (s: FormSettings) => void }) {
  const [emailInput, setEmailInput] = useState("");

  function addEmail() {
    const email = emailInput.trim();
    if (!email || settings.notificationEmails.includes(email)) return;
    onChange({ ...settings, notificationEmails: [...settings.notificationEmails, email] });
    setEmailInput("");
  }

  function removeEmail(email: string) {
    onChange({ ...settings, notificationEmails: settings.notificationEmails.filter(e => e !== email) });
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm">Submission Behavior</h3>
        <div>
          <Label className="text-xs font-medium text-slate-600">Submit Button Label</Label>
          <Input
            aria-label="Submit Button Label"
            value={settings.submitLabel}
            onChange={(e) => onChange({ ...settings, submitLabel: e.target.value })}
            className="mt-1"
            placeholder="Submit"
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-600">Success Message</Label>
          <Textarea
            aria-label="Success Message"
            value={settings.successMessage}
            onChange={(e) => onChange({ ...settings, successMessage: e.target.value })}
            className="mt-1 resize-none"
            rows={2}
            placeholder="Thank you for your submission!"
          />
          <p className="text-xs text-slate-400 mt-1">Shown after a successful submission. Leave blank to use redirect URL instead.</p>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-600">Redirect URL (optional)</Label>
          <Input
            aria-label="Redirect URL (optional)"
            value={settings.redirectUrl}
            onChange={(e) => onChange({ ...settings, redirectUrl: e.target.value })}
            className="mt-1"
            placeholder="https://yoursite.com/thank-you"
          />
          <p className="text-xs text-slate-400 mt-1">If set, the user is redirected here instead of seeing the success message.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
        <div>
          <Label className="text-xs font-medium text-slate-600">Email Notification Recipients</Label>
          <div className="flex gap-2 mt-1">
            <Input
              aria-label="admin@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmail()}
              placeholder="admin@example.com"
              type="email"
            />
            <Button variant="outline" onClick={addEmail}>Add</Button>
          </div>
          {settings.notificationEmails.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {settings.notificationEmails.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <button aria-label="Close" onClick={() => removeEmail(email)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">An email is sent to each address on every new submission.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm">Integrations & Security</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">CRM Routing</p>
            <p className="text-xs text-slate-400">Push each submission to Operon CRM as a new lead</p>
          </div>
          <Switch
            checked={settings.crmRouting}
            onCheckedChange={(v) => onChange({ ...settings, crmRouting: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Spam Protection (Honeypot)</p>
            <p className="text-xs text-slate-400">Add a hidden field that bots fill in, humans don't</p>
          </div>
          <Switch
            checked={settings.honeypot}
            onCheckedChange={(v) => onChange({ ...settings, honeypot: v })}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Main builder ─────────────────────────────────────────────────────────── */

export default function FormBuilder({ params }: { params: { siteId: string; formId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const formId = params.formId as Id<"forms">;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useQuery(api.forms.get, { siteId, formId });
  const updateForm = useMutation(api.forms.update);

  const [fields, setFields] = useState<FormField[] | null>(null);
  const [settings, setSettings] = useState<FormSettings | null>(null);
  const [formName, setFormName] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "preview" | "settings">("builder");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Initialise local state once form loads
  if (form !== undefined && form !== null && fields === null) {
    setFields(Array.isArray(form.fields) ? (form.fields as FormField[]) : []);
    setSettings({
      submitLabel: "Submit",
      successMessage: "Thank you! Your submission has been received.",
      redirectUrl: "",
      notificationEmails: [],
      crmRouting: false,
      honeypot: true,
      ...(form.settings as Partial<FormSettings> ?? {}),
    });
    setFormName(form.name);
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((prev) => {
        if (!prev) return prev;
        const oldIdx = prev.findIndex((f) => f.id === active.id);
        const newIdx = prev.findIndex((f) => f.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  function addField(type: FieldType) {
    const f = newField(type);
    setFields((prev) => [...(prev ?? []), f]);
    setSelectedFieldId(f.id);
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields((prev) => prev?.map((f) => f.id === id ? { ...f, ...updates } : f) ?? null);
  }

  function deleteField(id: string) {
    setFields((prev) => prev?.filter((f) => f.id !== id) ?? null);
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  async function handleSave(newStatus?: string) {
    if (!fields || !settings || !formName) return;
    setIsSaving(true);
    try {
      await updateForm({
        siteId,
        formId,
        name: formName,
        fields,
        settings,
        ...(newStatus ? { status: newStatus } : {}),
      });
      toast({ title: newStatus === "published" ? "Form published!" : "Changes saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  if (form === undefined || fields === null || settings === null) {
    return (
      <AppLayout siteId={siteId}>
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-96 rounded-xl" />
      </AppLayout>
    );
  }

  if (form === null) {
    return (
      <AppLayout siteId={siteId}>
        <div className="text-center py-12 text-slate-500">Form not found.</div>
      </AppLayout>
    );
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  return (
    <AppLayout siteId={siteId}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-500"
          onClick={() => navigate(`/app/sites/${siteId}/forms`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Forms
        </Button>
        <div className="h-4 w-px bg-slate-200" />
        <input
          value={formName ?? form.name}
          onChange={(e) => setFormName(e.target.value)}
          className="text-xl font-bold text-slate-900 bg-transparent border-none outline-none focus:ring-0 flex-1 min-w-0"
          placeholder="Form name"
        />
        <Badge variant={form.status === "published" ? "default" : "outline"} className="capitalize">
          {form.status}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
        {form.status !== "published" ? (
          <Button size="sm" onClick={() => handleSave("published")} disabled={isSaving}>
            <Globe className="h-4 w-4 mr-1" />
            Publish
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => handleSave("draft")} disabled={isSaving}>
            <EyeOff className="h-4 w-4 mr-1" />
            Unpublish
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="builder">
            <LayoutTemplate className="h-4 w-4 mr-1.5" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-1.5" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="h-4 w-4 mr-1.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Builder tab */}
        <TabsContent value="builder">
          <div className="flex gap-4 min-h-[600px]">
            {/* Field palette */}
            <div className="w-44 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Add Field</p>
              <div className="space-y-1">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.type}
                    onClick={() => addField(ft.type)}
                    className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
                  >
                    <span className="text-xs font-mono text-slate-400 w-5 text-center">{ft.icon}</span>
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 min-w-0">
              <div className="bg-white border border-slate-200 rounded-xl p-4 min-h-[500px]">
                {fields.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center py-20">
                    <div>
                      <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">Your canvas is empty</p>
                      <p className="text-sm text-slate-300">Click a field type on the left to add it</p>
                    </div>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={fields.map((f) => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {fields.map((field) => (
                          <SortableField
                            key={field.id}
                            field={field}
                            isSelected={selectedFieldId === field.id}
                            onClick={() => setSelectedFieldId(selectedFieldId === field.id ? null : field.id)}
                            onDelete={() => deleteField(field.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                {fields.length} field{fields.length !== 1 ? "s" : ""} · Drag to reorder · Click to edit
              </p>
            </div>

            {/* Field editor panel */}
            {selectedField && (
              <FieldEditor
                field={selectedField}
                allFields={fields}
                onChange={(updates) => updateField(selectedField.id, updates)}
                onClose={() => setSelectedFieldId(null)}
              />
            )}
          </div>
        </TabsContent>

        {/* Preview tab */}
        <TabsContent value="preview">
          <FormPreview fields={fields} settings={settings} />
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings">
          <SettingsTab settings={settings} onChange={setSettings} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
