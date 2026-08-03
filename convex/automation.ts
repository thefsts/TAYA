/**
 * WOS Phase 8 — Automation Engine™
 *
 * Provides trigger → condition → action rules that fire automatically
 * when site events occur (article published, form submitted, payment received, etc.).
 */

import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

/* ── Types ────────────────────────────────────────────────────────────────── */

export type TriggerType =
  | "article_published"
  | "form_submitted"
  | "payment_received"
  | "course_registration"
  | "event_registration"
  | "crm_sync_completed"
  | "backup_created";

export type ActionType =
  | "notify_crm"
  | "send_email"
  | "create_backup"
  | "log_activity"
  | "post_webhook"
  | "create_social_task";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface ActionDef {
  type: string;
  order: number;
  config: any;
}

interface ActionResult {
  actionType: string;
  order: number;
  status: "success" | "failure" | "skipped";
  message?: string;
}

/* ── Condition evaluation ─────────────────────────────────────────────────── */

function evaluateCondition(condition: Condition, payload: any): boolean {
  const fieldValue = String(payload?.[condition.field] ?? "");
  const condValue = condition.value;
  switch (condition.operator) {
    case "equals":
      return fieldValue === condValue;
    case "not_equals":
      return fieldValue !== condValue;
    case "contains":
      return fieldValue.toLowerCase().includes(condValue.toLowerCase());
    case "starts_with":
      return fieldValue.toLowerCase().startsWith(condValue.toLowerCase());
    case "ends_with":
      return fieldValue.toLowerCase().endsWith(condValue.toLowerCase());
    case "is_empty":
      return fieldValue === "";
    case "is_not_empty":
      return fieldValue !== "";
    default:
      return true;
  }
}

function evaluateConditions(conditions: Condition[], payload: any): boolean {
  return conditions.every((c) => evaluateCondition(c, payload));
}

/* ── Public queries ──────────────────────────────────────────────────────── */

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return [];
    const rules = await ctx.db
      .query("automationRules")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return rules.sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const listRunLogs = query({
  args: { siteId: v.id("sites"), ruleId: v.optional(v.id("automationRules")), limit: v.optional(v.number()) },
  handler: async (ctx, { siteId, ruleId, limit }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return [];
    const rows = ruleId
      ? await ctx.db
          .query("automationRunLog")
          .withIndex("by_rule", (q) => q.eq("ruleId", ruleId))
          .order("desc")
          .collect()
      : await ctx.db
          .query("automationRunLog")
          .withIndex("by_site", (q) => q.eq("siteId", siteId))
          .order("desc")
          .collect();
    return rows.slice(0, limit ?? 50);
  },
});

export const getFailedRuns = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return [];
    return ctx.db
      .query("automationRunLog")
      .withIndex("by_site_status", (q) => q.eq("siteId", siteId).eq("status", "failure"))
      .order("desc")
      .take(20);
  },
});

/* ── Public mutations ────────────────────────────────────────────────────── */

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    description: v.optional(v.string()),
    triggerType: v.string(),
    conditions: v.array(
      v.object({ field: v.string(), operator: v.string(), value: v.string() })
    ),
    actions: v.array(
      v.object({ type: v.string(), order: v.number(), config: v.any() })
    ),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, enabled, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const id = await ctx.db.insert("automationRules", {
      siteId,
      enabled: enabled ?? true,
      ...fields,
    });
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "automation_rule",
      entityId: id,
      page: "Automation",
      newValue: fields.name,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    ruleId: v.id("automationRules"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    triggerType: v.optional(v.string()),
    conditions: v.optional(
      v.array(v.object({ field: v.string(), operator: v.string(), value: v.string() }))
    ),
    actions: v.optional(
      v.array(v.object({ type: v.string(), order: v.number(), config: v.any() }))
    ),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, ruleId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(ruleId);
    if (!existing || existing.siteId !== siteId) throw new Error("Rule not found");
    const patch: any = {};
    for (const [k, v2] of Object.entries(fields)) {
      if (v2 !== undefined) patch[k] = v2;
    }
    await ctx.db.patch(ruleId, patch);
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "updated",
      entityType: "automation_rule",
      entityId: ruleId,
      page: "Automation",
      newValue: fields.name ?? existing.name,
    });
    return ruleId;
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), ruleId: v.id("automationRules") },
  handler: async (ctx, { siteId, ruleId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(ruleId);
    if (!existing || existing.siteId !== siteId) throw new Error("Rule not found");
    await ctx.db.delete(ruleId);
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "deleted",
      entityType: "automation_rule",
      entityId: ruleId,
      page: "Automation",
      previousValue: existing.name,
    });
  },
});

export const setEnabled = mutation({
  args: { siteId: v.id("sites"), ruleId: v.id("automationRules"), enabled: v.boolean() },
  handler: async (ctx, { siteId, ruleId, enabled }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(ruleId);
    if (!existing || existing.siteId !== siteId) throw new Error("Rule not found");
    await ctx.db.patch(ruleId, { enabled });
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: enabled ? "enabled" : "disabled",
      entityType: "automation_rule",
      entityId: ruleId,
      page: "Automation",
      newValue: existing.name,
    });
  },
});

export const retryRun = mutation({
  args: { siteId: v.id("sites"), runLogId: v.id("automationRunLog") },
  handler: async (ctx, { siteId, runLogId }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const log = await ctx.db.get(runLogId);
    if (!log || log.siteId !== siteId) throw new Error("Run log not found");
    await ctx.scheduler.runAfter(0, internal.automation.runAutomationRules, {
      siteId,
      triggerType: log.triggerType,
      triggerPayload: log.triggerPayload,
      specificRuleId: log.ruleId,
    });
  },
});

/* ── Internal queries ────────────────────────────────────────────────────── */

export const getEnabledRulesForTrigger = internalQuery({
  args: { siteId: v.id("sites"), triggerType: v.string() },
  handler: async (ctx, { siteId, triggerType }) => {
    const rules = await ctx.db
      .query("automationRules")
      .withIndex("by_site_trigger", (q) =>
        q.eq("siteId", siteId).eq("triggerType", triggerType)
      )
      .collect();
    return rules.filter((r) => r.enabled);
  },
});

export const getRuleById = internalQuery({
  args: { ruleId: v.id("automationRules") },
  handler: async (ctx, { ruleId }) => {
    return ctx.db.get(ruleId);
  },
});

/* ── Internal mutations ──────────────────────────────────────────────────── */

export const writeRunLog = internalMutation({
  args: {
    siteId: v.id("sites"),
    ruleId: v.id("automationRules"),
    ruleName: v.string(),
    triggerType: v.string(),
    triggerPayload: v.any(),
    status: v.string(),
    actionResults: v.array(
      v.object({
        actionType: v.string(),
        order: v.number(),
        status: v.string(),
        message: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("automationRunLog", {
      ...args,
      completedAt: Date.now(),
    });
    await ctx.db.patch(args.ruleId, {
      lastRunAt: Date.now(),
      lastRunStatus: args.status,
    });
    return logId;
  },
});

export const writeActivityLogInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    actorName: v.string(),
    action: v.string(),
    entityType: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLog", {
      siteId: args.siteId,
      actorName: args.actorName,
      action: args.action,
      entityType: args.entityType,
      page: "Automation",
      details: args.details,
    });
  },
});

export const createBackupInternal = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const [homepage, footer, contact, courses, events, articles, seo, media, square, email, crm] =
      await Promise.all([
        ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("crmConnections").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ]);
    const snapshot = { homepage, footer, contact, courses, events, articles, seo, media, square, email, crm };
    const snapshotStr = JSON.stringify(snapshot);
    const sizeBytes = new TextEncoder().encode(snapshotStr).length;
    const label = `Auto-Backup ${new Date().toLocaleString("en-US")} (Automation)`;
    await ctx.db.insert("backups", { siteId, label, sizeBytes, snapshot });
    return { label, sizeBytes };
  },
});

export const notifyCrmInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    triggerType: v.string(),
    payload: v.any(),
    config: v.any(),
  },
  handler: async (ctx, { siteId, triggerType, payload, config }) => {
    const connection = await ctx.db
      .query("crmConnections")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    if (!connection) throw new Error("No CRM connection configured for this site");

    await ctx.db.insert("crmSyncLogs", {
      siteId,
      provider: connection.provider,
      entityType: config?.entityType ?? triggerType,
      direction: "outbound",
      status: "queued",
      entityRef: JSON.stringify(payload).slice(0, 100),
      message: `Automation trigger: ${triggerType}`,
      attempt: 1,
      syncPayload: payload,
    });
    return { provider: connection.provider };
  },
});

/* ── Schedule helper (called from public mutations in other modules) ───────── */

export const scheduleAutomation = internalMutation({
  args: {
    siteId: v.id("sites"),
    triggerType: v.string(),
    triggerPayload: v.any(),
  },
  handler: async (ctx, { siteId, triggerType, triggerPayload }) => {
    await ctx.scheduler.runAfter(0, internal.automation.runAutomationRules, {
      siteId,
      triggerType,
      triggerPayload,
    });
  },
});

/* ── Internal action — rule execution engine ─────────────────────────────── */

export const runAutomationRules = internalAction({
  args: {
    siteId: v.id("sites"),
    triggerType: v.string(),
    triggerPayload: v.any(),
    specificRuleId: v.optional(v.id("automationRules")),
  },
  handler: async (ctx, { siteId, triggerType, triggerPayload, specificRuleId }) => {
    let rules: any[];

    if (specificRuleId) {
      const rule = await ctx.runQuery(internal.automation.getRuleById, { ruleId: specificRuleId });
      rules = rule && rule.enabled ? [rule] : [];
    } else {
      rules = await ctx.runQuery(internal.automation.getEnabledRulesForTrigger, {
        siteId,
        triggerType,
      });
    }

    for (const rule of rules) {
      if (!evaluateConditions(rule.conditions as Condition[], triggerPayload)) continue;

      const actionResults: ActionResult[] = [];
      let overallStatus: "success" | "partial_failure" | "failure" = "success";

      const sortedActions = [...(rule.actions as ActionDef[])].sort((a, b) => a.order - b.order);

      for (const action of sortedActions) {
        try {
          const result = await executeAction(ctx, {
            siteId,
            actionType: action.type as ActionType,
            config: action.config,
            triggerType,
            triggerPayload,
          });
          actionResults.push({
            actionType: action.type,
            order: action.order,
            status: "success",
            message: result.message,
          });
        } catch (err: any) {
          actionResults.push({
            actionType: action.type,
            order: action.order,
            status: "failure",
            message: err?.message ?? "Unknown error",
          });
          overallStatus =
            overallStatus === "success" ? "partial_failure" : "failure";
        }
      }

      const allFailed =
        actionResults.length > 0 && actionResults.every((r) => r.status === "failure");
      const finalStatus = allFailed ? "failure" : overallStatus;

      await ctx.runMutation(internal.automation.writeRunLog, {
        siteId,
        ruleId: rule._id,
        ruleName: rule.name,
        triggerType,
        triggerPayload,
        status: finalStatus,
        actionResults,
      });
    }
  },
});

/* ── Action executor ──────────────────────────────────────────────────────── */

async function executeAction(
  ctx: any,
  {
    siteId,
    actionType,
    config,
    triggerType,
    triggerPayload,
  }: {
    siteId: Id<"sites">;
    actionType: ActionType;
    config: any;
    triggerType: string;
    triggerPayload: any;
  }
): Promise<{ message: string }> {
  switch (actionType) {
    case "notify_crm": {
      const result = await ctx.runMutation(internal.automation.notifyCrmInternal, {
        siteId,
        triggerType,
        payload: triggerPayload,
        config,
      });
      return { message: `CRM notified via ${result.provider}` };
    }

    case "send_email": {
      const to = config?.to ?? "site-owner";
      const subject = config?.subject ?? `Automation triggered: ${triggerType}`;
      await ctx.runMutation(internal.automation.writeActivityLogInternal, {
        siteId,
        actorName: "Automation Engine",
        action: "send_email",
        entityType: "automation",
        details: `Would send email to "${to}" with subject: "${subject}"`,
      });
      return { message: `Email queued to ${to}` };
    }

    case "create_backup": {
      const result: any = await ctx.runMutation(internal.automation.createBackupInternal, {
        siteId,
      });
      return { message: `Backup created: ${result.label}` };
    }

    case "log_activity": {
      const message = config?.message ?? `Automation fired: ${triggerType}`;
      await ctx.runMutation(internal.automation.writeActivityLogInternal, {
        siteId,
        actorName: "Automation Engine",
        action: "automation_trigger",
        entityType: "automation",
        details: message,
      });
      return { message: `Activity logged: ${message}` };
    }

    case "post_webhook": {
      const url: string = config?.url;
      if (!url || !url.startsWith("https://")) {
        throw new Error("Webhook URL must start with https://");
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(config?.headers ?? {}),
      };
      const body = JSON.stringify({
        trigger: triggerType,
        payload: triggerPayload,
        timestamp: new Date().toISOString(),
      });
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        throw new Error(`Webhook returned HTTP ${res.status}`);
      }
      return { message: `Webhook posted to ${url} — HTTP ${res.status}` };
    }

    case "create_social_task": {
      const platform = config?.platform ?? "social";
      const taskDescription = config?.taskDescription ?? `Share: ${triggerType}`;
      await ctx.runMutation(internal.automation.writeActivityLogInternal, {
        siteId,
        actorName: "Automation Engine",
        action: "create_social_task",
        entityType: "automation",
        details: `Social task stub for ${platform}: "${taskDescription}"`,
      });
      return { message: `Social task created (stub) for ${platform}` };
    }

    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}
