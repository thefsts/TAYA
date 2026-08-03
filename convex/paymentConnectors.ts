/**
 * WOS Phase 1 — Payment Connector Framework™
 *
 * Convex functions for the provider-agnostic payment connector system.
 * Credentials are encrypted at rest via AES-256-GCM; raw secrets never
 * leave the server.
 */

import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { provisionUser } from "./lib/getCurrentUser";
import { logActivity } from "./lib/logActivity";

/* ── Encryption helpers (AES-256-GCM) ──────────────────────────────────── */

const ENC_KEY_ENV = "PAYMENT_ENCRYPTION_KEY";

async function deriveKey(rawKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(rawKey.padEnd(32, "0").slice(0, 32)), "AES-GCM", false, ["encrypt", "decrypt"]);
  return keyMaterial;
}

async function encryptCredentials(plaintext: string): Promise<string | null> {
  const rawKey = process.env[ENC_KEY_ENV];
  if (!rawKey) return null;
  const key = await deriveKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
  return `${ivB64}:${cipherB64}`;
}

async function decryptCredentials(ciphertext: string): Promise<string | null> {
  const rawKey = process.env[ENC_KEY_ENV];
  if (!rawKey) return null;
  try {
    const [ivB64, cipherB64] = ciphertext.split(":");
    if (!ivB64 || !cipherB64) return null;
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const cipherBytes = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
    const key = await deriveKey(rawKey);
    const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
    return new TextDecoder().decode(plainBuffer);
  } catch {
    return null;
  }
}

/* ── Safe record projection (never return raw credentials) ──────────────── */

function toSafeRecord(doc: any) {
  const { credentialsCiphertext: _c, ...rest } = doc;
  return {
    ...rest,
    id: doc._id,
    createdAt: new Date(doc._creationTime).toISOString(),
    updatedAt: new Date(doc._creationTime).toISOString(),
  };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export const listConnectors = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db.query("paymentConnectors").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return docs.map(toSafeRecord);
  },
});

export const getActiveConnector = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db.query("paymentConnectors").withIndex("by_site_active", (q) => q.eq("siteId", siteId).eq("isActive", true)).first();
    if (!doc) return null;
    return toSafeRecord(doc);
  },
});

export const getConnectorByProvider = query({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db.query("paymentConnectors").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    if (!doc) return null;
    return toSafeRecord(doc);
  },
});

export const listPaymentEvents = query({
  args: { siteId: v.id("sites"), limit: v.optional(v.number()) },
  handler: async (ctx, { siteId, limit = 50 }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return ctx.db.query("paymentEvents").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(limit);
  },
});

/* ── Internal queries ───────────────────────────────────────────────────── */

export const getConnectorInternal = internalQuery({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    return ctx.db.query("paymentConnectors").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
  },
});

export const getActiveConnectorInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db.query("paymentConnectors").withIndex("by_site_active", (q) => q.eq("siteId", siteId).eq("isActive", true)).first();
  },
});

/* ── Internal mutations ─────────────────────────────────────────────────── */

export const upsertConnectorInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    status: v.string(),
    isActive: v.optional(v.boolean()),
    environment: v.optional(v.string()),
    credentialsCiphertext: v.optional(v.string()),
    credentialsMeta: v.optional(v.any()),
    hasWebhookKey: v.optional(v.boolean()),
    checkoutEnabled: v.optional(v.boolean()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, provider, isActive, ...fields }) => {
    const existing = await ctx.db.query("paymentConnectors").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    if (existing) {
      const patch: Record<string, unknown> = { ...fields };
      if (isActive !== undefined) patch.isActive = isActive;
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return ctx.db.insert("paymentConnectors", {
      siteId,
      provider,
      isActive: isActive ?? false,
      hasWebhookKey: false,
      checkoutEnabled: false,
      ...fields,
    });
  },
});

export const updateHealthInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    healthStatus: v.string(),
    healthMessage: v.optional(v.string()),
    lastHealthCheckAt: v.number(),
  },
  handler: async (ctx, { siteId, provider, ...fields }) => {
    const doc = await ctx.db.query("paymentConnectors").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    if (doc) await ctx.db.patch(doc._id, fields);
  },
});

export const logPaymentEventInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    eventType: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    status: v.string(),
    amountCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    metadata: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("paymentEvents", args);
  },
});

/* ── Mutations ──────────────────────────────────────────────────────────── */

/**
 * Creates a placeholder (unconfigured) payment connector record for a newly
 * provisioned site. Call this from the onboarding wizard when the admin
 * selects a provider but hasn't yet configured credentials.
 * Super-admin only (checked via sites.get access pattern).
 */
export const provisionConnector = mutation({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: super-admin only");
    const existing = await ctx.db
      .query("paymentConnectors")
      .withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider))
      .first();
    if (existing) return { success: true, connectorId: existing._id };
    const connectorId = await ctx.db.insert("paymentConnectors", {
      siteId,
      provider,
      status: "pending",
      isActive: false,
      checkoutEnabled: false,
      hasWebhookKey: false,
      healthStatus: "unchecked",
      environment: "sandbox",
    } as any);
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "provisioned",
      entityType: "payment_connector",
      page: "onboarding",
      newValue: { provider },
      details: `Provisioned ${provider} connector during site onboarding (credentials required)`,
    });
    return { success: true, connectorId };
  },
});

export const setActiveConnector = mutation({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const allDocs = await ctx.db.query("paymentConnectors").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    for (const doc of allDocs) {
      await ctx.db.patch(doc._id, { isActive: doc.provider === provider });
    }
    await logActivity(ctx, { siteId, actorName: user.name, action: "activated", entityType: "payment_connector", page: "Payment Providers", newValue: { provider } });
    return { success: true };
  },
});

export const disconnectConnector = mutation({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const doc = await ctx.db.query("paymentConnectors").withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider)).first();
    if (doc) {
      await ctx.db.patch(doc._id, {
        status: "disconnected",
        isActive: false,
        credentialsCiphertext: undefined,
        credentialsMeta: undefined,
        hasWebhookKey: false,
        healthStatus: "unchecked",
        healthMessage: undefined,
      });
    }
    await logActivity(ctx, { siteId, actorName: user.name, action: "disconnected", entityType: "payment_connector", page: "Payment Providers", previousValue: { provider } });
    return { success: true };
  },
});

export const logPaymentEvent = mutation({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    eventType: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    status: v.string(),
    amountCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    metadata: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!await checkSiteAccess(ctx, args.siteId)) throw new Error("Forbidden");
    return ctx.db.insert("paymentEvents", { ...args, retryCount: 0 });
  },
});

/* ── Actions ────────────────────────────────────────────────────────────── */

/** Save connector credentials (encrypted at rest). Never returns raw secrets.
 *
 *  Pass empty string for any secret field to keep the previously stored value.
 *  The active/inactive state of an existing connector is always preserved.
 */
export const saveConnectorCredentials = action({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    environment: v.optional(v.string()),
    credentials: v.any(),
    checkoutEnabled: v.optional(v.boolean()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, provider, environment, credentials, checkoutEnabled, settings }) => {
    const allowed: boolean = await ctx.runQuery(internal.square.checkSiteAccessForAction, { siteId });
    if (!allowed) throw new Error("Forbidden: site access required");

    // Merge with existing stored credentials so blank/omitted fields are preserved.
    let merged: Record<string, unknown> = { ...(credentials ?? {}) };
    const existing = await ctx.runQuery(internal.paymentConnectors.getConnectorInternal, { siteId, provider });
    if (existing?.credentialsCiphertext) {
      const prevDecrypted = await decryptCredentials(existing.credentialsCiphertext);
      if (prevDecrypted) {
        try {
          const prev: Record<string, unknown> = JSON.parse(prevDecrypted);
          for (const [key, val] of Object.entries(prev)) {
            const incoming = credentials?.[key];
            if (incoming === "" || incoming === null || incoming === undefined) {
              merged[key] = val;
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }

    const plaintext = JSON.stringify(merged);
    const ciphertext = await encryptCredentials(plaintext);

    const meta = buildCredentialMeta(provider, merged);
    const hasWebhookKey = Boolean(
      merged?.webhookSignatureKey || merged?.webhookSecret || merged?.webhookId || merged?.signatureKey
    );

    const connected = isCredentialComplete(provider, merged);
    const status = connected ? "connected" : "disconnected";

    await ctx.runMutation(internal.paymentConnectors.upsertConnectorInternal, {
      siteId,
      provider,
      status,
      environment: environment ?? existing?.environment ?? "sandbox",
      credentialsCiphertext: ciphertext ?? undefined,
      credentialsMeta: meta,
      hasWebhookKey,
      checkoutEnabled: checkoutEnabled ?? existing?.checkoutEnabled ?? false,
      settings: settings ?? existing?.settings ?? {},
    });

    await ctx.runMutation(internal.paymentConnectors.logPaymentEventInternal, {
      siteId,
      provider,
      eventType: "connector.configured",
      status: "success",
      metadata: { meta },
    });

    return { success: true, status, hasEncryption: Boolean(ciphertext) };
  },
});

type TestConnectionResult = { ok: boolean; latencyMs?: number; message?: string };

/** Test-connection action — calls provider health-check and writes result.
 *
 *  Reads credentials exclusively from paymentConnectors (decrypted at runtime).
 *  Falls back to the legacy squareConfig table only when no paymentConnectors
 *  record exists yet, to ease migration from the old Square-only setup.
 */
export const testConnection = action({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }): Promise<TestConnectionResult> => {
    const allowed: boolean = await ctx.runQuery(internal.square.checkSiteAccessForAction, { siteId });
    if (!allowed) throw new Error("Forbidden: site access required");

    if (provider === "square") {
      // Prefer paymentConnectors encrypted credentials; fall back to legacy squareConfig.
      let accessToken: string | undefined;
      let environment: string = "sandbox";

      const decryptedCreds: any = await ctx.runAction(
        internal.paymentConnectors.getDecryptedCredentials, { siteId, provider }
      );
      if (decryptedCreds?.accessToken) {
        accessToken = decryptedCreds.accessToken;
        environment = decryptedCreds.environment ?? "sandbox";
      } else {
        const squareCfg: any = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
        accessToken = squareCfg?.accessToken;
        environment = squareCfg?.environment ?? "sandbox";
      }

      if (!accessToken) {
        return { ok: false, message: "Square credentials not configured. Save credentials first." };
      }

      const baseUrl: string = environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";
      const start = Date.now();
      try {
        const res: Response = await fetch(`${baseUrl}/v2/locations`, {
          headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2024-01-17" },
        });
        const latencyMs: number = Date.now() - start;
        if (res.ok) {
          const data: any = await res.json();
          const locationCount: number = (data.locations ?? []).length;
          await ctx.runMutation(internal.paymentConnectors.updateHealthInternal, {
            siteId, provider,
            healthStatus: "ok",
            healthMessage: `Connected. ${locationCount} location(s) found.`,
            lastHealthCheckAt: Date.now(),
          });
          await ctx.runMutation(internal.paymentConnectors.logPaymentEventInternal, {
            siteId, provider, eventType: "health_check", status: "success",
            metadata: { latencyMs, locationCount },
          });
          return { ok: true, latencyMs, message: `Connected. ${locationCount} location(s) found.` };
        } else {
          const errorText: string = await res.text();
          await ctx.runMutation(internal.paymentConnectors.updateHealthInternal, {
            siteId, provider,
            healthStatus: "error",
            healthMessage: `API error ${res.status}`,
            lastHealthCheckAt: Date.now(),
          });
          return { ok: false, message: `Square API error ${res.status}: ${errorText.slice(0, 200)}` };
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await ctx.runMutation(internal.paymentConnectors.updateHealthInternal, {
          siteId, provider,
          healthStatus: "error",
          healthMessage: message,
          lastHealthCheckAt: Date.now(),
        });
        return { ok: false, message };
      }
    }

    return { ok: false, message: `${provider} integration is coming soon.` };
  },
});

/** Retrieve decrypted credentials for server-side use only (internal). */
export const getDecryptedCredentials = internalAction({
  args: { siteId: v.id("sites"), provider: v.string() },
  handler: async (ctx, { siteId, provider }) => {
    const doc = await ctx.runQuery(internal.paymentConnectors.getConnectorInternal, { siteId, provider });
    if (!doc?.credentialsCiphertext) return null;
    const plain = await decryptCredentials(doc.credentialsCiphertext);
    if (!plain) return null;
    try { return JSON.parse(plain); } catch { return null; }
  },
});

/* ── Credential helpers ─────────────────────────────────────────────────── */

function isCredentialComplete(provider: string, creds: any): boolean {
  switch (provider) {
    case "square": return Boolean(creds?.applicationId && creds?.accessToken && creds?.locationId);
    case "stripe": return Boolean(creds?.secretKey && creds?.publishableKey);
    case "paypal": return Boolean(creds?.clientId && creds?.clientSecret);
    case "authorize_net": return Boolean(creds?.apiLoginId && creds?.transactionKey);
    case "clover": return Boolean(creds?.merchantId && creds?.apiKey);
    case "manual_invoice": return true;
    case "bank_transfer": return true;
    default: return false;
  }
}

function buildCredentialMeta(provider: string, creds: any): Record<string, unknown> {
  switch (provider) {
    case "square":
      return {
        applicationIdLast4: creds?.applicationId ? String(creds.applicationId).slice(-4) : null,
        locationId: creds?.locationId ?? null,
        hasAccessToken: Boolean(creds?.accessToken),
      };
    case "stripe":
      return {
        publishableKey: creds?.publishableKey ?? null,
        secretKeyLast4: creds?.secretKey ? String(creds.secretKey).slice(-4) : null,
      };
    case "paypal":
      return { clientId: creds?.clientId ?? null };
    case "authorize_net":
      return { apiLoginId: creds?.apiLoginId ?? null };
    case "clover":
      return { merchantId: creds?.merchantId ?? null };
    default:
      return {};
  }
}
