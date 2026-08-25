import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

export type CurrentUser = Doc<"users">;

function parseEmailAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function ensureInternalQaRoles(ctx: MutationCtx, user: CurrentUser): Promise<CurrentUser> {
  const internalQaEmails = parseEmailAllowlist(process.env.INTERNAL_QA_EMAILS);
  if (!internalQaEmails.has(user.email.trim().toLowerCase())) return user;

  const sites = await ctx.db.query("sites").collect();
  const existingSiteIds = new Set(user.roles.map((role) => String(role.siteId)));
  const missingQaRoles = sites
    .filter((site) => !existingSiteIds.has(String(site._id)))
    .map((site) => ({ siteId: site._id, role: "internal_qa" }));

  if (missingQaRoles.length === 0) return user;

  await ctx.db.patch(user._id, { roles: [...user.roles, ...missingQaRoles] });
  return (await ctx.db.get(user._id))!;
}

export async function getCurrentUser(ctx: QueryCtx | MutationCtx): Promise<CurrentUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  return user;
}

export async function provisionUser(ctx: MutationCtx): Promise<CurrentUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (existing) {
    if (!existing.isActive) throw new Error("Account is deactivated");
    return await ensureInternalQaRoles(ctx, existing);
  }

  const email = (identity.email ?? `${identity.subject}@unknown.local`).trim().toLowerCase();

  const pendingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (pendingUser && pendingUser.clerkUserId.startsWith("pending:")) {
    if (!pendingUser.isActive) throw new Error("Account is deactivated");
    await ctx.db.patch(pendingUser._id, { clerkUserId: identity.subject });
    const connected = (await ctx.db.get(pendingUser._id))!;
    return await ensureInternalQaRoles(ctx, connected);
  }

  // FSTS SuperAdmin allowlist: platform-wide administration.
  const superAdminEmails = parseEmailAllowlist(process.env.SUPERADMIN_EMAILS);
  const isSuperAdmin = superAdminEmails.has(email);

  // FSTS Internal QA allowlist: client-workspace QA without superadmin access.
  // Re-provisioning fills in internal_qa roles for sites added later.
  const internalQaEmails = parseEmailAllowlist(process.env.INTERNAL_QA_EMAILS);
  const isInternalQa = internalQaEmails.has(email);

  if (isSuperAdmin && isInternalQa) {
    throw new Error(
      "Account configuration error: an email cannot be both SUPERADMIN_EMAILS and INTERNAL_QA_EMAILS",
    );
  }

  const name =
    identity.name ||
    [identity.givenName, identity.familyName].filter(Boolean).join(" ") ||
    identity.email ||
    identity.subject;

  const qaRoles = isInternalQa
    ? (await ctx.db.query("sites").collect()).map((site) => ({ siteId: site._id, role: "internal_qa" }))
    : [];

  const userId = await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    name,
    email,
    isSuperAdmin,
    isActive: true,
    roles: qaRoles,
  });

  return (await ctx.db.get(userId))!;
}

export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<CurrentUser> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  if (!user.isActive) throw new Error("Account is deactivated");
  return user;
}
