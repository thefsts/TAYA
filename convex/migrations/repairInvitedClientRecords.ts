import { mutation, query } from "../_generated/server";

/**
 * One-off production repair for the "invited client signs in but sees no site"
 * defect (P1/P2 in the production-repair roadmap).
 *
 * Background: production Clerk "convex" JWT template carried no email claim,
 * so early client sign-ins provisioned orphan user rows
 * (`<subject>@unknown.local`, empty roles) while the invited client's real
 * roles stayed stranded on their admin-created `pending:<email>` invitation
 * records. P1 shipped `users.provisionMeVerified`, which reconciles this
 * automatically when a trusted email is available (JWT claim or Clerk Backend
 * API with CLERK_SECRET_KEY). Production Convex env currently lacks
 * CLERK_SECRET_KEY, so until the owner configures it (or adds the email claim
 * to the JWT template) the automatic path is claimless and cannot claim the
 * invitations — this migration performs the same rebind manually so clients
 * see their site on the very next sign-in.
 *
 * Audited production state this repair targets (fresh inline-query dump):
 *   - Corsair orphan: clerkUserId user_3IqPwkRg7oeRLHcCRv0N4yxlMRs,
 *     email user_3iqpwkrg…@unknown.local, roles [] (row rd7e3q212nhrhpfm8k29hjarjd8drq4f)
 *   - Corsair invitation: pending:corsairtacticalsolutions@gmail.com, roles
 *     owner+content_editor on corsair-tactical-solutions, isActive FALSE (defect)
 *   - FSTS orphan: clerkUserId user_3IsuGrs6vmVY9rDYlZ86SZn7l9k, email
 *     user_3isugrs…@unknown.local, roles [] (row rd7btan6y1a4k3acfe9bqeg9918dr0r1)
 *   - FSTS invitation: pending:cdweemsbey@gmail.com, role owner on the FSTS
 *     site, inviteStatus "failed" + invitationLastError "Server Error"
 *   - Justin QA: stale internal_qa role for deleted site
 *     qd71sbs6m0q215ehvdw9gbvkcn8brk1e (only 2 sites exist in production)
 *
 * Records are located by STATE (clerk id / pending email / email suffix), not
 * by row id, so the repair is robust to row re-creation and fully covered by
 * unit tests on the in-memory backend.
 *
 * Safety:
 *   - Idempotent: every patch is guarded by the record's CURRENT state; a
 *     second run is a no-op that reports already-repaired state.
 *   - Reference-safe: the only schema FK to users is
 *     siteAddOns.enabledByUserId (optional); verified 0 references to either
 *     orphan row before writing this migration.
 *   - No roles are invented: orphan roles are carried over; the invitation's
 *     admin-assigned roles are preserved exactly.
 *   - Refuses to run when preconditions do not match the audited state, so it
 *     cannot misfire on a different deployment or on repaired data.
 *   - Auditable: `audit` returns the pre-repair state for every touched row;
 *     `repair` returns the exact mutations performed plus a post-repair dump.
 */

// Production identities (verified against a fresh production dump).
const CORSAIR_INVITE_CLERK = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const CORSAIR_INVITE_EMAIL = "corsairtacticalsolutions@gmail.com";
const FSTS_INVITE_CLERK = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";
const FSTS_INVITE_EMAIL = "cdweemsbey@gmail.com";
const CORSAIR_SITE_SLUG = "corsair-tactical-solutions";
const FSTS_SITE_SLUG = "httpswwwfstacktsolutionscom";
const STALE_SITE_ID = "qd71sbs6m0q215ehvdw9gbvkcn8brk1e";
const JUSTIN_EMAIL = "justinthomas4@gmail.com";

/** Read-only audit of the exact state this migration repairs. */
export const audit = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const sites = await ctx.db.query("sites").collect();
    const siteIds = new Set(sites.map((s) => String(s._id)));
    const usersByClerk = new Map(users.map((u) => [u.clerkUserId, u]));
    const sitesBySlug = new Map(sites.map((s) => [s.slug, s]));

    const isOrphan = (u: any) =>
      typeof u.email === "string" &&
      u.email.trim().toLowerCase().endsWith("@unknown.local");

    const corsairOrphans = users.filter(
      (u) => u.clerkUserId === CORSAIR_INVITE_CLERK && isOrphan(u),
    );
    const fstsOrphans = users.filter(
      (u) => u.clerkUserId === FSTS_INVITE_CLERK && isOrphan(u),
    );
    const corsairInvite = usersByClerk.get(`pending:${CORSAIR_INVITE_EMAIL}`);
    const fstsInvite = usersByClerk.get(`pending:${FSTS_INVITE_EMAIL}`);
    const justin = users.find(
      (u) => u.email.trim().toLowerCase() === JUSTIN_EMAIL,
    );

    return {
      totalUsers: users.length,
      totalSites: sites.length,
      orphanCount: users.filter(isOrphan).length,
      corsair: {
        orphanCount: corsairOrphans.length,
        orphanEmails: corsairOrphans.map((u) => u.email),
        orphanRoles: corsairOrphans.map((u) => u.roles),
        invitationPresent: !!corsairInvite,
        invitationActive: corsairInvite?.isActive ?? null,
        invitationRoles: corsairInvite?.roles ?? null,
        corsairSiteId: sitesBySlug.get(CORSAIR_SITE_SLUG)?._id ?? null,
      },
      fsts: {
        orphanCount: fstsOrphans.length,
        orphanEmails: fstsOrphans.map((u) => u.email),
        orphanRoles: fstsOrphans.map((u) => u.roles),
        invitationPresent: !!fstsInvite,
        invitationRoles: fstsInvite?.roles ?? null,
        fstsSiteId: sitesBySlug.get(FSTS_SITE_SLUG)?._id ?? null,
      },
      justin: {
        present: !!justin,
        roles: justin?.roles ?? null,
        staleSiteRole:
          justin?.roles.find((r) => String(r.siteId) === STALE_SITE_ID) ??
          null,
        staleSiteExists: siteIds.has(STALE_SITE_ID),
      },
    };
  },
});

/**
 * Guarded idempotent repair. Refuses to run when the preconditions do not
 * match the audited production state (wrong site, wrong email, unexpected
 * identity binding), so it cannot misfire on a different deployment.
 */
export const repair = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const sites = await ctx.db.query("sites").collect();
    const siteIds = new Set(sites.map((s) => String(s._id)));
    const sitesBySlug = new Map(sites.map((s) => [s.slug, s]));
    const usersByClerk = new Map(users.map((u) => [u.clerkUserId, u]));

    const corsairSite = sitesBySlug.get(CORSAIR_SITE_SLUG);
    const fstsSite = sitesBySlug.get(FSTS_SITE_SLUG);
    if (!corsairSite) throw new Error(`${CORSAIR_SITE_SLUG} site not found`);
    if (!fstsSite) throw new Error(`${FSTS_SITE_SLUG} site not found`);

    const isOrphan = (u: any) =>
      typeof u.email === "string" &&
      u.email.trim().toLowerCase().endsWith("@unknown.local");

    const log: string[] = [];
    let patched = 0;
    let deleted = 0;

    // ---- 1+2: rebind the two pending invitations to their real Clerk users,
    // carrying over non-conflicting orphan roles, then retire the orphans.
    // (Activation of the deactivated Corsair invitation folds into step 1.)
    const specs = [
      {
        label: "corsair",
        clerkId: CORSAIR_INVITE_CLERK,
        email: CORSAIR_INVITE_EMAIL,
        expectedSiteId: String(corsairSite._id),
      },
      {
        label: "fsts",
        clerkId: FSTS_INVITE_CLERK,
        email: FSTS_INVITE_EMAIL,
        expectedSiteId: String(fstsSite._id),
      },
    ];

    for (const spec of specs) {
      const orphans = users.filter(
        (u) => u.clerkUserId === spec.clerkId && isOrphan(u),
      );
      const invite = usersByClerk.get(`pending:${spec.email}`);
      const alreadyBound = users.find(
        (u) => u.clerkUserId === spec.clerkId && !isOrphan(u),
      );

      // Already-repaired (idempotent no-op): the invitation (or its rebound
      // successor) carries the real Clerk id and no orphan row remains.
      if (alreadyBound && orphans.length === 0) {
        log.push(`${spec.label}: already repaired (bound, orphan retired)`);
        continue;
      }
      if (alreadyBound && orphans.length > 0) {
        // Defensive: a second orphan appeared post-repair. Retire it the same
        // way — it cannot own anything the bound record does not already own.
        for (const orphan of orphans) {
          await ctx.db.delete(orphan._id);
          deleted += 1;
          log.push(`${spec.label}: post-repair duplicate orphan retired`);
        }
        continue;
      }

      if (orphans.length !== 1 || !invite) {
        throw new Error(
          `Repair preconditions failed for ${spec.label}: expected exactly 1 orphan + 1 pending invitation, found ${orphans.length} orphan(s), invitation ${invite ? "present" : "missing"}. Run migrations/repairInvitedClientRecords:audit first.`,
        );
      }
      const orphan = orphans[0];
      if (invite.email.trim().toLowerCase() !== spec.email) {
        throw new Error(
          `Repair preconditions failed for ${spec.label}: invitation email is ${invite.email}, expected ${spec.email}.`,
        );
      }
      // The invitation must point at this spec's site (no cross-tenant rebind).
      if (
        !(invite.roles ?? []).some(
          (r) => String(r.siteId) === spec.expectedSiteId,
        )
      ) {
        throw new Error(
          `Repair preconditions failed for ${spec.label}: invitation does not reference site ${spec.expectedSiteId}.`,
        );
      }

      const orphanRoles = orphan.roles ?? [];
      const mergedRoles = [
        ...(invite.roles ?? []).filter(
          (r) => !orphanRoles.some((o) => String(o.siteId) === String(r.siteId)),
        ),
        ...orphanRoles,
      ];

      await ctx.db.patch(invite._id, {
        clerkUserId: spec.clerkId,
        roles: mergedRoles,
        isSuperAdmin: false,
        ...(invite.isActive ? {} : { isActive: true }),
      });
      patched += 1;
      log.push(
        `${spec.label}: invitation rebound to ${spec.clerkId} (roles: ${mergedRoles.map((r) => `${r.role}@${String(r.siteId).slice(0, 8)}`).join(", ") || "none"}${invite.isActive ? "" : "; activated"})`,
      );

      // Reference-safety: siteAddOns.enabledByUserId is the only schema FK to
      // users; verified 0 rows reference either orphan before this deploy.
      await ctx.db.delete(orphan._id);
      deleted += 1;
      log.push(`${spec.label}: orphan row retired`);
    }

    // ---- 3: strip Justin's provably-dangling roles (roles whose target site
    // no longer exists in the sites table). Safe by construction: a role is
    // only stripped when its siteId is absent from the sites table, so live
    // roles (e.g. internal_qa on corsair-tactical-solutions) are always kept
    // and the repair can never misfire on a deployment where the referenced
    // site still exists.
    const justin = users.find(
      (u) => u.email.trim().toLowerCase() === JUSTIN_EMAIL,
    );
    if (justin) {
      const roles = justin.roles ?? [];
      const kept = roles.filter((r) => siteIds.has(String(r.siteId)));
      const stripped = roles.length - kept.length;
      if (stripped > 0) {
        await ctx.db.patch(justin._id, { roles: kept });
        patched += 1;
        log.push(
          `justin: ${stripped} dangling role(s) stripped (${kept.length} live roles kept)`,
        );
      } else {
        log.push("justin: no dangling roles found (already clean)");
      }
    } else {
      log.push("justin: QA record not present — skipped");
    }

    const remainingUsers = await ctx.db.query("users").collect();
    const remainingOrphans = remainingUsers.filter(isOrphan);

    return {
      patched,
      deleted,
      log,
      postRepair: {
        totalUsers: remainingUsers.length,
        orphanCount: remainingOrphans.length,
        users: remainingUsers.map((u) => ({
          id: u._id,
          clerkUserId: u.clerkUserId,
          email: u.email,
          isActive: u.isActive,
          isSuperAdmin: u.isSuperAdmin,
          roles: u.roles,
        })),
      },
    };
  },
});
