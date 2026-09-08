/**
 * PHASE 2 PR-2 — Ownership verification state machine (spec §15–§16).
 *
 * A DISCOVERED_EXTERNAL site can draft and preview, but PUBLISH is
 * server-blocked until the domain owner proves control of the domain they
 * claimed at onboarding. This module is that proof system:
 *
 *   beginVerification (action)  — a site owner picks a self-serve method;
 *       TAYA mints a token, writes state=verification_pending + method +
 *       token + beganAt, and returns exact instructions. Re-beginning mints
 *       a fresh token and resets attempts.
 *   checkVerification (action)  — the LIVE network check (DNS TXT via
 *       DNS-over-HTTPS, HTML meta-tag scan, or bridge verify ping) using
 *       the pure primitives in lib/ownershipChecks. Success flips
 *       ownershipVerification.state → "verified", records evidence, and
 *       promotes connectionMode to TAYA_CONNECTED (§6 — bridge-verified
 *       external site: full edit + publish). Failure records the §14
 *       explicit reason; attempts increment; state stays pending.
 *   approveConnector (mutation) — SUPERADMIN-only: approve repo_connector /
 *       platform_api (§15 "approved repository connector" and "site-platform
 *       API authorization" — operator-trust methods, never network checks).
 *   resetVerification (mutation) — SUPERADMIN-only: return a site to
 *       unverified (domain changed hands / verification redone). Drops the
 *       connectionMode back to DISCOVERED_EXTERNAL.
 *   getStatus (query)           — the site-scoped status + evidence log.
 *
 * SINGLE WRITER DISCIPLINE: only _applyVerificationResult /
 * _beginVerification / approveConnector / resetVerification write
 * sites.ownershipVerification — all server-side. No dashboard UI and no
 * client-supplied value can flip a site to verified. The publishing gate
 * (publishing.ts) reads sites.ownershipVerification.state, never anything
 * the client sends.
 *
 * TENANT ISOLATION (§22):
 *   - begin/check/getStatus verify site access through the same internal
 *     access-check query as discovery (never unverified client-supplied
 *     IDs). Cross-tenant users get Forbidden.
 *   - approveConnector/resetVerification are SUPERADMIN-only.
 *   - Verification state lives on the site row — it cannot leak across
 *     sites, and evidence rows are site-scoped reads.
 */

import { query, action, internalMutation, internalQuery, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  generateVerificationToken,
  runSelfServeCheck,
  type VerificationMethod,
} from "./lib/ownershipChecks";
import { logActivity } from "./lib/logActivity";
import { provisionUser } from "./lib/getCurrentUser";
import { checkSiteAccess } from "./lib/requireSiteAccess";

// ─────────────────────────────────────────────────────────────────────────────
// Shared state helpers
// ─────────────────────────────────────────────────────────────────────────────

/** The three ownership states (sites.ownershipVerification.state). */
export const OWNERSHIP_STATES = ["unverified", "verification_pending", "verified"] as const;
export type OwnershipState = (typeof OWNERSHIP_STATES)[number];

/** All five methods (§15 approved set). */
export const OWNERSHIP_METHODS = [
  "dns_txt",
  "html_meta_token",
  "bridge_token",
  "repo_connector",
  "platform_api",
] as const;

/** Read the verification state with a typed default (unverified). */
export function ownershipState(site: Doc<"sites">): OwnershipState {
  const raw = (site as any).ownershipVerification?.state;
  return raw === "verified" || raw === "verification_pending" ? raw : "unverified";
}

/** Load a site row (works in both query and mutation contexts). */
async function getSite(ctx: QueryCtx | MutationCtx, siteId: Id<"sites">): Promise<Doc<"sites"> | null> {
  return ctx.db.get(siteId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public reads (site-scoped)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The verification status a site member sees: state, method, token (safe to
 * show the site owner — it is THEIR shared secret, useless without the
 * domain), instructions, and the evidence log. Site-scoped: no access →
 * null (same contract as discovery).
 */
export const getStatus = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;

    const site = await ctx.db.get(siteId);
    if (!site) return null;

    const evidence = await ctx.db
      .query("siteVerifications")
      .withIndex("by_site_checkedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(10);

    const ov: any = (site as any).ownershipVerification ?? {};
    return {
      siteId: site._id,
      connectionMode: (site as any).connectionMode ?? null,
      state: ownershipState(site),
      method: ov.method ?? null,
      token: ov.state === "unverified" ? null : ov.token ?? null,
      beganAt: ov.beganAt ?? null,
      lastCheckedAt: ov.lastCheckedAt ?? null,
      verifiedAt: ov.verifiedAt ?? null,
      attempts: ov.attempts ?? 0,
      lastFailureReason: ov.lastFailureReason ?? null,
      instructions: ov.state === "unverified" || !ov.method ? [] : verificationInstructions(ov.method, ov.token ?? ""),
      evidence,
    };
  },
});

/** Per-method instructions returned to the owner (generic; no customer names). */
export function verificationInstructions(method: VerificationMethod, token: string): string[] {
  const prefixed = `taya-verification=${token}`;
  switch (method) {
    case "dns_txt":
      return [
        `Add a TXT record on your domain with the value:`,
        `    ${prefixed}`,
        `or add the bare token as its own TXT record value.`,
        `DNS propagation can take minutes to a few hours — then press "Check now".`,
      ];
    case "html_meta_token":
      return [
        `Add this tag inside the <head> of your homepage:`,
        `    <meta name="taya-verification" content="${token}">`,
        `Save and re-deploy your homepage, then press "Check now".`,
      ];
    case "bridge_token":
      return [
        `Your site's TAYA bridge must serve this token at /api/bridge/verify.`,
        `Set it on the bridge snippet: data-taya-token="${token}"`,
        `or in your build environment: TAYA_BRIDGE_TOKEN="${token}".`,
      ];
    case "repo_connector":
      return [
        `A TAYA administrator approves your repository/deployment connector.`,
        `Contact FSTS support to attach the approved connector to this site.`,
      ];
    case "platform_api":
      return [
        `A TAYA administrator authorizes your site platform's API.`,
        `Contact FSTS support to attach the platform authorization.`,
      ];
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// beginVerification (action — owner-facing token mint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A site owner begins verification: pick a self-serve method, TAYA mints a
 * token, records state=verification_pending, and returns instructions.
 */
export const beginVerification = action({
  args: {
    siteId: v.id("sites"),
    method: v.union(
      v.literal("dns_txt"),
      v.literal("html_meta_token"),
      v.literal("bridge_token"),
    ),
  },
  handler: async (ctx, { siteId, method }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");

    const token = generateVerificationToken();
    const now = Date.now();

    await ctx.runMutation(internal.ownershipVerification._beginVerification, {
      siteId,
      method,
      token,
      beganAt: now,
    });

    return {
      state: "verification_pending",
      method,
      token,
      instructions: verificationInstructions(method, token),
    };
  },
});

/** Internal writer for beginVerification (single-writer discipline). */
export const _beginVerification = internalMutation({
  args: {
    siteId: v.id("sites"),
    method: v.string(),
    token: v.string(),
    beganAt: v.number(),
  },
  handler: async (ctx, { siteId, method, token, beganAt }) => {
    const site = await getSite(ctx, siteId);
    if (!site) throw new Error("Site not found.");
    if ((site as any).connectionMode === "TAYA_NATIVE") {
      throw new Error("TAYA_NATIVE sites are served by TAYA — nothing to verify.");
    }

    await ctx.db.patch(siteId, {
      ownershipVerification: {
        state: "verification_pending",
        method,
        token,
        beganAt,
        attempts: 0,
      } as any,
    });

    await logActivity(ctx, {
      siteId,
      actorName: "TAYA Ownership Verification",
      action: "ownership_verification_begun",
      entityType: "site",
      entityId: siteId,
      page: "Ownership Verification",
      details: `Verification begun via ${method}. A verification token was minted.`,
    });

    return { state: "verification_pending", method, token };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// checkVerification (action — the LIVE network check)
// ─────────────────────────────────────────────────────────────────────────────

/** Internal reader: current verification state + domain (for the action). */
export const _verificationState = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site) return null;
    const ov: any = (site as any).ownershipVerification ?? {};
    return {
      mode: (site as any).connectionMode ?? null,
      state: ov.state ?? "unverified",
      method: ov.method ?? null,
      token: ov.token ?? null,
      domain: site.domain ?? null,
    };
  },
});

/**
 * Run the live network check for the site's pending method. Verified → the
 * site promotes to TAYA_CONNECTED. Failed → §14 reason recorded, retryable.
 */
export const checkVerification = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");

    const state = await ctx.runQuery(internal.ownershipVerification._verificationState, {
      siteId,
    });
    if (!state) throw new Error("Site not found.");
    if (state.mode === "TAYA_NATIVE") {
      throw new Error("TAYA_NATIVE sites are served by TAYA — nothing to verify.");
    }
    if (state.state !== "verification_pending" || !state.token || !state.method) {
      throw new Error("No pending verification — begin verification first.");
    }

    const result = await runSelfServeCheck(
      state.method as VerificationMethod,
      state.domain ?? "",
      state.token,
    );
    const now = Date.now();

    if (result.ok) {
      await ctx.runMutation(internal.ownershipVerification._applyVerificationResult, {
        siteId,
        method: state.method,
        result: "verified",
        evidence: result.evidence,
        checkedBy: identity.tokenIdentifier ?? "site owner",
        checkedAt: now,
      });
      return {
        state: "verified",
        method: state.method,
        evidence: result.evidence,
        connectionMode: "TAYA_CONNECTED",
      };
    }

    await ctx.runMutation(internal.ownershipVerification._applyVerificationResult, {
      siteId,
      method: state.method,
      result: "failed",
      evidence: "",
      failureReason: result.reason ?? "Verification check failed.",
      checkedBy: identity.tokenIdentifier ?? "site owner",
      checkedAt: now,
    });
    return {
      state: "verification_pending",
      method: state.method,
      failureReason: result.reason,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// _applyVerificationResult (internal mutation — the SINGLE WRITER)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a check outcome. SINGLE WRITER for sites.ownershipVerification:
 * verified flips connectionMode → TAYA_CONNECTED; failed records the §14
 * reason and increments attempts while the state stays pending.
 */
export const _applyVerificationResult = internalMutation({
  args: {
    siteId: v.id("sites"),
    method: v.string(),
    result: v.string(), // "verified" | "failed"
    evidence: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    checkedBy: v.optional(v.string()),
    checkedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const site = await getSite(ctx, args.siteId);
    if (!site) throw new Error("Site not found.");

    const current: any = (site as any).ownershipVerification ?? {};
    const verified = args.result === "verified";

    await ctx.db.insert("siteVerifications", {
      siteId: args.siteId,
      method: args.method,
      result: verified ? "verified" : "failed",
      ...(verified ? { evidence: args.evidence ?? "" } : {}),
      ...(!verified ? { failureReason: args.failureReason ?? "Check failed." } : {}),
      checkedBy: args.checkedBy ?? "system",
      checkedAt: args.checkedAt,
    });

    await ctx.db.patch(args.siteId, {
      ownershipVerification: {
        ...current,
        state: verified ? "verified" : current.state ?? "verification_pending",
        method: args.method,
        token: current.token,
        beganAt: current.beganAt,
        lastCheckedAt: args.checkedAt,
        ...(verified ? { verifiedAt: args.checkedAt } : {}),
        attempts: (current.attempts ?? 0) + 1,
        ...(!verified ? { lastFailureReason: args.failureReason ?? "Check failed." } : {}),
      } as any,
    });

    if (verified) {
      // §6: a verified external site is bridge-connected → full edit+publish.
      await ctx.db.patch(args.siteId, { connectionMode: "TAYA_CONNECTED" });
      await logActivity(ctx, {
        siteId: args.siteId,
        actorName: "TAYA Ownership Verification",
        action: "ownership_verified",
        entityType: "site",
        entityId: args.siteId,
        page: "Ownership Verification",
        details: `Domain control verified via ${args.method}: ${args.evidence ?? "verified"}. Publishing enabled (TAYA_CONNECTED).`,
      });
    } else {
      await logActivity(ctx, {
        siteId: args.siteId,
        actorName: "TAYA Ownership Verification",
        action: "ownership_check_failed",
        entityType: "site",
        entityId: args.siteId,
        page: "Ownership Verification",
        details: args.failureReason ?? "Check failed.",
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// approveConnector (SUPERADMIN-only trust method)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SUPERADMIN-only: attach an operator-trust verification method
 * (repo_connector / platform_api — §15 approved connectors). This is the
 * "approved repository/deployment connector" and "site-platform API
 * authorization" path: an operator vouches for the connection; no network
 * check is performed. Records evidence + flips to verified/TAYA_CONNECTED.
 */
export const approveConnector = mutation({
  args: {
    siteId: v.id("sites"),
    method: v.union(v.literal("repo_connector"), v.literal("platform_api")),
    connectorName: v.string(),
  },
  handler: async (ctx, { siteId, method, connectorName }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) {
      throw new Error("Forbidden: only FSTS administrators may approve connectors.");
    }

    const site = await getSite(ctx, siteId);
    if (!site) throw new Error("Site not found.");
    if ((site as any).connectionMode === "TAYA_NATIVE") {
      throw new Error("TAYA_NATIVE sites are served by TAYA — nothing to verify.");
    }

    const now = Date.now();
    await ctx.db.insert("siteVerifications", {
      siteId,
      method,
      result: "verified",
      evidence: `Approved ${method === "repo_connector" ? "repository/deployment connector" : "site-platform API authorization"}: ${connectorName}`,
      checkedBy: user.email,
      checkedAt: now,
    });
    await ctx.db.patch(siteId, {
      ownershipVerification: {
        state: "verified",
        method,
        beganAt: (site as any).ownershipVerification?.beganAt ?? now,
        verifiedAt: now,
        attempts: ((site as any).ownershipVerification?.attempts ?? 0) + 1,
      } as any,
      connectionMode: "TAYA_CONNECTED",
    });
    await logActivity(ctx, {
      siteId,
      actorName: user.email,
      action: "ownership_verified",
      entityType: "site",
      entityId: siteId,
      page: "Ownership Verification",
      details: `Domain ownership approved by FSTS administrator via ${method}: ${connectorName}. Publishing enabled (TAYA_CONNECTED).`,
    });

    return { state: "verified", method, connectionMode: "TAYA_CONNECTED" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// resetVerification (SUPERADMIN-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SUPERADMIN-only: reset a site to unverified (domain changed hands, or a
 * verification must be redone). connectionMode returns to
 * DISCOVERED_EXTERNAL — publishing re-blocks immediately.
 */
export const resetVerification = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) {
      throw new Error("Forbidden: only FSTS administrators may reset verification.");
    }

    const site = await getSite(ctx, siteId);
    if (!site) throw new Error("Site not found.");

    await ctx.db.patch(siteId, {
      ownershipVerification: { state: "unverified", attempts: 0 } as any,
      connectionMode: "DISCOVERED_EXTERNAL",
    });
    await logActivity(ctx, {
      siteId,
      actorName: user.email,
      action: "ownership_verification_reset",
      entityType: "site",
      entityId: siteId,
      page: "Ownership Verification",
      details: "Ownership verification reset by FSTS administrator. Publishing re-blocked (DISCOVERED_EXTERNAL).",
    });

    return { state: "unverified", connectionMode: "DISCOVERED_EXTERNAL" };
  },
});
