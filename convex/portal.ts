import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getCurrentUser } from "./lib/getCurrentUser";
import type { Id } from "./_generated/dataModel";

// ─── Crypto helpers (Web Crypto API — available in Convex V8 runtime) ─────────

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000; // 30 days

// ─── Internal queries ─────────────────────────────────────────────────────────

export const _getSiteBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first(),
});

export const _getPortalConfig = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) =>
    ctx.db.query("portalConfigs").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
});

export const _getPortalUserByEmail = internalQuery({
  args: { siteId: v.id("sites"), email: v.string() },
  handler: async (ctx, { siteId, email }) =>
    ctx.db
      .query("portalUsers")
      .withIndex("by_site_email", (q) => q.eq("siteId", siteId).eq("email", email))
      .first(),
});

export const _getSessionByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("portalSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    return session;
  },
});

// ─── Internal mutations ───────────────────────────────────────────────────────

export const _createPortalUser = internalMutation({
  args: {
    siteId: v.id("sites"),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    role: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("portalUsers", { ...args, emailVerified: false }),
});

/**
 * Atomically check lockout state and pre-increment the failed-login counter
 * before password verification happens in the calling action. Because Convex
 * mutations are serialised, concurrent login requests cannot both read a
 * stale count and both pass the threshold simultaneously — each request
 * increments in sequence, so the lockout triggers at exactly the right attempt.
 *
 * Returns:
 *  { status: "locked", lockedUntil }   — existing lock still active; skip hash
 *  { status: "proceed", passwordHash, passwordSalt, newLockedUntil? }
 *                                      — count incremented; verify hash, then
 *                                        if correct call _loginSuccess to reset
 */
export const _attemptLogin = internalMutation({
  args: { portalUserId: v.id("portalUsers") },
  handler: async (ctx, { portalUserId }) => {
    const user = await ctx.db.get(portalUserId);
    if (!user) return null;

    const now = Date.now();

    // Still under an existing lock — reject immediately without incrementing
    if (user.lockedUntil && user.lockedUntil > now) {
      return { status: "locked" as const, lockedUntil: user.lockedUntil };
    }

    // Pre-increment: every attempt (right or wrong) costs one token.
    // The calling action resets to 0 on a correct password.
    const newCount = (user.failedLoginCount ?? 0) + 1;
    let newLockedUntil: number | undefined;
    if (newCount >= 15) newLockedUntil = now + 60 * 60 * 1_000;       // 1 h
    else if (newCount >= 10) newLockedUntil = now + 15 * 60 * 1_000;  // 15 min
    else if (newCount >= 5) newLockedUntil = now + 60 * 1_000;        // 1 min

    await ctx.db.patch(portalUserId, {
      failedLoginCount: newCount,
      lockedUntil: newLockedUntil,
    });

    return {
      status: "proceed" as const,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      newLockedUntil,
    };
  },
});

/** Reset counter + create session in one atomic mutation on successful login. */
export const _loginSuccess = internalMutation({
  args: {
    portalUserId: v.id("portalUsers"),
    siteId: v.id("sites"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { portalUserId, siteId, token, expiresAt }) => {
    await ctx.db.patch(portalUserId, { failedLoginCount: 0, lockedUntil: undefined });
    const old = await ctx.db
      .query("portalSessions")
      .withIndex("by_user", (q) => q.eq("portalUserId", portalUserId))
      .collect();
    for (const s of old) await ctx.db.delete(s._id);
    await ctx.db.insert("portalSessions", { portalUserId, siteId, token, expiresAt, lastActiveAt: Date.now() });
  },
});

export const _createPortalSession = internalMutation({
  args: {
    portalUserId: v.id("portalUsers"),
    siteId: v.id("sites"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("portalSessions")
      .withIndex("by_user", (q) => q.eq("portalUserId", args.portalUserId))
      .collect();
    for (const s of old) await ctx.db.delete(s._id);
    return ctx.db.insert("portalSessions", { ...args, lastActiveAt: Date.now() });
  },
});

// ─── Public actions (register / login) ───────────────────────────────────────

export const register = action({
  args: {
    siteSlug: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const site = await ctx.runQuery(internal.portal._getSiteBySlug, { slug: args.siteSlug });
    if (!site) return { success: false, error: "Site not found." };

    const config = await ctx.runQuery(internal.portal._getPortalConfig, { siteId: site._id });
    if (!config?.enabled) return { success: false, error: "Client Portal is not enabled for this site." };
    if (!config.registrationOpen) return { success: false, error: "Registration is currently closed." };

    const normalEmail = args.email.toLowerCase().trim();
    const existing = await ctx.runQuery(internal.portal._getPortalUserByEmail, {
      siteId: site._id,
      email: normalEmail,
    });
    if (existing) return { success: false, error: "An account with this email already exists." };

    if (args.password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

    const salt = randomHex(16);
    const passwordHash = await hashPassword(args.password, salt);
    const status = config.requireApproval ? "pending_approval" : "active";

    const portalUserId: Id<"portalUsers"> = await ctx.runMutation(internal.portal._createPortalUser, {
      siteId: site._id,
      email: normalEmail,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      passwordHash,
      passwordSalt: salt,
      role: "member",
      status,
    });

    // Schedule welcome email — fire-and-forget. Wrap in try/catch so that a
    // transient scheduler failure does not abort a successful registration.
    try {
      await ctx.scheduler.runAfter(0, internal.email.sendPortalWelcome, {
        siteId: site._id,
        siteName: site.name,
        firstName: args.firstName.trim(),
        email: normalEmail,
        requiresApproval: status === "pending_approval",
      });
    } catch (e) {
      console.warn("[portal.register] Failed to schedule welcome email (registration still succeeds):", e);
    }

    if (status === "active") {
      const token = randomHex(32);
      await ctx.runMutation(internal.portal._createPortalSession, {
        portalUserId,
        siteId: site._id,
        token,
        expiresAt: Date.now() + SESSION_TTL_MS,
      });
      return {
        success: true,
        sessionToken: token,
        user: { firstName: args.firstName.trim(), lastName: args.lastName.trim(), email: normalEmail },
      };
    }
    return { success: true, requiresApproval: true };
  },
});

export const login = action({
  args: { siteSlug: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{
    success: boolean;
    sessionToken?: string;
    user?: { _id: string; firstName: string; lastName: string; email: string; role: string; status: string };
    error?: string;
    lockedUntil?: number;
  }> => {
    const site = await ctx.runQuery(internal.portal._getSiteBySlug, { slug: args.siteSlug });
    if (!site) return { success: false, error: "Site not found." };

    const config = await ctx.runQuery(internal.portal._getPortalConfig, { siteId: site._id });
    if (!config?.enabled) return { success: false, error: "Client Portal is not enabled for this site." };

    const normalEmail = args.email.toLowerCase().trim();
    const portalUser = await ctx.runQuery(internal.portal._getPortalUserByEmail, {
      siteId: site._id,
      email: normalEmail,
    });
    if (!portalUser) return { success: false, error: "Invalid email or password." };

    if (portalUser.status === "pending_approval")
      return { success: false, error: "Your account is pending approval. Please check back later." };
    if (portalUser.status === "deactivated")
      return { success: false, error: "Your account has been deactivated. Please contact support." };

    // ── Atomic lockout check + counter pre-increment ─────────────────────────
    // _attemptLogin is a Convex mutation (serialised), so concurrent requests
    // cannot both pass the threshold simultaneously — they queue and each sees
    // the updated count written by the previous request.
    const attempt = await ctx.runMutation(internal.portal._attemptLogin, {
      portalUserId: portalUser._id,
    });

    if (!attempt) return { success: false, error: "Invalid email or password." };

    if (attempt.status === "locked") {
      return { success: false, error: "AccountTemporarilyLocked", lockedUntil: attempt.lockedUntil };
    }

    // ── Password verification (outside mutation — requires async Web Crypto) ──
    const hash = await hashPassword(args.password, attempt.passwordSalt);
    if (hash !== attempt.passwordHash) {
      // Counter was already incremented; surface a lock if the threshold was
      // crossed on this exact attempt so the user sees it immediately.
      if (attempt.newLockedUntil) {
        return { success: false, error: "AccountTemporarilyLocked", lockedUntil: attempt.newLockedUntil };
      }
      return { success: false, error: "Invalid email or password." };
    }

    // ── Successful login — reset counter + create session (atomic) ───────────
    const token = randomHex(32);
    await ctx.runMutation(internal.portal._loginSuccess, {
      portalUserId: portalUser._id,
      siteId: site._id,
      token,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return {
      success: true,
      sessionToken: token,
      user: {
        _id: portalUser._id,
        firstName: portalUser.firstName,
        lastName: portalUser.lastName,
        email: portalUser.email,
        role: portalUser.role,
        status: portalUser.status,
      },
    };
  },
});

// ─── Public queries / mutations ───────────────────────────────────────────────

export const getPublicSiteConfig = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", siteSlug))
      .first();
    if (!site) return null;
    const config = await ctx.db
      .query("portalConfigs")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    return {
      siteId: site._id,
      siteName: site.name,
      siteLogoUrl: site.logoUrl ?? null,
      sitePrimaryColor: site.brandColorPrimary,
      portalEnabled: config?.enabled ?? false,
      welcomeMessage: config?.welcomeMessage ?? `Welcome to ${site.name}`,
      portalLogoUrl: config?.logoUrl ?? null,
      portalPrimaryColor: config?.primaryColor ?? null,
      registrationOpen: config?.registrationOpen ?? false,
      requireApproval: config?.requireApproval ?? false,
      enabledFeatures: (config?.enabledFeatures as Record<string, boolean>) ?? {},
    };
  },
});

export const validateSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("portalSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    const user = await ctx.db.get(session.portalUserId);
    if (!user || user.status !== "active") return null;
    return {
      user: {
        _id: user._id as Id<"portalUsers">,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      expiresAt: session.expiresAt,
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("portalSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session) await ctx.db.delete(session._id);
  },
});

// ─── Admin queries / mutations (require Clerk/dashboard auth) ─────────────────

export const getConfig = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    if (!user.isSuperAdmin && !user.roles.some((r) => r.siteId === siteId)) return null;
    return (
      (await ctx.db.query("portalConfigs").withIndex("by_site", (q) => q.eq("siteId", siteId)).first()) ?? null
    );
  },
});

export const saveConfig = mutation({
  args: {
    siteId: v.id("sites"),
    enabled: v.boolean(),
    logoUrl: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    registrationOpen: v.boolean(),
    requireApproval: v.boolean(),
    enabledFeatures: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    if (!user.isSuperAdmin && !user.roles.some((r) => r.siteId === args.siteId))
      throw new Error("Access denied");
    const existing = await ctx.db
      .query("portalConfigs")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("portalConfigs", args);
    }
  },
});

export const listUsers = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    if (!user.isSuperAdmin && !user.roles.some((r) => r.siteId === siteId)) return null;
    const users = await ctx.db
      .query("portalUsers")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return users.map((u) => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      status: u.status,
      emailVerified: u.emailVerified,
      notes: u.notes ?? null,
      createdAt: u._creationTime,
    }));
  },
});

export const updateUserStatus = mutation({
  args: { portalUserId: v.id("portalUsers"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const portalUser = await ctx.db.get(args.portalUserId);
    if (!portalUser) throw new Error("User not found");
    if (!user.isSuperAdmin && !user.roles.some((r) => r.siteId === portalUser.siteId))
      throw new Error("Access denied");
    await ctx.db.patch(args.portalUserId, { status: args.status });
  },
});

export const updateUserRole = mutation({
  args: { portalUserId: v.id("portalUsers"), role: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const portalUser = await ctx.db.get(args.portalUserId);
    if (!portalUser) throw new Error("User not found");
    if (!user.isSuperAdmin && !user.roles.some((r) => r.siteId === portalUser.siteId))
      throw new Error("Access denied");
    await ctx.db.patch(args.portalUserId, { role: args.role });
  },
});

export const deletePortalUser = mutation({
  args: { portalUserId: v.id("portalUsers") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const portalUser = await ctx.db.get(args.portalUserId);
    if (!portalUser) throw new Error("User not found");
    if (!user.isSuperAdmin && !user.roles.some((r) => r.siteId === portalUser.siteId))
      throw new Error("Access denied");
    const sessions = await ctx.db
      .query("portalSessions")
      .withIndex("by_user", (q) => q.eq("portalUserId", args.portalUserId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    await ctx.db.delete(args.portalUserId);
  },
});

export const updateUserNotes = mutation({
  args: { portalUserId: v.id("portalUsers"), notes: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const portalUser = await ctx.db.get(args.portalUserId);
    if (!portalUser) throw new Error("User not found");
    if (!user.isSuperAdmin && !user.roles.some((r) => r.siteId === portalUser.siteId))
      throw new Error("Access denied");
    await ctx.db.patch(args.portalUserId, { notes: args.notes });
  },
});
