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

function parseValueAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function accessFlagsForIdentity(email: string, clerkUserId: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const superAdminEmails = parseEmailAllowlist(process.env.SUPERADMIN_EMAILS);
  const superAdminClerkUserIds = parseValueAllowlist(process.env.SUPERADMIN_CLERK_USER_IDS);
  const internalQaEmails = parseEmailAllowlist(process.env.INTERNAL_QA_EMAILS);
  const isSuperAdmin =
    superAdminEmails.has(normalizedEmail) || superAdminClerkUserIds.has(clerkUserId);
  const isInternalQa = internalQaEmails.has(normalizedEmail);

  if (isSuperAdmin && isInternalQa) {
    throw new Error(
      "Account configuration error: an identity cannot be both SuperAdmin and Internal QA",
    );
  }

  const canonicalSuperAdminEmail =
    !email.includes("@unknown.local") && superAdminEmails.has(normalizedEmail)
      ? normalizedEmail
      : superAdminClerkUserIds.has(clerkUserId) && superAdminEmails.size === 1
        ? Array.from(superAdminEmails)[0]
        : normalizedEmail;

  return {
    normalizedEmail,
    canonicalSuperAdminEmail,
    isSuperAdmin,
    isInternalQa,
  };
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
  canonicalEmail?: string,
): Promise<CurrentUser> {
  if (!user.isActive) throw new Error("Account is deactivated");

  let current = user;
  const patch: { isSuperAdmin?: boolean; email?: string } = {};

  if (current.isSuperAdmin !== expectedSuperAdmin) {
    patch.isSuperAdmin = expectedSuperAdmin;
  }

  if (
    canonicalEmail &&
    current.email.endsWith("@unknown.local") &&
    canonicalEmail !== current.email.trim().toLowerCase()
  ) {
    patch.email = canonicalEmail;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(current._id, patch);
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

/**
 * Reconcile the user record found by Clerk user ID on a repeat sign-in.
 *
 * Production defect context: when the Clerk "convex" JWT template carried no
 * email claim, first sign-ins provisioned an orphan record with a
 * `<subject>@unknown.local` email and empty roles while the invited client's
 * real roles stayed stranded on their `pending:<email>` invitation record.
 * This path repairs that state on the next sign-in that DOES carry a trusted
 * email (identity claim or server-side verified):
 *
 *   1. Exactly one pending invitation matches the trusted email -> merge:
 *      rebind the invitation to this Clerk subject (preserving the
 *      invitation's email, roles, active status, and invitation history),
 *      carry over any non-conflicting orphan roles, retire the orphan row.
 *   2. No invitation matches -> upgrade the orphan's fallback email to the
 *      trusted address (guarded so a second record can never share an email).
 *   3. Another record already owns the trusted email -> leave the orphan
 *      untouched and log loudly; an administrator must reconcile.
 *
 * Superadmin identities skip the merge entirely - their allowlist entry is a
 * server-side decision, and the canonical-email upgrade in
 * `reconcileExistingAccess` already repairs their fallback records.
 */
async function reconcileExistingUser(
  ctx: MutationCtx,
  subject: string,
  existing: CurrentUser,
  trusted: {
    email: string | null;
    name: string | null;
    hasRealEmail: boolean;
    isSuperAdmin: boolean;
    canonicalEmail: string;
  },
): Promise<CurrentUser> {
  const existingIsOrphan = existing.email.trim().toLowerCase().endsWith("@unknown.local");
  let canonicalForReconcile: string | undefined = trusted.canonicalEmail;

  if (existingIsOrphan && trusted.hasRealEmail && !trusted.isSuperAdmin) {
    const pendingMatches = (await ctx.db.query("users").collect()).filter(
      (candidate) =>
        candidate.clerkUserId.startsWith("pending:") &&
        candidate.email === trusted.email,
    );
    if (pendingMatches.length > 1) {
      throw new Error(
        "Account configuration error: multiple pending invitations exist for this email address. Contact your administrator.",
      );
    }
    const claimable = pendingMatches[0] ?? null;

    if (claimable && claimable._id !== existing._id) {
      if (!claimable.isActive) throw new Error("Account is deactivated");
      const orphanRoles = existing.roles ?? [];
      const mergedRoles = [
        ...(claimable.roles ?? []).filter(
          (r) => !orphanRoles.some((o) => String(o.siteId) === String(r.siteId)),
        ),
        ...orphanRoles,
      ];
      await ctx.db.patch(claimable._id, {
        clerkUserId: subject,
        email: claimable.email,
        isSuperAdmin: false,
        roles: mergedRoles,
      });
      await ctx.db.delete(existing._id);
      console.warn(
        "[TAYA provision] merged a claimless orphan user into its pending invitation",
        {
          subject,
          email: claimable.email,
          retiredOrphanId: existing._id,
          keptUserId: claimable._id,
        },
      );
      const rebound = (await ctx.db.get(claimable._id))!;
      return await ensureInternalQaRoles(ctx, rebound);
    }

    const emailOwner = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", trusted.email!))
      .first();
    if (!emailOwner || emailOwner._id === existing._id) {
      await ctx.db.patch(existing._id, { email: trusted.email! });
      console.warn(
        "[TAYA provision] upgraded a claimless orphan email to the verified address",
        { subject, email: trusted.email, userId: existing._id },
      );
    } else {
      console.error(
        "[TAYA provision] cannot upgrade orphan email: another user already owns it (administrator reconciliation required)",
        { subject, email: trusted.email, orphanId: existing._id, ownerId: emailOwner._id },
      );
      canonicalForReconcile = undefined;
    }
  }

  // Cosmetic name repair for records whose name was seeded from the raw
  // Clerk subject because the JWT carried no name claim.
  let current = existing;
  if (trusted.name && (current.name === subject || !current.name.trim())) {
    await ctx.db.patch(current._id, { name: trusted.name });
    current = (await ctx.db.get(current._id))!;
  }

  return await reconcileExistingAccess(ctx, current, trusted.isSuperAdmin, canonicalForReconcile);
}

export async function provisionUser(
  ctx: MutationCtx,
  verified?: { email?: string | null; name?: string | null },
): Promise<CurrentUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  // ---- Trusted identity attributes ------------------------------------
  // Clerk's default session-token claims contain only `sub`/`sid` - email and
  // name are NOT default claims. When the Clerk "convex" JWT template is not
  // configured with those claims, `identity.email` is undefined and the
  // historical code path silently inserted a brand-new user with a
  // `<subject>@unknown.local` email and EMPTY roles, stranding an invited
  // client's site assignments on their `pending:<email>` invitation record.
  //
  // Trusted sources, in order:
  //   1. a server-side verified email/name passed by `users.provisionMeVerified`
  //      (the action looked the Clerk user up in the Backend API when the JWT
  //      carried no email claim), or
  //   2. the identity's own email/name claims (verified by Clerk at sign-in).
  // A pending invitation is ONLY ever rebound from one of those two sources -
  // a claimless self-signup can never claim another person's invitation.
  const trustedEmail = (verified?.email ?? identity.email)?.trim().toLowerCase() ?? null;
  const trustedName = (verified?.name ?? "").trim() || null;
  const identityHasRealEmail = !!trustedEmail && !trustedEmail.endsWith("@unknown.local");

  const rawEmail = trustedEmail ?? `${identity.subject.toLowerCase()}@unknown.local`;
  const {
    normalizedEmail,
    canonicalSuperAdminEmail,
    isSuperAdmin,
    isInternalQa,
  } = accessFlagsForIdentity(rawEmail, identity.subject);
  const email = isSuperAdmin ? canonicalSuperAdminEmail : normalizedEmail;

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (existing) {
    return await reconcileExistingUser(ctx, identity.subject, existing, {
      email: trustedEmail,
      name: trustedName,
      hasRealEmail: identityHasRealEmail,
      isSuperAdmin,
      canonicalEmail: email,
    });
  }

  // ---- First-login reconciliation -------------------------------------
  // All pending invitation records (clerkUserId "pending:<email>"). There are
  // normally only a handful in the table, so a full scan is safe and never
  // relies on the identity carrying an email claim.
  const pendingUsers = (await ctx.db.query("users").collect()).filter((candidate) =>
    candidate.clerkUserId.startsWith("pending:"),
  );

  let claimablePending: CurrentUser | null = null;
  if (identityHasRealEmail) {
    // Exact-match the trusted email against pending invitations. Matching
    // more than one pending record with the same email is a data-integrity
    // error: fail safely rather than guess which invitation this person owns.
    const matches = pendingUsers.filter((candidate) => candidate.email === trustedEmail);
    if (matches.length > 1) {
      throw new Error(
        "Account configuration error: multiple pending invitations exist for this email address. Contact your administrator.",
      );
    }
    claimablePending = matches[0] ?? null;
  }

  // Orphan fallback records for this subject: users previously auto-created
  // from claimless sign-ins, recognizable by their `<subject>@unknown.local`
  // email. A record carrying this subject was already handled by the
  // by_clerk_user_id lookup above, so finding any here means detached data -
  // fail safely instead of guessing.
  const fallbackEmail = `${identity.subject.toLowerCase()}@unknown.local`;
  const orphanUsers = (await ctx.db.query("users").collect()).filter(
    (candidate) => candidate.email === fallbackEmail,
  );
  if (orphanUsers.length > 1) {
    throw new Error(
      "Account configuration error: multiple fallback user records exist for this sign-in identity. Contact your administrator.",
    );
  }
  const orphan = orphanUsers[0] ?? null;

  // ---- Orphan + invitation merge --------------------------------------
  // The orphan row (empty roles, fallback email) and the pending invitation
  // row (real roles, real email) describe the same human. Rebind the
  // invitation to the real Clerk subject, preserving the invitation's
  // roles/active status/invitation history, and retire the orphan row.
  if (orphan && claimablePending && orphan._id !== claimablePending._id) {
    if (!claimablePending.isActive) throw new Error("Account is deactivated");
    const orphanRoles = orphan.roles ?? [];
    const mergedRoles = [
      ...(claimablePending.roles ?? []).filter(
        (r) => !orphanRoles.some((o) => String(o.siteId) === String(r.siteId)),
      ),
      ...orphanRoles,
    ];
    await ctx.db.patch(claimablePending._id, {
      clerkUserId: identity.subject,
      email: claimablePending.email,
      isSuperAdmin: false,
      roles: mergedRoles,
    });
    await ctx.db.delete(orphan._id);
    console.warn(
      "[TAYA provision] merged a claimless orphan user into its pending invitation",
      {
        subject: identity.subject,
        email: claimablePending.email,
        retiredOrphanId: orphan._id,
        keptUserId: claimablePending._id,
      },
    );
    const rebound = (await ctx.db.get(claimablePending._id))!;
    return await ensureInternalQaRoles(ctx, rebound);
  }

  // ---- Normal invited-client first login ------------------------------
  // No orphan row exists. If the trusted email matches exactly one pending
  // invitation, rebind it - preserving site assignments, role, active status,
  // and invitation history - without creating a duplicate user.
  if (claimablePending && !orphan) {
    if (!claimablePending.isActive) throw new Error("Account is deactivated");
    await ctx.db.patch(claimablePending._id, {
      clerkUserId: identity.subject,
      isSuperAdmin,
    });
    const connected = (await ctx.db.get(claimablePending._id))!;
    return await ensureInternalQaRoles(ctx, connected);
  }

  const emailMatchedUser = identityHasRealEmail
    ? await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", trustedEmail!))
        .first()
    : null;

  // Recovery for an FSTS owner account after a Clerk instance/domain migration.
  // A trusted Clerk JWT plus an explicit SUPERADMIN_EMAILS or
  // SUPERADMIN_CLERK_USER_IDS allowlist entry is required before an existing
  // owner account may be rebound to a new Clerk subject. Normal client accounts
  // are never rebound this way.
  if (
    emailMatchedUser &&
    isSuperAdmin &&
    emailMatchedUser.clerkUserId !== identity.subject
  ) {
    if (!emailMatchedUser.isActive) throw new Error("Account is deactivated");
    await ctx.db.patch(emailMatchedUser._id, {
      clerkUserId: identity.subject,
      isSuperAdmin: true,
      email,
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

  // Ambiguity guard (no usable email claim): if there are multiple pending
  // invitations and none could be attributed to this identity, fail safely
  // instead of creating an empty duplicate user. The administrator must
  // reconcile the invitation records first.
  if (!identityHasRealEmail && pendingUsers.length > 1 && !isSuperAdmin) {
    throw new Error(
      "Account configuration error: sign-in identity has no verified email and multiple pending invitations exist. Contact your administrator to link this account.",
    );
  }

  // Nothing could be verified for this sign-in and no invitation is claimable.
  // Log loudly so the operator fixes the configuration (CLERK_SECRET_KEY for
  // server-side verification, or the email claim in the Clerk "convex" JWT
  // template) instead of silently accumulating anonymous records.
  if (!identityHasRealEmail && !isSuperAdmin) {
    console.error(
      "[TAYA provision] provisioning without a trusted email claim - configure CLERK_SECRET_KEY (server-side verification) or add the email claim to the Clerk convex JWT template",
      { subject: identity.subject, pendingInvitations: pendingUsers.length },
    );
  }

  const name =
    trustedName ||
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
