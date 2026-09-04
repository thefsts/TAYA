import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "forms")) return [];
    const docs = await ctx.db
      .query("forms")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), formId: v.id("forms") },
  handler: async (ctx, { siteId, formId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "forms")) return null;
    const doc = await ctx.db.get(formId);
    if (!doc || doc.siteId !== siteId) return null;
    return toResponse(doc);
  },
});

export const getBySlug = internalQuery({
  args: { siteId: v.id("sites"), slug: v.string() },
  handler: async (ctx, { siteId, slug }) => {
    const doc = await ctx.db
      .query("forms")
      .withIndex("by_site_slug", (q) => q.eq("siteId", siteId).eq("slug", slug))
      .first();
    return doc ? toResponse(doc) : null;
  },
});

export const getSubmissionCount = query({
  args: { siteId: v.id("sites"), formId: v.id("forms") },
  handler: async (ctx, { siteId, formId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return 0;
    if (!await checkModuleEnabled(ctx, siteId, "forms")) return 0;
    const form = await ctx.db.get(formId);
    if (!form || form.siteId !== siteId) return 0;
    const docs = await ctx.db
      .query("formSubmissions")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    return docs.length;
  },
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) + "-" + Math.random().toString(36).slice(2, 7);
}

const defaultSettings = {
  submitLabel: "Submit",
  successMessage: "Thank you! Your submission has been received.",
  redirectUrl: "",
  notificationEmails: [],
  crmRouting: false,
  honeypot: true,
};

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    templateType: v.optional(v.string()),
    fields: v.optional(v.any()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, name, templateType, fields, settings }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    await requireModuleEnabled(ctx, siteId, "forms");
    const slug = generateSlug(name);
    const id = await ctx.db.insert("forms", {
      siteId,
      name,
      slug,
      status: "draft",
      fields: fields ?? getTemplateFields(templateType ?? "custom"),
      settings: { ...defaultSettings, ...(settings ?? {}) },
      templateType,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    formId: v.id("forms"),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    fields: v.optional(v.any()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, formId, ...patch }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    await requireModuleEnabled(ctx, siteId, "forms");
    const doc = await ctx.db.get(formId);
    if (!doc || doc.siteId !== siteId) throw new Error("Not found");
    const update: any = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.fields !== undefined) update.fields = patch.fields;
    if (patch.settings !== undefined) update.settings = patch.settings;
    await ctx.db.patch(formId, update);
    return toResponse((await ctx.db.get(formId))!);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), formId: v.id("forms") },
  handler: async (ctx, { siteId, formId }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    await requireModuleEnabled(ctx, siteId, "forms");
    const doc = await ctx.db.get(formId);
    if (!doc || doc.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(formId);
  },
});

export const duplicate = mutation({
  args: { siteId: v.id("sites"), formId: v.id("forms") },
  handler: async (ctx, { siteId, formId }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    await requireModuleEnabled(ctx, siteId, "forms");
    const doc = await ctx.db.get(formId);
    if (!doc || doc.siteId !== siteId) throw new Error("Not found");
    const newId = await ctx.db.insert("forms", {
      siteId,
      name: doc.name + " (Copy)",
      slug: generateSlug(doc.name + "-copy"),
      status: "draft",
      fields: doc.fields,
      settings: doc.settings,
      templateType: doc.templateType,
    });
    return newId;
  },
});

/**
 * PUBLIC — no dashboard auth required.
 * This mutation is called by website visitors submitting a published form on a
 * client's site.  Authentication would prevent unauthenticated visitors from
 * completing forms, so it is intentionally unauthenticated.  The handler
 * guards against abuse by requiring the form to exist, belong to the supplied
 * siteId, and have status "published" before accepting any data.
 */
export const submitToForm = mutation({
  args: {
    siteId: v.id("sites"),
    formId: v.id("forms"),
    data: v.any(),
    submitterName: v.optional(v.string()),
    submitterEmail: v.optional(v.string()),
    submitterPhone: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, formId, data, submitterName, submitterEmail, submitterPhone }) => {
    const form = await ctx.db.get(formId);
    if (!form || form.siteId !== siteId || form.status !== "published") {
      throw new Error("Form not available");
    }
    const id = await ctx.db.insert("formSubmissions", {
      siteId,
      formId,
      formType: form.name,
      submitterName,
      submitterEmail,
      submitterPhone,
      message: data?.message,
      data,
      status: "new",
      submittedAt: Date.now(),
    });
    return id;
  },
});

export const submitPublic = internalMutation({
  args: {
    siteId: v.id("sites"),
    formId: v.string(),
    data: v.any(),
    submitterName: v.optional(v.string()),
    submitterEmail: v.optional(v.string()),
    submitterPhone: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, formId, data, submitterName, submitterEmail, submitterPhone }) => {
    const form = await ctx.db.get(formId as any) as any;
    if (!form || form.siteId !== siteId || form.status !== "published") {
      throw new Error("Form not available");
    }

    const fieldValues = data ?? {};

    // Server-side field validation
    const validationErrors: Record<string, string> = {};
    for (const field of (form.fields as any[])) {
      if (field.type === "hidden" || field.type === "section_heading") continue;

      // Evaluate conditional visibility (skip validation for hidden fields)
      if (field.condition) {
        const sourceVal = String(fieldValues[field.condition.sourceFieldId] ?? "").toLowerCase();
        const target = (field.condition.value ?? "").toLowerCase();
        let visible = true;
        switch (field.condition.operator) {
          case "is": visible = sourceVal === target; break;
          case "is_not": visible = sourceVal !== target; break;
          case "contains": visible = sourceVal.includes(target); break;
          case "not_contains": visible = !sourceVal.includes(target); break;
        }
        if (!visible) continue;
      }

      const value = fieldValues[field.id];
      const isEmpty = value === undefined || value === null || value === "" ||
        (Array.isArray(value) && value.length === 0);

      if (field.required && isEmpty) {
        validationErrors[field.id] = `${field.label} is required`;
        continue;
      }

      if (field.validationRegex && value && !isEmpty) {
        try {
          const re = new RegExp(field.validationRegex);
          if (!re.test(String(value))) {
            validationErrors[field.id] = field.validationMessage || `Invalid format for ${field.label}`;
          }
        } catch {}
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      return { validationErrors } as any;
    }

    const settings = form.settings ?? {};

    const id = await ctx.db.insert("formSubmissions", {
      siteId,
      formId: formId as any,
      formType: form.name,
      submitterName,
      submitterEmail,
      submitterPhone,
      message: fieldValues.message,
      data: fieldValues,
      status: "new",
      submittedAt: Date.now(),
    });

    // CRM routing: map form template type → CRM entity type, route through syncToCrm
    // (syncToCrm checks connection status and entity-level toggle before dispatching)
    if (settings.crmRouting === true) {
      const entityTypeMap: Record<string, string> = {
        contact: "contact_form",
        quote_request: "quote_request",
        consultation: "consultation",
        course_registration: "course_registration",
        event_registration: "event_registration",
        employment: "application",
        newsletter: "newsletter_signup",
      };
      const entityType = entityTypeMap[form.templateType ?? ""] ?? "custom_form";

      const crmPayload = {
        form: form.name,
        name: submitterName,
        email: submitterEmail,
        phone: submitterPhone,
        fieldCount: Object.keys(fieldValues).length,
        data: fieldValues,
      };

      // Schedule via syncToCrm which enforces connection check + entity toggle
      await ctx.scheduler.runAfter(0, internal.crm.syncToCrm, {
        siteId,
        provider: "operon",
        entityType,
        direction: "outbound",
        entityRef: id.toString(),
        payload: crmPayload,
      });
    }

    // Email notifications: schedule an action to deliver notification emails
    const notificationEmails: string[] = settings.notificationEmails ?? [];
    if (notificationEmails.length > 0) {
      await ctx.scheduler.runAfter(0, internal.forms.sendSubmissionNotification, {
        siteId,
        formName: form.name,
        formSlug: form.slug,
        submissionId: id.toString(),
        submitterName: submitterName ?? null,
        submitterEmail: submitterEmail ?? null,
        notificationEmails,
        fieldCount: Object.keys(fieldValues).length,
      });
    }

    return { id } as any;
  },
});

// Sends notification emails when a form is submitted. Called via scheduler.
// ARCHITECTURE LOCK — website-owned delivery:
// Reads the site's own emailSettings (emailSettings.resendApiKey) and sends
// from the site's own sender identity. There is intentionally NO platform
// RESEND_API_KEY fallback — form-submission notifications are website-owned,
// so a platform key must never silently start sending them. When the site
// has no per-site key the send is skipped gracefully (logged, never throws)
// so the submission pipeline never blocks on email delivery.
export const sendSubmissionNotification = internalAction({
  args: {
    siteId: v.id("sites"),
    formName: v.string(),
    formSlug: v.string(),
    submissionId: v.string(),
    submitterName: v.union(v.string(), v.null()),
    submitterEmail: v.union(v.string(), v.null()),
    notificationEmails: v.array(v.string()),
    fieldCount: v.number(),
  },
  handler: async (ctx, args) => {
    const {
      formName, formSlug, submissionId, submitterName, submitterEmail,
      notificationEmails, fieldCount,
    } = args;

    // Per-site email settings — the site's own Resend key + sender identity.
    const settings = await ctx.runQuery(internal.email._getEmailSettings, {
      siteId: args.siteId,
    }) as { fromName?: string; fromEmail?: string; resendApiKey?: string } | null;

    const siteApiKey = settings?.resendApiKey;
    const senderEmail = settings?.fromEmail;
    const senderName = settings?.fromName;

    if (!siteApiKey || !senderEmail) {
      console.info(
        "[forms] Email notification skipped — no per-site Resend configuration (website-owned delivery).",
        { siteId: args.siteId, formName, submissionId, notificationEmails },
      );
      return;
    }

    const senderLine = submitterName
      ? `${submitterName}${submitterEmail ? ` <${submitterEmail}>` : ""}`
      : submitterEmail ?? "Anonymous";

    const subject = `New submission: ${formName}`;
    const htmlBody = `
      <h2>New Form Submission</h2>
      <p><strong>Form:</strong> ${formName} (<code>${formSlug}</code>)</p>
      <p><strong>From:</strong> ${senderLine}</p>
      <p><strong>Fields submitted:</strong> ${fieldCount}</p>
      <p><strong>Submission ID:</strong> ${submissionId}</p>
      <p>Log in to your FSTS dashboard to view the full submission in Contact Inbox.</p>
    `;

    for (const toEmail of notificationEmails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${siteApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName ?? formName} <${senderEmail}>`,
            to: toEmail,
            subject,
            html: htmlBody,
          }),
        });
        if (!res.ok) {
          const detail = await res.text();
          console.error("[forms] Resend delivery failed", { toEmail, status: res.status, detail });
        }
      } catch (err) {
        console.error("[forms] Resend request error", { toEmail, err });
      }
    }
  },
});


function getTemplateFields(templateType: string): any[] {
  const baseContact = [
    { id: "f1", type: "short_text", label: "Full Name", placeholder: "Your name", required: true, helpText: "" },
    { id: "f2", type: "email", label: "Email Address", placeholder: "you@example.com", required: true, helpText: "" },
    { id: "f3", type: "phone", label: "Phone Number", placeholder: "(555) 000-0000", required: false, helpText: "" },
    { id: "f4", type: "long_text", label: "Message", placeholder: "How can we help you?", required: true, helpText: "" },
  ];

  switch (templateType) {
    case "contact":
      return baseContact;
    case "quote_request":
      return [
        ...baseContact.slice(0, 3),
        { id: "f4", type: "dropdown", label: "Service Type", required: true, helpText: "", options: ["Consulting", "Training", "Support", "Other"] },
        { id: "f5", type: "long_text", label: "Project Details", placeholder: "Describe your project or needs", required: true, helpText: "" },
        { id: "f6", type: "short_text", label: "Budget Range", placeholder: "e.g. $1,000 – $5,000", required: false, helpText: "" },
      ];
    case "course_registration":
      return [
        ...baseContact.slice(0, 3),
        { id: "f4", type: "dropdown", label: "Course", required: true, helpText: "", options: ["Basic Handgun", "Defensive Shooting", "First Shots"] },
        { id: "f5", type: "date", label: "Preferred Start Date", required: false, helpText: "" },
        { id: "f6", type: "long_text", label: "Additional Notes", placeholder: "Any special requirements or questions", required: false, helpText: "" },
      ];
    case "event_registration":
      return [
        ...baseContact.slice(0, 3),
        { id: "f4", type: "short_text", label: "Event Name", placeholder: "Which event are you registering for?", required: true, helpText: "" },
        { id: "f5", type: "number", label: "Number of Attendees", placeholder: "1", required: true, helpText: "" },
        { id: "f6", type: "checkbox", label: "Dietary Restrictions", required: false, helpText: "", options: ["Vegetarian", "Vegan", "Gluten-Free", "None"] },
      ];
    case "employment":
      return [
        ...baseContact.slice(0, 3),
        { id: "f4", type: "short_text", label: "Position Applied For", placeholder: "Job title", required: true, helpText: "" },
        { id: "f5", type: "short_text", label: "LinkedIn / Portfolio URL", placeholder: "https://", required: false, helpText: "" },
        { id: "f6", type: "long_text", label: "Why do you want to work with us?", placeholder: "Tell us about yourself", required: true, helpText: "" },
      ];
    case "newsletter":
      return [
        { id: "f1", type: "short_text", label: "First Name", placeholder: "Your name", required: false, helpText: "" },
        { id: "f2", type: "email", label: "Email Address", placeholder: "you@example.com", required: true, helpText: "" },
        { id: "f3", type: "radio", label: "Topics of Interest", required: false, helpText: "", options: ["Training", "Events", "Safety Tips", "All of the above"] },
      ];
    default:
      return [];
  }
}
