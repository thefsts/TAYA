import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;

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

interface FormDef {
  _id: string;
  name: string;
  slug: string;
  status: string;
  fields: FormField[];
  settings: FormSettings;
}

function evaluateCondition(rule: ConditionalRule, values: Record<string, any>): boolean {
  const sourceVal = String(values[rule.sourceFieldId] ?? "").toLowerCase();
  const target = rule.value.toLowerCase();
  switch (rule.operator) {
    case "is": return sourceVal === target;
    case "is_not": return sourceVal !== target;
    case "contains": return sourceVal.includes(target);
    case "not_contains": return !sourceVal.includes(target);
    default: return true;
  }
}

function isFieldVisible(field: FormField, values: Record<string, any>): boolean {
  if (!field.condition) return true;
  return evaluateCondition(field.condition, values);
}

function validateField(field: FormField, value: any): string | null {
  if (field.required && !value && value !== 0) {
    return `${field.label} is required`;
  }
  if (field.validationRegex && value) {
    try {
      const re = new RegExp(field.validationRegex);
      if (!re.test(String(value))) {
        return field.validationMessage || `Invalid format for ${field.label}`;
      }
    } catch {}
  }
  return null;
}

function FileUploadField({
  id,
  value,
  onChange,
  error,
  convexHttpUrl,
}: {
  id: string;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  convexHttpUrl: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10 MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File must be 10 MB or smaller.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Step 1: get a Convex upload URL
      const urlRes = await fetch(`${convexHttpUrl}/api/public/form/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!urlRes.ok) throw new Error("Could not get upload URL");
      const { uploadUrl } = await urlRes.json();

      // Step 2: upload file bytes to the presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // Step 3: read the storage ID returned by Convex
      const { storageId } = await uploadRes.json();

      // Pass back a metadata object so the field value contains name + storageId
      onChange({ storageId, name: file.name, type: file.type, size: file.size });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-1">
      <input
        id={id}
        type="file"
        onChange={handleFile}
        disabled={uploading}
        className={`block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50 ${error ? "border border-red-400 rounded" : ""}`}
      />
      {uploading && <p className="text-xs text-slate-400 mt-1">Uploading…</p>}
      {!uploading && value?.name && (
        <p className="text-xs text-slate-500 mt-1">
          ✓ {value.name} ({(value.size / 1024).toFixed(0)} KB)
        </p>
      )}
      {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
    </div>
  );
}

function FormFieldRenderer({
  field,
  value,
  onChange,
  error,
  convexHttpUrl,
}: {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  convexHttpUrl?: string;
}) {
  if (field.type === "section_heading") {
    return (
      <div className="border-b border-slate-200 pb-2 pt-2">
        <h3 className="text-lg font-semibold text-slate-800">{field.label}</h3>
        {field.helpText && <p className="text-sm text-slate-500 mt-0.5">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === "hidden") {
    return <input type="hidden" name={field.id} value={field.hiddenValue ?? ""} />;
  }

  return (
    <div>
      <Label className="text-sm font-medium text-slate-700" htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.helpText && <p className="text-xs text-slate-400 mt-0.5 mb-1">{field.helpText}</p>}

      {(field.type === "short_text") && (
        <Input
          id={field.id}
          type="text"
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 ${error ? "border-red-400" : ""}`}
        />
      )}
      {(field.type === "email") && (
        <Input
          id={field.id}
          type="email"
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 ${error ? "border-red-400" : ""}`}
        />
      )}
      {(field.type === "phone") && (
        <Input
          id={field.id}
          type="tel"
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 ${error ? "border-red-400" : ""}`}
        />
      )}
      {(field.type === "number") && (
        <Input
          id={field.id}
          type="number"
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 ${error ? "border-red-400" : ""}`}
        />
      )}
      {field.type === "long_text" && (
        <Textarea
          id={field.id}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`mt-1 resize-none ${error ? "border-red-400" : ""}`}
        />
      )}
      {field.type === "date" && (
        <Input
          id={field.id}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 ${error ? "border-red-400" : ""}`}
        />
      )}
      {field.type === "file_upload" && (
        <FileUploadField
          id={field.id}
          value={value}
          onChange={onChange}
          error={error}
          convexHttpUrl={convexHttpUrl ?? ""}
        />
      )}
      {field.type === "dropdown" && (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger aria-label={field.label} className={`mt-1 ${error ? "border-red-400" : ""}`}>
            <SelectValue placeholder={field.placeholder || "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.type === "radio" && (
        <div className="mt-2 space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-primary"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {field.type === "checkbox" && (
        <div className="mt-2 space-y-2">
          {(field.options ?? []).map((opt) => {
            const checked = Array.isArray(value) && value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...current, opt]);
                    } else {
                      onChange(current.filter((v: string) => v !== opt));
                    }
                  }}
                  className="accent-primary"
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function PublicForm() {
  const params = useParams<{ siteSlug: string; formSlug: string }>();
  const siteSlug = params.siteSlug ?? "";
  const formSlug = params.formSlug ?? "";

  const convexHttpUrl = CONVEX_URL.replace(".convex.cloud", ".convex.site");

  const [form, setForm] = useState<FormDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({ _fsts_hp: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteSlug || !formSlug) {
      setError("Form not found.");
      setLoading(false);
      return;
    }
    fetch(`${convexHttpUrl}/api/public/form?slug=${encodeURIComponent(siteSlug)}&form=${encodeURIComponent(formSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
        } else {
          setForm(data as FormDef);
        }
      })
      .catch(() => setError("Failed to load form. Please try again."))
      .finally(() => setLoading(false));
  }, [siteSlug, formSlug]);

  function setValue(fieldId: string, val: any) {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
    setErrors((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    const newErrors: Record<string, string> = {};
    for (const field of form.fields) {
      if (!isFieldVisible(field, values)) continue;
      const err = validateField(field, values[field.id]);
      if (err) newErrors[field.id] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const emailField = form.fields.find(f => f.type === "email");
      const nameField = form.fields.find(f => f.label.toLowerCase().includes("name") && f.type === "short_text");
      const phoneField = form.fields.find(f => f.type === "phone");

      const res = await fetch(`${convexHttpUrl}/api/public/form/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: siteSlug,
          formId: form._id,
          data: values,
          submitterName: nameField ? values[nameField.id] : undefined,
          submitterEmail: emailField ? values[emailField.id] : undefined,
          submitterPhone: phoneField ? values[phoneField.id] : undefined,
        }),
      });

      const result = await res.json();
      if (res.status === 422 && result.fields) {
        setErrors(result.fields);
        return;
      }
      if (!res.ok || result.error) {
        throw new Error(result.error ?? "Submission failed");
      }

      if (form.settings.redirectUrl) {
        window.location.href = form.settings.redirectUrl;
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading form…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const settings = form.settings ?? {};

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Submission Received</h2>
          <p className="text-slate-500">
            {settings.successMessage || "Thank you! Your submission has been received."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{form.name}</h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {settings.honeypot && (
            <div style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }} aria-hidden>
              <input
                tabIndex={-1}
                name="_fsts_hp"
                autoComplete="off"
                value={values["_fsts_hp"] ?? ""}
                onChange={(e) => setValue("_fsts_hp", e.target.value)}
              />
            </div>
          )}
          {(form.fields as FormField[]).map((field) => {
            if (!isFieldVisible(field, values)) return null;
            return (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(v) => setValue(field.id, v)}
                error={errors[field.id]}
                convexHttpUrl={convexHttpUrl}
              />
            );
          })}
          {submitError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {submitError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Submitting…" : (settings.submitLabel || "Submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
