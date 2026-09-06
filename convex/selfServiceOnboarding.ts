import { query, mutation, action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { provisionUser } from "./lib/getCurrentUser";
import { logActivity } from "./lib/logActivity";
import {
  slugify,
  resolveUniqueSlug,
  defaultModules,
  insertSiteWithSeedContent,
  normalizeDomain,
  slugFromDomain,
} from "./lib/siteProvisioning";

/**
 * CLIENT SELF-SERVICE ONBOARDING (spec §1–§3, §13, §14).
 *
 * The audit that preceded this module found that onboarding was 100%
 * superadmin-driven: a client who signed up through /sign-up landed on /app
 * with zero site roles and a dead-end "workspace has not been assigned yet"
 * message, and the owner had to run the wizard + sites.create + assignClient
 * + clerkInvitations.invite by hand — exactly the manual second step spec §1
 * forbids ("The owner must NEVER need to manually: ... manually assign the
 * site after client signup").
 *
 * This module closes that gap with ONE transaction:
 *
 *   1. Client authenticates through Clerk (identity is the Clerk subject,
 *      read SERVER-SIDE — never a client-supplied email).
 *   2. provisionUser reconciles/creates the ONE canonical TAYA user for that
 *      subject (invitations rebind, orphan merge — unchanged engine).
 *   3. Client confirms name, company, website URL (+ optional type).
 *   4. provisionSite creates or reuses ONE canonical site, binds the caller
 *      as its owner, and validates the assignment — all in one mutation, so
 *      the client can never be left half-attached.
 *   5. The client immediately lands in their own website workspace (§13:
 *      single-site auto-open already exists in SitesList).
 *
 * Identity authority is ALWAYS the Clerk subject (§2). The client-supplied
 * email is only used to label the record when the identity carries none —
 * never to decide access.
 *
 * Idempotency (§3): a re-run with the same inputs returns the existing site
 * ("reused"); no duplicate users/sites/roles/invitations/orphans. A slug or
 * domain that collides with ANOTHER tenant's site is a safe-stop error that
 * surfaces an admin warning — never a silent rewrite of another client's
 * assignment.
 */

export type OnboardingStatus = {
  hasUser: boolean;
  isSuperAdmin: boolean;
  hasSites: boolean;
  siteCount: number;
  /** True when the caller may run provisionSite (zero site roles, not a superadmin). */
  canSelfProvision: boolean;
  /** The authenticated Clerk subject — identity authority (§2). */
  subject: string | null;
};

export const status = query({
  args: {},
  handler: async (ctx): Promise<OnboardingStatus> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        hasUser: false,
        isSuperAdmin: false,
        hasSites: false,
        siteCount: 0,
        canSelfProvision: false,
        subject: null,
      };
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) {
      return {
        hasUser: false,
        isSuperAdmin: false,
        hasSites: false,
        siteCount: 0,
        canSelfProvision: false,
        subject: identity.subject,
      };
    }
    const liveSites = (await ctx.db.query("sites").collect()).filter(
      (s: any) => s.status !== "archived",
    );
    const mySiteIds = new Set(user.roles.map((r: any) => String(r.siteId)));
    const mySiteCount = liveSites.filter((s: any) => mySiteIds.has(String(s._id))).length;
    return {
      hasUser: true,
      isSuperAdmin: !!user.isSuperAdmin,
      hasSites: mySiteCount > 0,
      siteCount: mySiteCount,
      canSelfProvision:
        !user.isSuperAdmin &&
        !!user.isActive &&
        user.roles.filter((r: any) => r.role !== "internal_qa").length === 0,
      subject: identity.subject,
    };
  },
});

export type ProvisionSiteResult = {
  outcome: "created" | "reused";
  siteId: any;
  slug: string;
  domain: string | null;
  nextStep: "workspace";
};

/**
 * The ONE-TRANSACTION client onboarding mutation (spec §1 steps 3–9).
 *
 * Creates or reuses ONE canonical site and binds the caller as its owner in
 * a single Convex transaction.
 *
 * SECURITY (§2 — identity authority): the email is NOT an input. By the time
 * the client reaches this mutation, AuthBootstrap has already run
 * `users.provisionMeVerified`, which resolves the account email from the
 * Clerk JWT claim or a server-side Clerk Backend API lookup (CLERK_SECRET_KEY)
 * — never from anything the client typed. Letting a client supply an email
 * here would let them claim another person's pending invitation; the email
 * therefore never crosses this boundary.
 */
export const provisionSite = mutation({
  args: {
    name: v.string(),
    company: v.string(),
    websiteUrl: v.string(),
    websiteType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ProvisionSiteResult> => {
    // Step 1–2: identity is the Clerk subject, read server-side. provisionUser
    // reconciles/creates the ONE canonical user (pending invitations rebind,
    // orphan merge, ambiguity fail-safes — the existing engine, unchanged,
    // and fed ONLY identity claims here — no client-supplied data).
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await provisionUser(ctx);

    // Superadmins administer sites through the existing admin paths.
    if (user.isSuperAdmin) {
      throw new Error(
        "SuperAdmin accounts onboard client sites through the admin tools, not self-service onboarding.",
      );
    }
    if (!user.isActive) throw new Error("Account is deactivated");

    // ── Idempotency: an existing site role means onboarding already ran ──
    // (§3: re-run → REUSE, never a duplicate). Roles granted to an invited
    // client through the admin path are returned untouched — the owner-role
    // site takes precedence, then the first assigned site.
    const nonQaRoles = user.roles.filter((r: any) => r.role !== "internal_qa");
    if (nonQaRoles.length > 0) {
      const ownerRole = nonQaRoles.find((r: any) => r.role === "owner");
      const roleId = (ownerRole ?? nonQaRoles[0]).siteId;
      const site = await ctx.db.get(roleId);
      if (site) {
        return {
          outcome: "reused",
          siteId: site._id,
          slug: site.slug,
          domain: site.domain ?? null,
          nextStep: "workspace",
        };
      }
    }

    const name = args.name.trim();
    const company = args.company.trim();
    const websiteUrl = args.websiteUrl.trim();
    if (!name) throw new Error("Your name is required.");
    if (!company) throw new Error("Your company or business name is required.");
    if (!websiteUrl) throw new Error("Your website URL is required.");

    // ── Domain + slug derivation (P4 conventions, shared lib) ────────────
    const domain = normalizeDomain(websiteUrl);
    if (!domain || !domain.includes(".")) {
      throw new Error(
        "That website address does not look valid. Enter your site's full URL (e.g. https://www.acme.com).",
      );
    }

    // A domain that belongs to ANOTHER tenant's site is a conflict: safe-stop
    // with an admin warning. Never silently claim or rewrite the other
    // client's assignment (§3). Comparison is on the BARE domain (www. is
    // stripped during normalization), so www/non-www variants of the same
    // website cannot create two tenant records for one real site.
    const allSites = await ctx.db.query("sites").collect();
    const normalizeForConflict = (raw: string) => {
      const bare = raw
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .replace(/[?#].*$/, "");
      return bare;
    };
    const domainOwner = allSites.find(
      (s: any) =>
        s.domain &&
        normalizeForConflict(String(s.domain)) === normalizeForConflict(domain),
    );
    if (domainOwner) {
      console.error("[TAYA selfServiceOnboarding] domain conflict — admin attention required", {
        requestedDomain: domain,
        requestedBy: user.email,
        existingSiteId: domainOwner._id,
        existingSiteSlug: domainOwner.slug,
      });
      throw new Error(
        `A TAYA workspace already exists for the website "${domain}". If this is your website, contact FSTS support to connect your existing workspace instead of creating a duplicate.`,
      );
    }

    // Slug derives from the domain (stable + P4-normalized). A slug collision
    // with another tenant gets the standard -2 suffix (slug is a handle, not
    // an ownership claim) — except when the caller already owns a site with
    // that slug, which the idempotency branch above returned.
    const baseSlug = slugFromDomain(domain) || slugify(company) || "new-site";
    const slug = await resolveUniqueSlug(ctx, baseSlug);

    const websiteType = args.websiteType?.trim() || "business_website";
    const enabledModules = defaultModules(websiteType);

    // ── ONE canonical site + full seed content (shared provisioning path) ─
    const { siteId } = await insertSiteWithSeedContent(ctx, {
      name: company,
      slug,
      status: "active",
      domain,
      websiteType,
      enabledModules,
    });

    // ── Bind owner role on the caller's OWN record (single transaction) ───
    // provisionUser already reconciled the canonical user, so this patch can
    // only add a role to the authenticated caller — never another client's.
    await ctx.db.patch(user._id, {
      roles: [...user.roles, { siteId, role: "owner" }],
    });

    // Keep the user record's display name in sync with what they confirmed.
    if (name && name !== user.name) {
      await ctx.db.patch(user._id, { name });
    }

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "site",
      page: "Self-Service Onboarding",
      details: `Client self-service onboarding: ${user.email} → ${slug} (${domain})`,
    });

    return {
      outcome: "created",
      siteId,
      slug,
      domain,
      nextStep: "workspace",
    };
  },
});

/**
 * ONBOARDING SELF-CERTIFICATION (spec §14).
 *
 * Verifies the invariants that must hold before TAYA shows "Setup Complete".
 * If any REQUIRED invariant fails, the action returns { complete: false }
 * with an actionable error — the UI must NOT say onboarding succeeded.
 *
 * The Phase 2 crawler will add discovery/publishing-mode checks; until then
 * those are reported as "pending_phase2" with explicit reasons (the spec
 * requires an explicit reason, never a silent pass).
 */
export const certify = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const checks: Array<{
      check: string;
      status: "pass" | "fail" | "pending_phase2";
      reason?: string;
    }> = [];

    // Query-side invariant verification runs in a read-only internal query.
    const core = await ctx.runQuery(internal.selfServiceOnboarding._certifyCore, {
      siteId,
    });

    for (const [check, passed] of [
      ["clerk_user_exists", core.identityPresent],
      ["convex_user_exists", core.userPresent],
      ["subject_ids_match", core.subjectMatch],
      ["site_exists", core.sitePresent],
      ["owner_role_references_site", core.ownerRoleValid],
      ["no_unauthorized_site_roles", core.noUnauthorizedRoles],
    ] as const) {
      checks.push({
        check,
        status: passed ? "pass" : "fail",
        ...(passed ? {} : { reason: "See the failing invariant above." }),
      });
    }

    // Domain resolution — a live network check (actions are the only place
    // it is allowed). Failures are reported, not thrown, so the caller gets
    // the full picture.
    const site = core.site;
    let domainResolves: boolean | null = null;
    let domainReason: string | undefined;
    if (!site?.domain) {
      domainResolves = null;
      domainReason = "No domain recorded on the site yet.";
    } else {
      try {
        const response = await fetch(`https://${site.domain}`, {
          method: "HEAD",
          redirect: "follow",
        });
        domainResolves = response.ok;
        if (!response.ok) {
          domainReason = `https://${site.domain} responded ${response.status}.`;
        }
      } catch (error: any) {
        domainResolves = false;
        domainReason = `Could not reach https://${site.domain}: ${error?.message ?? "network error"}`;
      }
    }
    checks.push({
      check: "site_domain_resolves",
      status: domainResolves === null ? "pending_phase2" : domainResolves ? "pass" : "fail",
      ...(domainReason ? { reason: domainReason } : {}),
    });

    // Phase 2 hooks — explicit reasons until the crawler ships (§14: never a
    // silent pass).
    checks.push({
      check: "page_discovery_completed",
      status: "pending_phase2",
      reason: "Discovery crawler ships in Phase 2; no discovery snapshot exists yet.",
    });
    checks.push({
      check: "visual_preview_responds",
      status: "pending_phase2",
      reason: "Visual preview ships in Phase 3; the workspace opens in the existing editor.",
    });
    checks.push({
      check: "publishing_mode_identified",
      status: "pending_phase2",
      reason: "Connection modes ship in Phase 2 (TAYA_NATIVE default until bridge detection).",
    });

    const required = [
      "clerk_user_exists",
      "convex_user_exists",
      "subject_ids_match",
      "site_exists",
      "owner_role_references_site",
      "no_unauthorized_site_roles",
      "site_domain_resolves",
    ];
    const failed = checks.filter(
      (c) => c.status === "fail" && required.includes(c.check),
    );

    return {
      complete: failed.length === 0,
      checks,
      siteId,
      ...(failed.length > 0
        ? {
            error: `Setup is not complete: ${failed
              .map((c) => `${c.check} (${c.reason ?? "failed"})`)
              .join("; ")}. Contact FSTS support if any check keeps failing.`,
          }
        : {}),
    };
  },
});

/** Internal query used by the certify action to verify DB invariants. */
export const _certifyCore = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const identityPresent = !!identity;
    const user = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
          .first()
      : null;
    const site = await ctx.db.get(siteId);

    const ownerRoleValid = !!(
      user &&
      site &&
      user.roles.some(
        (r: any) => String(r.siteId) === String(siteId) && r.role === "owner",
      )
    );

    // §14: the user must hold NO roles on sites other than their own (the
    // internal_qa role is platform-internal, not tenant access).
    const unauthorized = user
      ? user.roles.filter(
          (r: any) => r.role !== "internal_qa" && String(r.siteId) !== String(siteId),
        )
      : [];

    return {
      identityPresent,
      userPresent: !!user,
      subjectMatch: !!user && !!identity && user.clerkUserId === identity.subject,
      sitePresent: !!site,
      ownerRoleValid,
      noUnauthorizedRoles: unauthorized.length === 0,
      site: site
        ? { _id: site._id, name: site.name, slug: site.slug, domain: site.domain ?? null }
        : null,
    };
  },
});
