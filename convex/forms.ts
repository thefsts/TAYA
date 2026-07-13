import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
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
    await requireSiteAccessMutation(ctx, siteId);
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
    await requireSiteAccessMutation(ctx, siteId);
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
    await requireSiteAccessMutation(ctx, siteId);
    const doc = await ctx.db.get(formId);
    if (!doc || doc.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(formId);
  },
});

export const duplicate = mutation({
  args: { siteId: v.id("sites"), formId: v.id("forms") },
  handler: async (ctx, { siteId, formId }) => {
    await requireSiteAccessMutation(ctx, siteId);
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

    // CRM routing: create a pending sync log and immediately schedule a
    // processor action to push the lead to Operon CRM
    if (settings.crmRouting === true) {
      const crmConn = await ctx.db
        .query("crmConnections")
        .withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", "operon"))
        .first();
      if (crmConn && crmConn.status === "connected") {
        const syncLogId = await ctx.db.insert("crmSyncLogs", {
          siteId,
          provider: "operon",
          entityType: "custom_form",
          direction: "outbound",
          status: "pending",
          entityRef: id.toString(),
          message: `Form submission from ${submitterName ?? submitterEmail ?? "anonymous"} via "${form.name}"`,
          attempt: 1,
        });
        await ctx.db.patch(crmConn._id, { lastSyncAt: Date.now() });
        // Schedule the dispatch action — runs outside mutation to allow HTTP calls
        await ctx.scheduler.runAfter(0, internal.forms.dispatchCrmLead, {
          syncLogId: syncLogId.toString(),
          apiKeyEncrypted: crmConn.apiKeyEncrypted ?? null,
          orgId: crmConn.orgId ?? null,
          formName: form.name,
          submitterName: submitterName ?? null,
          submitterEmail: submitterEmail ?? null,
          submitterPhone: submitterPhone ?? null,
          fieldCount: Object.keys(fieldValues).length,
        });
      }
    }

    // Email notifications: schedule an action to deliver notification emails
    const notificationEmails: string[] = settings.notificationEmails ?? [];
    if (notificationEmails.length > 0) {
      await ctx.scheduler.runAfter(0, internal.forms.sendSubmissionNotification, {
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
// Reads RESEND_API_KEY from environment; logs only when key is absent so the
// submission pipeline never blocks on email delivery.
export const sendSubmissionNotification = internalAction({
  args: {
    formName: v.string(),
    formSlug: v.string(),
    submissionId: v.string(),
    submitterName: v.union(v.string(), v.null()),
    submitterEmail: v.union(v.string(), v.null()),
    notificationEmails: v.array(v.string()),
    fieldCount: v.number(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const {
      formName, formSlug, submissionId, submitterName, submitterEmail,
      notificationEmails, fieldCount,
    } = args;

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

    if (!apiKey) {
      console.info(
        "[forms] Email notification skipped — RESEND_API_KEY not set.",
        { formName, submissionId, notificationEmails },
      );
      return;
    }

    for (const toEmail of notificationEmails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "noreply@fsts.app",
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

// Dispatches a form submission as a lead to the Operon CRM API.
// Decrypts the stored API key and POSTs to the Operon leads endpoint.
// Updates the crmSyncLog with success or failure regardless of outcome.
export const dispatchCrmLead = internalAction({
  args: {
    syncLogId: v.string(),
    apiKeyEncrypted: v.union(v.string(), v.null()),
    orgId: v.union(v.string(), v.null()),
    formName: v.string(),
    submitterName: v.union(v.string(), v.null()),
    submitterEmail: v.union(v.string(), v.null()),
    submitterPhone: v.union(v.string(), v.null()),
    fieldCount: v.number(),
  },
  handler: async (ctx, args) => {
    const {
      syncLogId, apiKeyEncrypted, orgId,
      formName, submitterName, submitterEmail, submitterPhone, fieldCount,
    } = args;

    async function markLog(status: string, message: string) {
      await ctx.runMutation(internal.forms.updateSyncLog, { syncLogId, status, message });
    }

    if (!apiKeyEncrypted) {
      await markLog("failed", "No API key stored — connect Operon CRM in site settings first.");
      return;
    }

    let apiKey: string;
    try {
      const { decryptField } = await import("./lib/encrypt");
      apiKey = await decryptField(apiKeyEncrypted);
    } catch (err) {
      await markLog("failed", `Decryption error: ${err}`);
      return;
    }

    const payload = {
      source: "fsts_form",
      form: formName,
      name: submitterName,
      email: submitterEmail,
      phone: submitterPhone,
      fieldCount,
      orgId,
    };

    try {
      const res = await fetch("https://api.operoncrm.com/v1/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        await markLog("success", `Lead created (id: ${(body as any).id ?? "unknown"})`);
      } else {
        const detail = await res.text();
        await markLog("failed", `Operon API ${res.status}: ${detail.slice(0, 200)}`);
      }
    } catch (err) {
      await markLog("failed", `Network error: ${err}`);
    }
  },
});

// Updates a crmSyncLog entry — called from dispatchCrmLead action
export const updateSyncLog = internalMutation({
  args: {
    syncLogId: v.string(),
    status: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { syncLogId, status, message }) => {
    try {
      const doc = await ctx.db.get(syncLogId as any);
      if (doc) {
        await ctx.db.patch(syncLogId as any, { status, message });
      }
    } catch {
      // ignore — sync log may not exist if schema rolled back
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
