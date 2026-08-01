import { query, mutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireDesignCapability, requireModuleEnabled } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, updatedAt: new Date(doc._creationTime).toISOString() };
}

// ─── Internal query: fetch emailSettings for a site ───────────────────────────

export const _getEmailSettings = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) =>
    ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
});

// ─── Core send action (Resend REST API) ───────────────────────────────────────

/**
 * Send a single transactional email via Resend.
 * Requires RESEND_API_KEY to be set as a Convex environment variable.
 * Logs a warning and returns { success: false } when the key is absent so
 * callers are never hard-blocked by a missing credential.
 */
export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[email.send] RESEND_API_KEY not set — email skipped");
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    const fromName = args.fromName ?? "FSTS Platform";
    const fromEmail = args.fromEmail ?? "noreply@fsts-platform.com";

    const body: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    };
    if (args.replyTo) body.reply_to = args.replyTo;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[email.send] Resend API error:", response.status, text);
      return { success: false, error: text };
    }

    return { success: true };
  },
});

// ─── Form-submission notification ─────────────────────────────────────────────

/**
 * Notify the site owner when a new form submission arrives.
 * Respects the `notifyOnNewLead` / `notifyOnBooking` flags in emailSettings.
 */
export const sendFormNotification = internalAction({
  args: {
    siteId: v.id("sites"),
    formType: v.string(),
    submitterName: v.optional(v.string()),
    submitterEmail: v.optional(v.string()),
    submitterPhone: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.runQuery(internal.email._getEmailSettings, { siteId: args.siteId });

    // Determine whether this form type should trigger a notification
    const isBooking = args.formType.toLowerCase().includes("booking") ||
                      args.formType.toLowerCase().includes("event");
    const shouldNotify = isBooking
      ? (settings?.notifyOnBooking ?? true)
      : (settings?.notifyOnNewLead ?? true);

    if (!shouldNotify) return { skipped: true };

    // Recipient: notificationEmail if set, otherwise fall back to fromEmail
    const recipientEmail = settings?.notificationEmail || settings?.fromEmail;
    if (!recipientEmail) {
      console.warn("[email.sendFormNotification] No notification email configured for site", args.siteId);
      return { skipped: true, reason: "no notification email configured" };
    }

    const fromName = settings?.fromName ?? "FSTS Platform";
    const senderEmail = settings?.fromEmail; // sender identity stays as fromEmail regardless of recipient
    const submitterLabel = args.submitterName ?? args.submitterEmail ?? "Someone";
    const formLabel = args.formType.replace(/_/g, " ");

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#1a1a2e">New ${formLabel} submission</h2>
        <table style="width:100%;border-collapse:collapse">
          ${args.submitterName ? `<tr><td style="padding:6px 0;color:#555;width:140px">Name</td><td style="padding:6px 0;font-weight:600">${args.submitterName}</td></tr>` : ""}
          ${args.submitterEmail ? `<tr><td style="padding:6px 0;color:#555">Email</td><td style="padding:6px 0"><a href="mailto:${args.submitterEmail}">${args.submitterEmail}</a></td></tr>` : ""}
          ${args.submitterPhone ? `<tr><td style="padding:6px 0;color:#555">Phone</td><td style="padding:6px 0">${args.submitterPhone}</td></tr>` : ""}
          ${args.message ? `<tr><td style="padding:6px 0;color:#555;vertical-align:top">Message</td><td style="padding:6px 0;white-space:pre-wrap">${args.message}</td></tr>` : ""}
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px">Sent by FSTS Platform</p>
      </div>
    `;

    await ctx.runAction(internal.email.send, {
      to: recipientEmail,
      subject: `New ${formLabel} from ${submitterLabel}`,
      html,
      fromName,
      fromEmail: senderEmail,
      replyTo: args.submitterEmail,
    });
  },
});

// ─── Portal welcome email ──────────────────────────────────────────────────────

/**
 * Send a welcome email to a newly registered portal member.
 * Only fires when the site has emailSettings configured with a fromEmail.
 */
export const sendPortalWelcome = internalAction({
  args: {
    siteId: v.id("sites"),
    siteName: v.string(),
    firstName: v.string(),
    email: v.string(),
    requiresApproval: v.boolean(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.runQuery(internal.email._getEmailSettings, { siteId: args.siteId });

    const fromEmail = settings?.fromEmail;
    if (!fromEmail) {
      console.warn("[email.sendPortalWelcome] No fromEmail configured for site", args.siteId);
      return { skipped: true, reason: "no fromEmail configured" };
    }

    const fromName = settings?.fromName ?? args.siteName;

    const bodyText = args.requiresApproval
      ? `Thank you for registering! Your account is pending approval. You will receive another email once you have been approved.`
      : `Your account is active and you can log in now.`;

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#1a1a2e">Welcome to the ${args.siteName} client portal, ${args.firstName}!</h2>
        <p style="color:#333;line-height:1.6">${bodyText}</p>
        <p style="color:#888;font-size:12px;margin-top:32px">Sent by FSTS Platform on behalf of ${args.siteName}</p>
      </div>
    `;

    await ctx.runAction(internal.email.send, {
      to: args.email,
      subject: `Welcome to the ${args.siteName} client portal`,
      html,
      fromName,
      fromEmail,
    });
  },
});

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "email")) return null;
    const doc = await ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (!doc) return { siteId, fromName: "", fromEmail: "", replyToEmail: "", notifyOnNewLead: true, notifyOnBooking: true, updatedAt: new Date().toISOString() };
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    replyToEmail: v.optional(v.string()),
    notificationEmail: v.optional(v.string()),
    notifyOnNewLead: v.optional(v.boolean()),
    notifyOnBooking: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireDesignCapability(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "email");
    const existing = await ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, fields as any);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("emailSettings", { siteId, fromName: "", fromEmail: "", replyToEmail: "", notifyOnNewLead: true, notifyOnBooking: true, ...fields });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "email_settings", page: "Email Config", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "email_settings", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});
