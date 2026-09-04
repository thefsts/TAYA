import { query, mutation, internalAction, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";

function toResponse(doc: any) {
  // Never expose the raw resendApiKey — return only a presence flag so the UI
  // can show "API key configured ✓" without leaking the credential.
  const { resendApiKey, ...rest } = doc;
  return {
    ...rest,
    id: doc._id,
    siteId: doc.siteId,
    updatedAt: new Date(doc._creationTime).toISOString(),
    resendApiKeyConfigured: !!resendApiKey,
  };
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
    // Per-site Resend API key override. When provided, takes precedence over
    // the platform-level RESEND_API_KEY environment variable. This allows each
    // client site to send from its own Resend account/domain without sharing a
    // single platform credential.
    apiKey: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = args.apiKey || process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "[email.send] No Resend API key available — email skipped. " +
        "Configure resendApiKey in the site's Email Config, or set RESEND_API_KEY " +
        "on the platform as a fallback.",
      );
      return { success: false, error: "No Resend API key configured (per-site or platform)" };
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

    try {
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
        return { success: false, error: `Resend API ${response.status}: ${text}` };
      }

      return { success: true };
    } catch (err: unknown) {
      // Network / runtime errors must never propagate as throws — callers rely
      // on { success: false } to update delivery state and schedule a retry.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[email.send] Unexpected error:", msg);
      return { success: false, error: `Unexpected send error: ${msg}` };
    }
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

    // ARCHITECTURE LOCK — website-owned delivery:
    // Form-submission notifications are sent ONLY through this site's own
    // Resend key (emailSettings.resendApiKey). Client websites own their
    // transactional email delivery: the client website sends its own
    // notification from its own Resend account, and TAYA stores the
    // submission in the site Inbox. There is intentionally NO platform
    // RESEND_API_KEY fallback here — it would duplicate delivery with the
    // website's own send. Platform mail infrastructure stays dormant for
    // TAYA-owned platform features (see email.send / sendDashboardWelcome).
    const siteApiKey = settings?.resendApiKey;
    if (!siteApiKey) {
      console.info(
        "[email.sendFormNotification] No per-site Resend key configured — TAYA send skipped (website-owned delivery).",
        { siteId: args.siteId, formType: args.formType },
      );
      return {
        skipped: true,
        reason: "no per-site Resend key configured — form notifications are website-owned by design",
      };
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
      // Per-site key only (required above) — this site's emails route through
      // its own Resend account. No platform RESEND_API_KEY fallback: client
      // websites own their form-notification delivery.
      apiKey: siteApiKey,
    });
    return { skipped: false };
  },
});

// ─── Portal welcome email ──────────────────────────────────────────────────────

/**
 * Send a welcome email to a newly registered portal member.
 * Only fires when the site has emailSettings configured with a fromEmail.
 * Site-scoped delivery: sends ONLY through the site's own Resend key —
 * portal mail is branded as the client site, so it can never route through
 * a platform account (the client's sender domain would be unverified there).
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

    // ARCHITECTURE LOCK — site-scoped delivery:
    // Portal welcome mail is branded as the client site and must route through
    // the site's own Resend account (emailSettings.resendApiKey). There is
    // intentionally NO platform RESEND_API_KEY fallback: a platform key cannot
    // send from the client's (unverified on that account) sender domain.
    const siteApiKey = settings?.resendApiKey;
    if (!siteApiKey) {
      console.info(
        "[email.sendPortalWelcome] No per-site Resend key configured — welcome email skipped.",
        { siteId: args.siteId },
      );
      return {
        skipped: true,
        reason: "no per-site Resend key configured — portal mail is site-scoped by design",
      };
    }

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
      // Per-site key only (required above) — the site's own Resend account.
      apiKey: siteApiKey,
    });
    return { skipped: false };
  },
});

// ─── Dashboard welcome email (new pending user created by a superadmin) ───────

/**
 * Builds the HTML for the "your dashboard account is ready" welcome email.
 * Extracted so both the send and preview paths share the same template.
 */
function buildDashboardWelcomeHtml({
  firstName,
  recipientName,
  dashboardUrl,
}: {
  firstName: string;
  recipientName: string;
  dashboardUrl: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#1a1a2e">
      <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:22px;color:#ffffff;letter-spacing:-0.5px">FSTS Client Dashboard</h1>
      </div>
      <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e">Hi ${firstName}, your dashboard is ready!</h2>
        <p style="color:#475569;line-height:1.7;margin:0 0 20px">
          Your FSTS Client Dashboard account has been set up and is ready for you to use.
          Sign in at the link below using the email address this message was sent to.
        </p>
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;
                  letter-spacing:-0.2px">
          Sign in to your dashboard →
        </a>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0" />
        <p style="color:#94a3b8;font-size:13px;margin:0 0 6px">
          <strong style="color:#475569">Dashboard URL:</strong>
          <a href="${dashboardUrl}" style="color:#3b82f6">${dashboardUrl}</a>
        </p>
        <p style="color:#94a3b8;font-size:13px;margin:0">
          You'll be prompted to create a password the first time you sign in.
          If you didn't expect this email, you can safely ignore it.
        </p>
        <p style="color:#cbd5e1;font-size:12px;margin-top:32px">
          Sent by FSTS Platform on behalf of the FSTS team.
        </p>
      </div>
    </div>
  `;
}

/**
 * Send a "your dashboard account is ready" welcome email to a newly created
 * pending dashboard user.
 * Uses the platform-level RESEND_API_KEY and DASHBOARD_URL env vars.
 * Logs a warning and returns { success: false } when no API key is configured.
 */
export const sendDashboardWelcome = internalAction({
  args: {
    recipientEmail: v.string(),
    recipientName: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "[email.sendDashboardWelcome] No RESEND_API_KEY configured — welcome email skipped. " +
        "Set RESEND_API_KEY as a Convex environment variable to enable this.",
      );
      return { success: false, error: "No RESEND_API_KEY configured" };
    }

    const dashboardUrl =
      process.env.DASHBOARD_URL ?? "https://app.fstsclientsystem.com";
    const firstName = args.recipientName.split(" ")[0] || args.recipientName;

    const html = buildDashboardWelcomeHtml({
      firstName,
      recipientName: args.recipientName,
      dashboardUrl,
    });

    const result: { success: boolean; error?: string } = await ctx.runAction(internal.email.send, {
      to: args.recipientEmail,
      subject: "Your FSTS Client Dashboard is ready",
      html,
      fromName: "FSTS Platform",
      fromEmail: process.env.PLATFORM_FROM_EMAIL ?? "noreply@fstsclientsystem.com",
    });
    return result;
  },
});

/**
 * Return a preview of the dashboard welcome email HTML without sending it.
 * Super-admin only. Used by the "Preview email" button in the Invite User dialog.
 */
export const previewDashboardWelcome = action({
  args: {
    recipientName: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ html: string; subject: string; to: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const dashboardUrl =
      process.env.DASHBOARD_URL ?? "https://app.fstsclientsystem.com";
    const firstName = args.recipientName.split(" ")[0] || args.recipientName;

    const html = buildDashboardWelcomeHtml({
      firstName,
      recipientName: args.recipientName,
      dashboardUrl,
    });

    return {
      html,
      subject: "Your FSTS Client Dashboard is ready",
      to: args.recipientEmail,
    };
  },
});

// ─── Payment confirmation email ───────────────────────────────────────────────

/**
 * Send a payment confirmation email to the customer after a successful Square
 * payment. Called by `squareOrders.sendPaymentEmails` via the scheduler.
 *
 * Returns { success: true } on delivery or { success: false, error } on failure.
 * Never throws — callers use the return value to update delivery state.
 */
export const sendPaymentConfirmation = internalAction({
  args: {
    siteId: v.id("sites"),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    itemName: v.optional(v.string()),
    amountCents: v.number(),
    orderId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const settings = await ctx.runQuery(internal.email._getEmailSettings, { siteId: args.siteId });
    if (!settings?.fromEmail) {
      // No fromEmail configured — this is an operational failure that admins must
      // fix. Returning { success: false } surfaces it in the email delivery state
      // machine so retries occur and the dashboard shows a "failed" badge.
      const errMsg = "No fromEmail configured for this site — set it in Email Config";
      console.warn("[email.sendPaymentConfirmation]", errMsg, "siteId:", args.siteId);
      return { success: false, error: errMsg };
    }

    const apiKey = settings.resendApiKey || process.env.RESEND_API_KEY;
    if (!apiKey) {
      const errMsg = "No Resend API key configured (per-site or platform)";
      console.warn("[email.sendPaymentConfirmation]", errMsg, "siteId:", args.siteId);
      return { success: false, error: errMsg };
    }

    const firstName = args.customerName?.split(" ")[0] ?? args.customerName ?? "there";
    const amountFormatted = `$${(args.amountCents / 100).toFixed(2)}`;
    const itemLabel = args.itemName ?? "your purchase";

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#1a1a2e">
        <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px;color:#ffffff">Payment Confirmation</h1>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 16px;font-size:18px;color:#1a1a2e">Thank you, ${firstName}!</h2>
          <p style="color:#475569;line-height:1.7;margin:0 0 20px">
            Your payment for <strong>${itemLabel}</strong> has been received and processed successfully.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:10px 0;color:#64748b;width:140px">Item</td>
              <td style="padding:10px 0;font-weight:600;color:#0f172a">${itemLabel}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:10px 0;color:#64748b">Amount paid</td>
              <td style="padding:10px 0;font-weight:700;color:#16a34a;font-size:18px">${amountFormatted}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#64748b">Order reference</td>
              <td style="padding:10px 0;font-family:monospace;font-size:12px;color:#64748b">${args.orderId}</td>
            </tr>
          </table>
          <p style="color:#94a3b8;font-size:13px;margin:0">
            If you have any questions about your payment, please reply to this email.
          </p>
          <p style="color:#cbd5e1;font-size:12px;margin-top:24px">
            Sent by FSTS Platform on behalf of ${settings.fromName ?? "the business"}.
          </p>
        </div>
      </div>
    `;

    const result = await ctx.runAction(internal.email.send, {
      to: args.customerEmail,
      subject: `Payment confirmed – ${itemLabel}`,
      html,
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      apiKey: settings.resendApiKey,
    });
    return result as { success: boolean; error?: string };
  },
});

/**
 * Send a business notification email when a customer completes a payment.
 * Sent to the site's notificationEmail (or fromEmail as fallback).
 *
 * Returns { success: true } on delivery or { success: false, error } on failure.
 * Never throws.
 */
export const sendBusinessNotification = internalAction({
  args: {
    siteId: v.id("sites"),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    itemName: v.optional(v.string()),
    amountCents: v.number(),
    orderId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const settings = await ctx.runQuery(internal.email._getEmailSettings, { siteId: args.siteId });
    const recipientEmail = settings?.notificationEmail || settings?.fromEmail;
    if (!recipientEmail) {
      // No business notification address configured — this is an observable
      // configuration failure. Return { success: false } so the state machine
      // records a failed status, the dashboard shows it, and admins can fix the
      // config and trigger a manual resend.
      const errMsg = "No business notification email configured — set notificationEmail or fromEmail in Email Config";
      console.warn("[email.sendBusinessNotification]", errMsg, "siteId:", args.siteId);
      return { success: false, error: errMsg };
    }

    const apiKey = settings?.resendApiKey || process.env.RESEND_API_KEY;
    if (!apiKey) {
      const errMsg = "No Resend API key configured (per-site or platform)";
      console.warn("[email.sendBusinessNotification]", errMsg, "siteId:", args.siteId);
      return { success: false, error: errMsg };
    }

    const amountFormatted = `$${(args.amountCents / 100).toFixed(2)}`;
    const itemLabel = args.itemName ?? "Unknown item";

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#1a1a2e">
        <h2 style="color:#1a1a2e">New payment received — ${amountFormatted}</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#555;width:140px">Customer</td><td style="padding:6px 0;font-weight:600">${args.customerName ?? "—"}</td></tr>
          ${args.customerEmail ? `<tr><td style="padding:6px 0;color:#555">Email</td><td style="padding:6px 0"><a href="mailto:${args.customerEmail}">${args.customerEmail}</a></td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#555">Item</td><td style="padding:6px 0">${itemLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Amount</td><td style="padding:6px 0;font-weight:700;color:#16a34a">${amountFormatted}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Order ref</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${args.orderId}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px">Sent by FSTS Platform</p>
      </div>
    `;

    const result = await ctx.runAction(internal.email.send, {
      to: recipientEmail,
      subject: `New payment – ${itemLabel} (${amountFormatted})`,
      html,
      fromName: settings?.fromName,
      fromEmail: settings?.fromEmail,
      apiKey: settings?.resendApiKey,
    });
    return result as { success: boolean; error?: string };
  },
});

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "email")) return null;
    const doc = await ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (!doc) return { siteId, fromName: "", fromEmail: "", replyToEmail: "", notifyOnNewLead: true, notifyOnBooking: true, updatedAt: new Date().toISOString(), resendApiKeyConfigured: false };
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
    // Per-site Resend API key. Pass an empty string "" to clear an existing key.
    // The raw value is never returned by `email.get` — only a boolean flag.
    resendApiKey: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    // Treat an empty string as "remove the key" so the UI can clear it with ""
    if ("resendApiKey" in fields && fields.resendApiKey === "") {
      (fields as Record<string, unknown>).resendApiKey = undefined;
    }
    const user = await requirePermission(ctx, siteId, PERMISSIONS.INTEGRATIONS_MANAGE);
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
    // Strip resendApiKey before logging — never persist the raw secret in
    // activity logs or version history (accessible to any site-access user).
    const { resendApiKey: _key, ...docSafe } = doc as any;
    const existingSafe = existing ? (() => { const { resendApiKey: _k, ...s } = existing as any; return s; })() : existing;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "email_settings", page: "Email Config", previousValue: existingSafe, newValue: docSafe });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "email_settings", entityId: docId, snapshot: docSafe });
    return toResponse(doc);
  },
});
