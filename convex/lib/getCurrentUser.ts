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

function accessFlagsForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const superAdminEmails = parseEmailAllowlist(process.env.SUPERADMIN_EMAILS);
  const internalQaEmails = parseEmailAllowlist(process.env.INTERNAL_QA_EMAILS);
  const isSuperAdmin = superAdminEmails.has(normalizedEmail);
  const isInternalQa = internalQaEmails.has(normalizedEmail);

  if (isSuperAdmin && isInternalQa) {
    throw new Error(
      "Account configuration error: an email cannot be both SUPERADMIN_EMAILS and INTERNAL_QA_EMAILS",
    );
  }

  return { normalizedEmail, isSuperAdmin, isInternalQa };
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

async function reconcileExistingAccess(
  ctx: MutationCtx,
  user: CurrentUser,
  expectedSuperAdmin: boolean,
): Promise<CurrentUser> {
  if (!user.isActive) throw new Error("Account is deactivated");

  let current = user;
  if (current.isSuperAdmin !== expectedSuperAdmin) {
    await ctx.db.patch(current._id, { isSuperAdmin: expectedSuperAdmin });
    current = (await ctx.db.get(current._id))!;
  }

  return await ensureInternalQaRoles(ctx, current);
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

  const email = (identity.email ?? `${identity.subject}@unknown.local`).trim().toLowerCase();
  const { isSuperAdmin, isInternalQa } = accessFlagsForEmail(email);

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (existing) {
    return await reconcileExistingAccess(ctx, existing, isSuperAdmin);
  }

  const emailMatchedUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  // Invitation records intentionally use a pending:* Clerk ID until the invited
  // person signs in for the first time. Link that row to the authenticated Clerk
  // subject without creating a duplicate user.
  if (emailMatchedUser && emailMatchedUser.clerkUserId.startsWith("pending:")) {
    if (!emailMatchedUser.isActive) throw new Error("Account is deactivated");
    await ctx.db.patch(emailMatchedUser._id, {
      clerkUserId: identity.subject,
      isSuperAdmin,
    });
    const connected = (await ctx.db.get(emailMatchedUser._id))!;
    return await ensureInternalQaRoles(ctx, connected);
  }

  // Recovery for an FSTS owner account after a Clerk instance/domain migration.
  // A trusted Clerk JWT plus an explicit SUPERADMIN_EMAILS allowlist entry is
  // required before an existing email-matched account may be rebound to a new
  // Clerk subject. Normal client accounts are never rebound this way.
  if (
    emailMatchedUser &&
    isSuperAdmin &&
    emailMatchedUser.clerkUserId !== identity.subject
  ) {
    if (!emailMatchedUser.isActive) throw new Error("Account is deactivated");
    await ctx.db.patch(emailMatchedUser._id, {
      clerkUserId: identity.subject,
      isSuperAdmin: true,
    });
    const rebound = (await ctx.db.get(emailMatchedUser._id))!;
    return await ensureInternalQaRoles(ctx, rebound);
  }

  // Do not silently create duplicate normal-user rows when an email is already
  // attached to a different Clerk identity. That requires an explicit admin
  // account-recovery decision instead of an automatic identity takeover.
  if (emailMatchedUser) {
    throw new Error("Account already exists with a different authentication identity");
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
