import { mutation, query } from "../_generated/server";

/**
 * One-off production repair for the swapped Clerk identity bindings (P11).
 *
 * Background: the earlier repair migration (repairInvitedClientRecords.ts)
 * paired the two claimless orphan Clerk IDs with the WRONG invitations. The
 * owner reported the defect live on 2026-09-06: signing in to the FSTS
 * website as cdweemsbey@gmail.com opened the Corsair Tactical Solutions
 * workspace. A user-assisted live login proved the ground truth:
 *
 *   cdweemsbey@gmail.com  → Clerk user_3IqPwkRg7oeRLHcCRv0N4yxlMRs (FSTS)
 *   corsairtacticalsolutions@gmail.com → user_3IsuGrs6vmVY9rDYlZ86SZn7l9k (Corsair)
 *
 * …but production binds those IDs to the opposite records:
 *
 *   Corsair record (owner+content_editor on corsair site) ← user_3IqPwkRg ❌
 *   FSTS record (owner on fsts site)                      ← user_3IsuGrs6 ❌
 *
 * The roles per record are CORRECT; only the clerkUserId pairing is swapped.
 * This migration swaps the two clerkUserId values — nothing else. Record IDs,
 * roles, names, emails, invitation history and every FK reference stay
 * untouched, so no other table needs repair.
 *
 * Canonical mappings (owner-verified, live-proven — DO NOT OVERWRITE):
 *   FSTS client:
 *     email cdweemsbey@gmail.com, Clerk user_3IqPwkRg7oeRLHcCRv0N4yxlMRs,
 *     site qd74hpd1vk391fkpy797xk7dzh8drmz9 (slug httpswwwfstacktsolutionscom)
 *   Corsair client:
 *     email corsairtacticalsolutions@gmail.com, Clerk user_3IsuGrs6vmVY9rDYlZ86SZn7l9k,
 *     site qd7cpjk68m0z4rme5hw4sqgeys8bk1zc (slug corsair-tactical-solutions)
 *
 * Safety:
 *   - Refuses to run unless production exactly matches the audited
 *     SWAPPED state (both records present, emails + roles + sites match,
 *     bindings crosswise). Cannot misfire on repaired or foreign data.
 *   - Idempotent: a second run is a no-op reporting "already canonical".
 *   - Auditable: `audit` returns the pre-swap binding map; `swap` returns
 *     the exact mutations performed plus a post-swap dump.
 *   - Only clerkUserId fields are written; two patch() calls total.
 */

// Canonical identities (owner-verified 2026-09-06; matches live login proof).
const FSTS_CLERK = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const FSTS_EMAIL = "cdweemsbey@gmail.com";
const FSTS_SITE_ID = "qd74hpd1vk391fkpy797xk7dzh8drmz9";
const CORSAIR_CLERK = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";
const CORSAIR_EMAIL = "corsairtacticalsolutions@gmail.com";
const CORSAIR_SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc";

const norm = (s: unknown) =>
  typeof s === "string" ? s.trim().toLowerCase() : "";

/** Read-only audit of the exact state this migration repairs. */
export const audit = query({
  args: {},
  handler: async (ctx) => {
    const users: any[] = await ctx.db.query("users").collect();
    const fsts = users.find((u: any) => norm(u.email) === FSTS_EMAIL);
    const corsair = users.find((u: any) => norm(u.email) === CORSAIR_EMAIL);
    return {
      totalUsers: users.length,
      fstsRecord: fsts
        ? {
            id: fsts._id,
            clerkUserId: fsts.clerkUserId,
            email: fsts.email,
            roles: fsts.roles ?? [],
          }
        : null,
      corsairRecord: corsair
        ? {
            id: corsair._id,
            clerkUserId: corsair.clerkUserId,
            email: corsair.email,
            roles: corsair.roles ?? [],
          }
        : null,
      state:
        fsts && corsair
          ? fsts.clerkUserId === CORSAIR_CLERK &&
              corsair.clerkUserId === FSTS_CLERK
            ? "swapped"
            : fsts.clerkUserId === FSTS_CLERK &&
                corsair.clerkUserId === CORSAIR_CLERK
              ? "canonical"
              : "unknown"
          : "missing-records",
    };
  },
});

/**
 * Guarded idempotent swap. Refuses to run unless the current state is exactly
 * the audited SWAPPED production state (records present, roles/sites correct,
 * bindings crosswise), so it cannot misfire on a different deployment or on
 * already-repaired data. Second run reports "alreadyCanonical".
 */
export const swap = mutation({
  args: {},
  handler: async (ctx) => {
    const users: any[] = await ctx.db.query("users").collect();
    const fsts = users.find((u: any) => norm(u.email) === FSTS_EMAIL);
    const corsair = users.find((u: any) => norm(u.email) === CORSAIR_EMAIL);

    if (!fsts || !corsair) {
      throw new Error(
        `swapSwappedClientBindings: expected records for ${FSTS_EMAIL} and ${CORSAIR_EMAIL}`,
      );
    }

    // Idempotent no-op: bindings are already canonical.
    if (fsts.clerkUserId === FSTS_CLERK && corsair.clerkUserId === CORSAIR_CLERK) {
      return {
        status: "alreadyCanonical",
        swapped: 0,
        postSwap: await auditState(ctx),
      };
    }

    // Guard: must be exactly the audited swapped state. Also verify the roles
    // and site bindings are the correct (canonical) ones, so a swap can never
    // hand a stranger access to the wrong tenant.
    const fstsRolesOk =
      Array.isArray(fsts.roles) &&
      fsts.roles.some(
        (r: any) => String(r.siteId) === FSTS_SITE_ID && r.role === "owner",
      ) &&
      !fsts.roles.some((r: any) => String(r.siteId) === CORSAIR_SITE_ID);
    const corsairRolesOk =
      Array.isArray(corsair.roles) &&
      corsair.roles.some(
        (r: any) => String(r.siteId) === CORSAIR_SITE_ID && r.role === "owner",
      ) &&
      !corsair.roles.some((r: any) => String(r.siteId) === FSTS_SITE_ID);

    if (
      fsts.clerkUserId !== CORSAIR_CLERK ||
      corsair.clerkUserId !== FSTS_CLERK ||
      !fstsRolesOk ||
      !corsairRolesOk
    ) {
      throw new Error(
        `swapSwappedClientBindings: REFUSING — state does not match the audited swapped production state ` +
          `(fsts.clerkUserId=${fsts.clerkUserId}, corsair.clerkUserId=${corsair.clerkUserId}, ` +
          `fstsRolesOk=${fstsRolesOk}, corsairRolesOk=${corsairRolesOk}). ` +
          `No data was modified.`,
      );
    }

    // The swap: two targeted patch() calls — clerkUserId only.
    await ctx.db.patch(fsts._id, { clerkUserId: FSTS_CLERK });
    await ctx.db.patch(corsair._id, { clerkUserId: CORSAIR_CLERK });

    return {
      status: "swapped",
      swapped: 2,
      detail: {
        fstsRecord: String(fsts._id),
        fstsClerkBefore: CORSAIR_CLERK,
        fstsClerkAfter: FSTS_CLERK,
        corsairRecord: String(corsair._id),
        corsairClerkBefore: FSTS_CLERK,
        corsairClerkAfter: CORSAIR_CLERK,
      },
      postSwap: await auditState(ctx),
    };
  },
});

async function auditState(ctx: any) {
  const users: any[] = await ctx.db.query("users").collect();
  const fsts = users.find((u: any) => norm(u.email) === FSTS_EMAIL);
  const corsair = users.find((u: any) => norm(u.email) === CORSAIR_EMAIL);
  return {
    totalUsers: users.length,
    fstsRecord: fsts
      ? { id: String(fsts._id), clerkUserId: fsts.clerkUserId, email: fsts.email }
      : null,
    corsairRecord: corsair
      ? { id: String(corsair._id), clerkUserId: corsair.clerkUserId, email: corsair.email }
      : null,
    state:
      fsts && corsair
        ? fsts.clerkUserId === FSTS_CLERK && corsair.clerkUserId === CORSAIR_CLERK
          ? "canonical"
          : "swapped-or-unknown"
        : "missing-records",
  };
}
