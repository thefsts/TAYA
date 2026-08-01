import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireSiteAccessMutation, requireModuleEnabled } from "./lib/requireSiteAccess";

function toResponse(doc: any) {
  return {
    ...doc,
    id: doc._id,
    siteId: doc.siteId,
    submittedAt: new Date(doc.submittedAt).toISOString(),
    readAt: doc.readAt ? new Date(doc.readAt).toISOString() : null,
  };
}

export const list = query({
  args: {
    siteId: v.id("sites"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, status }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "contact")) return [];
    const docs = status
      ? await ctx.db.query("formSubmissions").withIndex("by_site_status", (q) => q.eq("siteId", siteId).eq("status", status)).collect()
      : await ctx.db.query("formSubmissions").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return docs.sort((a, b) => b.submittedAt - a.submittedAt).map(toResponse);
  },
});

export const updateStatus = mutation({
  args: {
    siteId: v.id("sites"),
    submissionId: v.id("formSubmissions"),
    status: v.string(),
  },
  handler: async (ctx, { siteId, submissionId, status }) => {
    await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "contact");
    const doc = await ctx.db.get(submissionId);
    if (!doc || doc.siteId !== siteId) throw new Error("Not found");
    const patch: any = { status };
    if (status === "read" && !doc.readAt) patch.readAt = Date.now();
    await ctx.db.patch(submissionId, patch);
    return toResponse((await ctx.db.get(submissionId))!);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), submissionId: v.id("formSubmissions") },
  handler: async (ctx, { siteId, submissionId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "contact");
    const doc = await ctx.db.get(submissionId);
    if (!doc || doc.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(submissionId);
  },
});

const submitHandler = async (ctx: any, args: {
  siteSlug: string;
  formType: string;
  submitterName?: string;
  submitterEmail?: string;
  submitterPhone?: string;
  message?: string;
  data?: any;
}) => {
  const { siteSlug, ...fields } = args;
  const site = await ctx.db
    .query("sites")
    .withIndex("by_slug", (q: any) => q.eq("slug", siteSlug))
    .first();
  if (!site) throw new Error("Site not found");
  const id = await ctx.db.insert("formSubmissions", {
    siteId: site._id,
    formType: fields.formType,
    submitterName: fields.submitterName,
    submitterEmail: fields.submitterEmail,
    submitterPhone: fields.submitterPhone,
    message: fields.message,
    data: fields.data ?? {},
    status: "new",
    submittedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.automation.runAutomationRules, {
    siteId: site._id,
    triggerType: "form_submitted",
    triggerPayload: {
      formType: fields.formType,
      submitterName: fields.submitterName,
      submitterEmail: fields.submitterEmail,
    },
  });
  // Notify the site owner of the new submission
  await ctx.scheduler.runAfter(0, internal.email.sendFormNotification, {
    siteId: site._id,
    formType: fields.formType,
    submitterName: fields.submitterName,
    submitterEmail: fields.submitterEmail,
    submitterPhone: fields.submitterPhone,
    message: fields.message,
  });
  return id;
};

const submitArgs = {
  siteSlug: v.string(),
  formType: v.string(),
  submitterName: v.optional(v.string()),
  submitterEmail: v.optional(v.string()),
  submitterPhone: v.optional(v.string()),
  message: v.optional(v.string()),
  data: v.optional(v.any()),
};

export const submit = mutation({ args: submitArgs, handler: submitHandler });
export const submitInternal = internalMutation({ args: submitArgs, handler: submitHandler });
