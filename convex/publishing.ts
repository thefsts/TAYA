/**
 * PHASE 2 PR-2 — Publishing authority (spec §6, §7, §15–§16).
 *
 * Three connection modes (§6) — LOCKED, never faked:
 *
 *   TAYA_NATIVE         — TAYA hosts the site; publishing is a direct write
 *                         through the normal content tables. Full publish.
 *   TAYA_CONNECTED      — external site, ownership VERIFIED; drafts publish
 *                         and the bridge serves published values (§16).
 *   DISCOVERED_EXTERNAL — external site, crawled read-only, ownership NOT
 *                         yet verified: DRAFT and PREVIEW allowed, PUBLISH
 *                         SERVER-BLOCKED. No UI flow, no permission, and no
 *                         client-supplied value can bypass this — the gate
 *                         lives here, server-side.
 *
 * Content model: the durable §5 page/content map (siteContentMaps) holds a
 * `discovered` baseline plus optional `draft` / `published` overlays per
 * entry. Drafting is always allowed for site members; PUBLISHING promotes
 * drafts → published (the value the bridge serves), records a
 * contentVersions row, and logs activity. The discovered baseline is never
 * overwritten — it is the reference for stale marking on the next crawl.
 *
 * SERVER-BLOCKED GATE: publishContentMap re-reads sites.connectionMode +
 * ownershipVerification.state from the database at publish time. The throw
 * is the contract — the dashboard cannot bypass it, and neither can any
 * action. Only verification (_applyVerificationResult → TAYA_CONNECTED) or
 * a SUPERADMIN connector approval can lift the block.
 *
 * TENANT ISOLATION (§22): every entry point is site-scoped (checkSiteAccess
 * or requirePermission); cross-tenant callers receive null / Forbidden.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";
import { ownershipState } from "./ownershipVerification";
import { classifyLink } from "./lib/safeLinks";

/** The three connection modes (§6) — the full locked set. */
export const CONNECTION_MODES = [
  "TAYA_NATIVE",
  "TAYA_CONNECTED",
  "DISCOVERED_EXTERNAL",
] as const;
export type ConnectionMode = (typeof CONNECTION_MODES)[number];

/** The exact server-side block message (UI shows it verbatim). */
export const PUBLISH_BLOCKED_MESSAGE =
  "Publishing connection required: verify ownership of your site to enable publishing. Use Site Verification in your workspace.";

/** Read a normalized connection mode with a typed default (none). */
export function connectionModeOf(site: any): ConnectionMode | null {
  const raw = site?.connectionMode;
  return raw === "TAYA_NATIVE" || raw === "TAYA_CONNECTED" || raw === "DISCOVERED_EXTERNAL"
    ? raw
    : null;
}

/** Server-side publishing verdict for a site (§6/§15). */
export type PublishAuthority = {
  siteId: string;
  connectionMode: ConnectionMode | null;
  ownershipState: "unverified" | "verification_pending" | "verified";
  /** True when publishing is allowed NOW. */
  canPublish: boolean;
  /** Human explanation of the verdict (§14: always explicit). */
  reason: string;
  /** True when the block is the ownership gate (never a permission issue). */
  blockedByOwnership: boolean;
};

/** Compute the verdict — pure on a site doc. */
export function publishAuthorityFor(site: any): PublishAuthority {
  const mode = connectionModeOf(site);
  const state = ownershipState(site);
  const siteId = String(site?._id ?? "");

  if (mode === "TAYA_NATIVE") {
    return {
      siteId,
      connectionMode: mode,
      ownershipState: state,
      canPublish: true,
      reason: "TAYA_NATIVE: the site is hosted by TAYA and publishes directly.",
      blockedByOwnership: false,
    };
  }
  if (mode === "TAYA_CONNECTED") {
    return {
      siteId,
      connectionMode: mode,
      ownershipState: state,
      canPublish: true,
      reason:
        "TAYA_CONNECTED: ownership verified — publishing flows through the TAYA Web Bridge.",
      blockedByOwnership: false,
    };
  }
  if (mode === "DISCOVERED_EXTERNAL") {
    return {
      siteId,
      connectionMode: mode,
      ownershipState: state,
      canPublish: false,
      reason: PUBLISH_BLOCKED_MESSAGE,
      blockedByOwnership: true,
    };
  }
  // No mode recorded — discovery hasn't confirmed anything yet. Reachable
  // for a just-created site before the crawl lands; treated as
  // not-yet-publishable with an explicit reason (§14). NEVER a silent pass
  // and never a fake TAYA_NATIVE.
  return {
    siteId,
    connectionMode: null,
    ownershipState: state,
    canPublish: false,
    reason:
      "Publishing mode not identified yet — discovery is still running for this site.",
    blockedByOwnership: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The server-side publishing verdict (three-mode authority). Site-scoped:
 * no access → null. This is what the dashboard badge and the Setup
 * onboarding block render; the SAME logic is enforced inside
 * publishContentMap, so the UI cannot bypass it.
 */
export const canPublish = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;
    const site = await ctx.db.get(siteId);
    if (!site) return null;
    return publishAuthorityFor(site);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Draft / published overlay storage (single internal writer)
// ─────────────────────────────────────────────────────────────────────────────

/** A single entry from the client: key → {value, (optional) label/type}. */
const entryPatchArgs = v.object({
  key: v.string(),
  value: v.string(),
});

async function loadContentMapDoc(ctx: MutationCtx, siteId: any) {
  return ctx.db
    .query("siteContentMaps")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .first();
}

/**
 * URL/link validation guard (§2 — safe button/link editing).
 *
 * saveDraft is the ONLY client-writable path into map overlays, so unsafe
 * destinations must die HERE, server-side: a compromised client (or any
 * future surface that calls saveDraft) can never smuggle javascript:/data:/
 * scheme-relative or malformed URLs into the map — even though the frame
 * bootstrap and the bridge also never execute those values.
 *
 * Applies to entries the discovery grammar types as link-bearing:
 *   - type "url"   (hero primaryButton.href + list_item .href companions)
 *   - type "image" (Media Library CDN https URLs, or discovered /path.src)
 *   - type "button"/"link" (normalized crawl types for anchor elements)
 *
 * The NORMALIZED value is stored (bare domains upgrade to https://, phone
 * numbers compact to tel:+…), and rejections carry the same client-safe
 * reason the editor control shows. Empty values are always allowed
 * (clearing a draft). Text and list_item label entries pass through —
 * their values render as text, not URLs.
 */
function guardLinkValue(key: string, value: string, entryType: string | undefined): string {
  const type = entryType ?? "text";
  if (type !== "url" && type !== "image" && type !== "button" && type !== "link") return value;
  if (value === "") return value; // clearing is always allowed
  const verdict = classifyLink(value);
  if (!verdict.ok) {
    throw new ConvexError(`Unsafe destination on "${key}": ${verdict.reason}`);
  }
  return verdict.normalized;
}

export const _applyOverlay = internalMutation({  args: {
    siteId: v.id("sites"),
    /** "draft" | "published" | "discard" */
    overlay: v.string(),
    entries: v.optional(v.array(entryPatchArgs)),
    publishedAt: v.optional(v.number()),
    conformed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const map = await loadContentMapDoc(ctx, args.siteId);
    if (!map) {
      throw new ConvexError(
        "No content map for this site yet — discovery must complete first.",
      );
    }
    const entries: Record<string, any> = { ...(map.entries ?? {}) };

    if (args.overlay === "discard") {
      for (const key of (args.entries ?? []).map((e: any) => e.key)) {
        const e = entries[key];
        if (e) delete e.draft;
      }
    } else {
      for (const patch of args.entries ?? []) {
        const e = entries[patch.key];
        if (!e) continue; // unknown keys are ignored (allowlist = map keys)
        e[args.overlay] = patch.value;
        delete e.stale;
      }
    }

    await ctx.db.patch(map._id, { entries, refreshedAt: Date.now() });
    return { ok: true, keyCount: map.keyCount };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Public mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Result shape of an overlay application (explicit to cut type cycles). */
export type OverlayResult = { ok: boolean; keyCount: number };

/**
 * Save DRAFT edits onto the content map. Allowed in ALL modes including
 * DISCOVERED_EXTERNAL-unverified (spec §16: unverified sites can draft and
 * preview). Requires CONTENT_UPDATE permission.
 */
export const saveDraft = mutation({
  args: {
    siteId: v.id("sites"),
    entries: v.array(entryPatchArgs),
  },
  // Explicit return annotation: _applyOverlay lives in this same module, so
  // letting the compiler infer the handler's return type creates a circular
  // reference through the generated api types (TS7022/7023).
  handler: async (ctx, { siteId, entries }): Promise<OverlayResult> => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    if (entries.length === 0) throw new ConvexError("No draft entries provided.");

    // §2 href guard — validate + normalize link-bearing drafts BEFORE they
    // land in the map (the map doc is loaded once, then each entry checked).
    const map = await loadContentMapDoc(ctx, siteId);
    if (!map) {
      throw new ConvexError(
        "No content map for this site yet — discovery must complete first.",
      );
    }
    const existingTypes: Record<string, any> = (map.entries ?? {}) as Record<string, any>;
    const guarded = entries.map((e) => ({
      key: e.key,
      value: guardLinkValue(e.key, e.value, existingTypes[e.key]?.type),
    }));

    const applied = await ctx.runMutation(internal.publishing._applyOverlay, {
      siteId,
      overlay: "draft",
      entries: guarded,
    });

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "saved",
      entityType: "content draft",
      page: "Visual Editor",
      details: `${entries.length} key${entries.length === 1 ? "" : "s"} drafted (${entries
        .slice(0, 3)
        .map((e: any) => e.key)
        .join(", ")}${entries.length > 3 ? ", …" : ""})`,
    });

    return applied;
  },
});

/** Discard draft overlays (revert to discovered/published values). */
export const discardDraft = mutation({
  args: {
    siteId: v.id("sites"),
    keys: v.array(v.string()),
  },
  handler: async (ctx, { siteId, keys }): Promise<OverlayResult> => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    if (keys.length === 0) throw new ConvexError("No keys provided.");

    const applied = await ctx.runMutation(internal.publishing._applyOverlay, {
      siteId,
      overlay: "discard",
      entries: keys.map((key) => ({ key, value: "" })),
    });

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "discarded",
      entityType: "content draft",
      page: "Visual Editor",
      details: `${keys.length} draft value${keys.length === 1 ? "" : "s"} discarded`,
    });

    return applied;
  },
});

/**
 * PUBLISH the content map (§6/§16).
 *
 * Permission is necessary but NOT sufficient: the server re-reads the
 * site's connectionMode + ownershipVerification at publish time and THROWS
 * for unverified external sites. This is the server-blocked gate — a
 * perfect UI, a superuser client, or a compromised dashboard cannot
 * publish an unverified external site's content.
 *
 * On success: draft values are promoted to published (the values the
 * bridge serves via /api/bridge/content), remaining drafts are cleared,
 * a contentVersions row is recorded, and activity is logged.
 */
export const publishContentMap = mutation({
  args: {
    siteId: v.id("sites"),
    /** Optional subset — publish only these keys (default: all drafted). */
    keys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { siteId, keys }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);

    // ── SERVER-SIDE MODE GATE (the contract) ────────────────────────────
    const site = await ctx.db.get(siteId);
    if (!site) throw new ConvexError("Site not found.");
    const authority = publishAuthorityFor(site);
    if (!authority.canPublish) {
      await logActivity(ctx, {
        siteId,
        actorName: user.name,
        action: "publish_blocked",
        entityType: "content publish",
        page: "Visual Editor",
        details: authority.reason,
      });
      throw new ConvexError(authority.reason);
    }

    // Which keys to publish: explicit subset or every entry with a draft.
    const map = await loadContentMapDoc(ctx, siteId);
    if (!map) {
      throw new ConvexError(
        "No content map for this site yet — discovery must complete first.",
      );
    }
    const entries: Record<string, any> = map.entries ?? {};
    const targetKeys =
      keys && keys.length > 0
        ? keys
        : Object.keys(entries).filter((k) => entries[k]?.draft !== undefined);
    if (targetKeys.length === 0) {
      throw new ConvexError("Nothing to publish — no draft values are pending.");
    }

    // Promote drafts → published, clear the draft overlay, un-stale.
    const publishPatches = targetKeys
      .filter((k) => entries[k])
      .map((k) => {
        const e = entries[k];
        const value = e.draft ?? e.published ?? e.discovered;
        return { key: k, value };
      });

    const publishedAt = Date.now();
    await ctx.runMutation(internal.publishing._applyOverlay, {
      siteId,
      overlay: "published",
      entries: publishPatches,
      publishedAt,
    });

    // Clear the now-published drafts in the same logical publish.
    await ctx.runMutation(internal.publishing._applyOverlay, {
      siteId,
      overlay: "discard",
      entries: publishPatches.map((p) => ({ key: p.key, value: "" })),
    });

    // Record a reviewable version snapshot (§17 revision history).
    const publishedSnapshot: Record<string, string> = {};
    for (const p of publishPatches) publishedSnapshot[p.key] = p.value;
    await recordVersion(ctx, {
      siteId,
      actorName: user.name,
      entityType: "content_map_publish",
      entityId: String(map._id),
      snapshot: {
        publishedAt,
        keys: publishedSnapshot,
        connectionMode: authority.connectionMode,
      },
    });

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "published",
      entityType: "content map",
      page: "Visual Editor",
      details: `Published ${publishPatches.length} key${
        publishPatches.length === 1 ? "" : "s"
      } to the live map (${authority.connectionMode}).`,
    });

    return { ok: true, publishedKeys: publishPatches.length, publishedAt };
  },
});
