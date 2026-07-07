import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { encryptField } from "./lib/encrypt";

function toConnectionResponse(doc: any) {
  const { apiKeyEncrypted: _redacted, ...safe } = doc;
  return {
    ...safe,
    id: doc._id,
    siteId: doc.siteId,
    hasApiKey: Boolean(doc.apiKeyEncrypted),
    apiKeyLast4: doc.apiKeyLast4 ?? null,
    updatedAt: new Date(doc._creationTime).toISOString(),
    lastHealthCheckAt: doc.lastHealthCheckAt ? new Date(doc.lastHealthCheckAt).toISOString() : null,
    lastSyncAt: doc.lastSyncAt ? new Date(doc.lastSyncAt).toISOString() : null,
  };
}

function toEntitySettingResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, updatedAt: new Date(doc._creationTime).toISOString() };
}

function toSyncLogResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString() };
}

const DEFAULT_ENTITY_TYPES = [
  "contact_form", "quote_request", "consultation", "event_registration",
  "course_registration", "order", "customer", "payment", "newsletter_signup",
  "application", "custom_form",
] as const;
const INBOUND_ENTITY_TYPES = [
  "appointment_status", "notes", "campaign_status", "lead_status", "tags", "profile_update",
] as const;

export const getConnection = query({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId, provider = "operon" }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    if (!doc) return null;
    return toConnectionResponse(doc);
  },
});

export const updateConnection = mutation({
  args: {
    siteId: v.id("sites"),
    provider: v.optional(v.string()),
    status: v.optional(v.string()),
    authMethod: v.optional(v.string()),
    accountName: v.optional(v.string()),
    orgId: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    ssoEnabled: v.optional(v.boolean()),
    apiHealth: v.optional(v.string()),
    lastHealthCheckAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, provider = "operon", apiKey, ...rest }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();

    const patch: Record<string, unknown> = { ...rest };
    if (apiKey) {
      patch.apiKeyEncrypted = await encryptField(apiKey);
      patch.apiKeyLast4 = apiKey.slice(-4);
    }

    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("crmConnections", {
        siteId,
        provider,
        status: (rest.status as string) ?? "not_connected",
        authMethod: (rest.authMethod as string) ?? "api_key",
        ssoEnabled: (rest.ssoEnabled as boolean) ?? false,
        apiHealth: (rest.apiHealth as string) ?? "unknown",
        ...patch,
      });
    }
    return toConnectionResponse((await ctx.db.get(docId))!);
  },
});

export const disconnectConnection = mutation({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId, provider = "operon" }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "not_connected", apiKeyEncrypted: undefined, apiKeyLast4: undefined, accountName: undefined, orgId: undefined });
    }
    return { success: true };
  },
});

export const testConnection = mutation({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId, provider = "operon" }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    const isConnected = existing?.status === "connected";
    const apiHealth = isConnected ? "healthy" : "unreachable";
    const status = isConnected ? "connected" : "not_connected";
    if (existing) {
      await ctx.db.patch(existing._id, { apiHealth, lastHealthCheckAt: Date.now() });
    }
    return { status, apiHealth, testedAt: new Date().toISOString() };
  },
});

export const launchSso = mutation({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId, provider = "operon" }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    const ssoEnabled = existing?.ssoEnabled ?? false;
    if (!ssoEnabled) {
      return { available: false, reason: "SSO is not enabled for this connection. Enable it in the connection settings first." };
    }
    const launchUrl = `https://app.operoncrm.com/sso?site=${siteId}&provider=${provider}`;
    return { available: true, launchUrl };
  },
});

export const listEntitySettings = query({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId, provider = "operon" }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const existing = await ctx.db.query("crmEntitySyncSettings").withIndex("by_site_provider_entity", (q) => q.eq("siteId", siteId).eq("provider", provider)).collect();

    const existingKeys = new Set(existing.map((e) => `${e.entityType}:${e.direction}`));
    const defaults: any[] = [];
    for (const et of DEFAULT_ENTITY_TYPES) {
      if (!existingKeys.has(`${et}:outbound`)) {
        defaults.push({ siteId, provider, entityType: et, direction: "outbound", enabled: false });
      }
    }
    for (const et of INBOUND_ENTITY_TYPES) {
      if (!existingKeys.has(`${et}:inbound`)) {
        defaults.push({ siteId, provider, entityType: et, direction: "inbound", enabled: false });
      }
    }
    return [...existing.map(toEntitySettingResponse), ...defaults.map((d) => ({ ...d, id: `default:${d.entityType}:${d.direction}`, updatedAt: new Date().toISOString() }))];
  },
});

export const updateEntitySetting = mutation({
  args: {
    siteId: v.id("sites"),
    provider: v.optional(v.string()),
    entityType: v.string(),
    direction: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { siteId, provider = "operon", entityType, direction, enabled }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.query("crmEntitySyncSettings").withIndex("by_site_provider_entity", (q) => q.eq("siteId", siteId).eq("provider", provider).eq("entityType", entityType).eq("direction", direction)).first();
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, { enabled });
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("crmEntitySyncSettings", { siteId, provider, entityType, direction, enabled });
    }
    return toEntitySettingResponse((await ctx.db.get(docId))!);
  },
});

export const listSyncLogs = query({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db.query("crmSyncLogs").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(100);
    return docs.map(toSyncLogResponse);
  },
});

export const retrySyncLog = mutation({
  args: { siteId: v.id("sites"), syncLogId: v.id("crmSyncLogs") },
  handler: async (ctx, { siteId, syncLogId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(syncLogId);
    if (!existing) throw new Error("Sync log not found");
    if (existing.siteId !== siteId) throw new Error("Forbidden");
    await ctx.db.patch(syncLogId, { status: "pending", attempt: existing.attempt + 1 });
    return toSyncLogResponse((await ctx.db.get(syncLogId))!);
  },
});
