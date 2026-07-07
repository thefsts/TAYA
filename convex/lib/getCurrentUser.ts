import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

export type CurrentUser = Doc<"users">;

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
    return existing;
  }

  const email = identity.email ?? `${identity.subject}@unknown.local`;

  const pendingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (pendingUser && pendingUser.clerkUserId.startsWith("pending:")) {
    if (!pendingUser.isActive) throw new Error("Account is deactivated");
    await ctx.db.patch(pendingUser._id, { clerkUserId: identity.subject });
    return (await ctx.db.get(pendingUser._id))!;
  }

  const allUsers = await ctx.db.query("users").collect();
  const isFirstUser = allUsers.length === 0;

  const name =
    identity.name ??
    ([identity.givenName, identity.familyName].filter(Boolean).join(" ") ||
      (identity.email ?? identity.subject));

  const userId = await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    name,
    email,
    isSuperAdmin: isFirstUser,
    isActive: true,
    roles: [],
  });

  return (await ctx.db.get(userId))!;
}

export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<CurrentUser> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  if (!user.isActive) throw new Error("Account is deactivated");
  return user;
}
