import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, requireSiteAccessMutation, requireDesignCapability } from "./lib/requireSiteAccess";
import { encryptField } from "./lib/encrypt";
import { getProvider } from "./lib/crmProviders";

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
  return {
    ...doc,
    id: doc._id,
    siteId: doc.siteId,
    updatedAt: new Date(doc._creationTime).toISOString(),
    lastSyncAt: doc.lastSyncAt ?? null,
    lastSyncStatus: doc.lastSyncStatus ?? null,
  };
}

function toSyncLogResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString() };
}

// ── Entity type registries ────────────────────────────────────────────────────

const OUTBOUND_ENTITY_TYPES = [
  "form_submission", "course_enrollment", "membership_signup", "payment_completed",
] as const;

const INBOUND_ENTITY_TYPES = [
  "appointment_status", "lead_status", "contact_tags",
] as const;

// ── Connection management ─────────────────────────────────────────────────────

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
    await requireDesignCapability(ctx, siteId);
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
    await requireDesignCapability(ctx, siteId);
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
    await requireDesignCapability(ctx, siteId);
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
    await requireDesignCapability(ctx, siteId);
    const existing = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    const ssoEnabled = existing?.ssoEnabled ?? false;
    if (!ssoEnabled) {
      return { available: false, reason: "SSO is not enabled for this connection. Enable it in the connection settings first." };
    }
    const launchUrl = `https://app.operoncrm.com/sso?site=${siteId}&provider=${provider}`;
    return { available: true, launchUrl };
  },
});

// ── Entity sync settings ──────────────────────────────────────────────────────

export const listEntitySettings = query({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId, provider = "operon" }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const existing = await ctx.db.query("crmEntitySyncSettings").withIndex("by_site_provider_entity", (q) => q.eq("siteId", siteId).eq("provider", provider)).collect();

    const existingKeys = new Set(existing.map((e) => `${e.entityType}:${e.direction}`));
    const defaults: any[] = [];
    for (const et of OUTBOUND_ENTITY_TYPES) {
      if (!existingKeys.has(`${et}:outbound`)) {
        defaults.push({ siteId, provider, entityType: et, direction: "outbound", enabled: false, lastSyncAt: null, lastSyncStatus: null });
      }
    }
    for (const et of INBOUND_ENTITY_TYPES) {
      if (!existingKeys.has(`${et}:inbound`)) {
        defaults.push({ siteId, provider, entityType: et, direction: "inbound", enabled: false, lastSyncAt: null, lastSyncStatus: null });
      }
    }
    return [
      ...existing.map(toEntitySettingResponse),
      ...defaults.map((d) => ({ ...d, id: `default:${d.entityType}:${d.direction}`, updatedAt: new Date().toISOString() })),
    ];
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

// ── Sync log management ───────────────────────────────────────────────────────

export const listSyncLogs = query({
  args: {
    siteId: v.id("sites"),
    provider: v.optional(v.string()),
    entityType: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, entityType, status, limit = 100 }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];

    let docs: any[];
    if (entityType) {
      docs = await ctx.db.query("crmSyncLogs").withIndex("by_site_entity", (q) => q.eq("siteId", siteId).eq("entityType", entityType)).order("desc").take(limit);
    } else if (status) {
      docs = await ctx.db.query("crmSyncLogs").withIndex("by_site_status", (q) => q.eq("siteId", siteId).eq("status", status)).order("desc").take(limit);
    } else {
      docs = await ctx.db.query("crmSyncLogs").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(limit);
    }

    if (status && entityType) {
      docs = docs.filter((d) => d.status === status);
    }

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

    const conn = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", existing.provider)).first();
    if (conn?.status === "connected") {
      await ctx.scheduler.runAfter(0, internal.crm.dispatchSyncAction, {
        syncLogId: syncLogId.toString(),
        provider: existing.provider,
        apiKeyEncrypted: conn.apiKeyEncrypted ?? null,
        orgId: conn.orgId ?? null,
        entityType: existing.entityType,
        direction: existing.direction,
        payload: existing.syncPayload ?? null,
      });
    }

    return toSyncLogResponse((await ctx.db.get(syncLogId))!);
  },
});

// ── Health stats (for Health Monitor card) ────────────────────────────────────

export const getSyncStats = query({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const conn = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", "operon")).first();
    if (!conn) return null;

    const recentLogs = await ctx.db.query("crmSyncLogs").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(50);
    const successCount = recentLogs.filter((l) => l.status === "success").length;
    const failedCount = recentLogs.filter((l) => l.status === "failed").length;
    const pendingCount = recentLogs.filter((l) => l.status === "pending").length;

    return {
      connectionStatus: conn.status,
      apiHealth: conn.apiHealth,
      lastHealthCheckAt: conn.lastHealthCheckAt ? new Date(conn.lastHealthCheckAt).toISOString() : null,
      lastSyncAt: conn.lastSyncAt ? new Date(conn.lastSyncAt).toISOString() : null,
      recentSuccessCount: successCount,
      recentFailedCount: failedCount,
      recentPendingCount: pendingCount,
      totalRecentLogs: recentLogs.length,
    };
  },
});

// ── Internal: create a sync log entry ────────────────────────────────────────

export const createSyncLog = internalMutation({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    entityType: v.string(),
    direction: v.string(),
    entityRef: v.optional(v.string()),
    message: v.optional(v.string()),
    syncPayload: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, provider, entityType, direction, entityRef, message, syncPayload }) => {
    const id = await ctx.db.insert("crmSyncLogs", {
      siteId,
      provider,
      entityType,
      direction,
      status: "pending",
      entityRef,
      message,
      attempt: 1,
      syncPayload,
    });
    return id.toString();
  },
});

export const updateSyncLog = internalMutation({
  args: {
    syncLogId: v.string(),
    status: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { syncLogId, status, message }) => {
    try {
      const doc = await ctx.db.get(syncLogId as any) as any;
      if (doc) {
        await ctx.db.patch(syncLogId as any, { status, ...(message !== undefined ? { message } : {}) });

        // Also update the entity sync setting's lastSyncAt/lastSyncStatus
        const setting = await ctx.db.query("crmEntitySyncSettings")
          .withIndex("by_site_provider_entity", (q) =>
            q.eq("siteId", doc.siteId)
              .eq("provider", doc.provider)
              .eq("entityType", doc.entityType)
              .eq("direction", doc.direction),
          ).first();
        if (setting) {
          await ctx.db.patch(setting._id, { lastSyncAt: Date.now(), lastSyncStatus: status });
        }
      }
    } catch {
      // ignore
    }
  },
});

// ── Internal: syncToCrm action ────────────────────────────────────────────────

export const syncToCrm = internalAction({
  args: {
    siteId: v.id("sites"),
    provider: v.optional(v.string()),
    entityType: v.string(),
    direction: v.string(),
    entityRef: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, { siteId, provider = "operon", entityType, direction, entityRef, payload }) => {
    const conn = await ctx.runQuery(internal.crm.getConnectionInternal, { siteId, provider });
    if (!conn || conn.status !== "connected") return;

    const setting = await ctx.runQuery(internal.crm.getEntitySettingInternal, { siteId, provider, entityType, direction });
    if (!setting || !setting.enabled) return;

    const syncLogId = await ctx.runMutation(internal.crm.createSyncLog, {
      siteId,
      provider,
      entityType,
      direction,
      entityRef,
      message: `Auto-triggered ${entityType} ${direction} sync`,
      syncPayload: payload,
    });

    await ctx.runMutation(internal.crm.updateConnectionLastSync, { siteId, provider });

    await ctx.runAction(internal.crm.dispatchSyncAction, {
      syncLogId,
      provider,
      apiKeyEncrypted: conn.apiKeyEncrypted ?? null,
      orgId: conn.orgId ?? null,
      entityType,
      direction,
      payload,
    });
  },
});

// ── Internal: dispatch to CRM API (provider-agnostic) ────────────────────────

export const dispatchSyncAction = internalAction({
  args: {
    syncLogId: v.string(),
    provider: v.optional(v.string()),
    apiKeyEncrypted: v.union(v.string(), v.null()),
    orgId: v.union(v.string(), v.null()),
    entityType: v.string(),
    direction: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { syncLogId, provider = "operon", apiKeyEncrypted, orgId, entityType, direction, payload } = args;

    async function markLog(status: string, message: string) {
      await ctx.runMutation(internal.crm.updateSyncLog, { syncLogId, status, message });
    }

    if (!apiKeyEncrypted) {
      await markLog("failed", "No API key stored — connect this CRM in site settings first.");
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

    // Resolve provider config from registry
    const providerConfig = getProvider(provider);
    const endpointPath = providerConfig?.endpointMap[entityType] ?? "events";
    const apiBase = providerConfig?.apiBase ?? "https://api.operoncrm.com/v1";

    const body = {
      source: "fsts_dashboard",
      entity_type: entityType,
      direction,
      org_id: orgId,
      ...((payload && typeof payload === "object") ? payload : { data: payload }),
    };

    try {
      const res = await fetch(`${apiBase}/${endpointPath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const resBody = await res.json().catch(() => ({})) as any;
        await markLog("success", `${provider} ${endpointPath} synced (id: ${resBody.id ?? resBody.record_id ?? "ok"})`);
      } else {
        const detail = await res.text();
        await markLog("failed", `${provider} API ${res.status}: ${detail.slice(0, 200)}`);
      }
    } catch (err) {
      await markLog("failed", `Network error: ${err}`);
    }
  },
});

// ── Internal: inbound sync polling ───────────────────────────────────────────

export const pollAllSitesInbound = internalAction({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.runQuery(internal.crm.listConnectedSites, {});
    for (const conn of connections) {
      await ctx.runAction(internal.crm.pollInboundSync, {
        siteId: conn.siteId,
        provider: conn.provider,
      });
    }
  },
});

export const pollInboundSync = internalAction({
  args: { siteId: v.id("sites"), provider: v.optional(v.string()) },
  handler: async (ctx, { siteId, provider = "operon" }) => {
    const conn = await ctx.runQuery(internal.crm.getConnectionInternal, { siteId, provider });
    if (!conn || conn.status !== "connected" || !conn.apiKeyEncrypted) return;

    let apiKey: string;
    try {
      const { decryptField } = await import("./lib/encrypt");
      apiKey = await decryptField(conn.apiKeyEncrypted);
    } catch {
      return;
    }

    // Use provider registry to determine which inbound types to poll
    const providerConfig = getProvider(provider);
    const inboundTypes = providerConfig?.inboundTypes ?? ["appointment_status", "lead_status", "tags"];
    const inboundBase = providerConfig?.inboundBase ?? "https://api.operoncrm.com/v1/inbound";

    for (const entityType of inboundTypes) {
      const setting = await ctx.runQuery(internal.crm.getEntitySettingInternal, {
        siteId,
        provider,
        entityType,
        direction: "inbound",
      });
      if (!setting?.enabled) continue;

      const syncLogId = await ctx.runMutation(internal.crm.createSyncLog, {
        siteId,
        provider,
        entityType,
        direction: "inbound",
        message: `Scheduled inbound poll for ${entityType}`,
      });

      try {
        const res = await fetch(`${inboundBase}/${entityType}?org_id=${conn.orgId ?? ""}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({})) as any;
          const records: any[] = Array.isArray(data.records) ? data.records : [];

          // Write each inbound record back to the relevant site-side record
          for (const record of records) {
            await ctx.runMutation(internal.crm.applyInboundRecord, {
              siteId,
              provider,
              entityType,
              crmRecordId: record.id ?? record.record_id ?? null,
              entityRef: record.entity_ref ?? null,
              payload: record,
            });
          }

          await ctx.runMutation(internal.crm.updateSyncLog, {
            syncLogId,
            status: "success",
            message: `Inbound poll complete — ${records.length} record(s) applied`,
          });
          await ctx.runMutation(internal.crm.updateConnectionLastSync, { siteId, provider });
        } else {
          const detail = await res.text();
          await ctx.runMutation(internal.crm.updateSyncLog, {
            syncLogId,
            status: "failed",
            message: `${provider} inbound ${res.status}: ${detail.slice(0, 150)}`,
          });
        }
      } catch (err) {
        await ctx.runMutation(internal.crm.updateSyncLog, {
          syncLogId,
          status: "failed",
          message: `Network error during inbound poll: ${err}`,
        });
      }
    }
  },
});

// ── Internal helper queries ───────────────────────────────────────────────────

export const getConnectionInternal = internalQuery({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    const doc = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    return doc ?? null;
  },
});

export const getEntitySettingInternal = internalQuery({
  args: { siteId: v.id("sites"), provider: v.string(), entityType: v.string(), direction: v.string() },
  handler: async (ctx, { siteId, provider, entityType, direction }) => {
    return await ctx.db.query("crmEntitySyncSettings").withIndex("by_site_provider_entity", (q) => q.eq("siteId", siteId).eq("provider", provider).eq("entityType", entityType).eq("direction", direction)).first() ?? null;
  },
});

export const listConnectedSites = internalQuery({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db.query("crmConnections").collect();
    return connections.filter((c) => c.status === "connected").map((c) => ({ siteId: c.siteId, provider: c.provider }));
  },
});

export const updateConnectionLastSync = internalMutation({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    const conn = await ctx.db.query("crmConnections").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    if (conn) {
      await ctx.db.patch(conn._id, { lastSyncAt: Date.now() });
    }
  },
});

// ── Internal: apply an inbound CRM record back to the site ───────────────────
//
// Writes inbound data to the appropriate site-side table:
//   lead_status    → updates the matching formSubmission status (matched by email in payload)
//   appointment_status / tags / other → stored in crmInboundRecords for audit + future use

export const applyInboundRecord = internalMutation({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    entityType: v.string(),
    crmRecordId: v.union(v.string(), v.null()),
    entityRef: v.union(v.string(), v.null()),
    payload: v.any(),
  },
  handler: async (ctx, { siteId, provider, entityType, crmRecordId, entityRef, payload }) => {
    // For lead_status: find the matching formSubmission by email and update crmStatus
    if (entityType === "lead_status" && payload?.email) {
      const submission = await ctx.db
        .query("formSubmissions")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .filter((q) => q.eq(q.field("submitterEmail"), payload.email))
        .first();
      if (submission) {
        // Store CRM lead status alongside the submission data
        const mergedData = { ...(submission.data ?? {}), crmLeadStatus: payload.status ?? payload.lead_status };
        await ctx.db.patch(submission._id, { data: mergedData });
      }
    }

    // Store the full inbound record in crmInboundRecords for audit trail / future use
    await ctx.db.insert("crmInboundRecords", {
      siteId,
      provider,
      entityType,
      crmRecordId: crmRecordId ?? undefined,
      entityRef: entityRef ?? undefined,
      payload,
      appliedAt: Date.now(),
    });
  },
});
