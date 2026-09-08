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

    // ── Fire-and-forget auto-discovery (spec §4) ─────────────────────────
    // provisionSite always has an external domain (normalizeDomain enforces
    // it), so the read-only crawl always gets scheduled. The crawl is
    // READ-ONLY (§16) and never blocks provisioning — the snapshot lands
    // asynchronously and certify reports it as pending until then.
    await ctx.scheduler.runAfter(0, internal.discovery.run, {
      siteId,
      triggeredBy: user.email,
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
      status: "pass" | "fail" | "pending" | "pending_phase2";
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

    // Phase 2 checks — now backed by real discovery data (spec §4/§6/§14).
    // Discovery runs asynchronously after provisioning, so a missing
    // snapshot is a PENDING state with an explicit reason, never a silent
    // pass; a failed crawl likewise reports its failureReason verbatim.
    const discovery = core.discovery;
    if (!discovery) {
      checks.push({
        check: "page_discovery_completed",
        status: "pending",
        reason:
          "Discovery is running — no snapshot has been recorded yet. This resolves automatically.",
      });
    } else if (discovery.status === "completed") {
      checks.push({
        check: "page_discovery_completed",
        status: "pass",
        reason: `Crawled ${discovery.keyCount ?? "0"} stable content keys${discovery.kind === "refresh" ? " (latest refresh)" : ""}.`,
      });
    } else {
      checks.push({
        check: "page_discovery_completed",
        status: "fail",
        reason: discovery.failureReason ?? "The discovery crawl failed without a recorded reason.",
      });
    }

    checks.push({
      check: "visual_preview_responds",
      status: "pending_phase2",
      reason: "Visual preview ships in Phase 3; the workspace opens in the existing editor.",
    });

    // Spec §6: publishing mode. TAYA_NATIVE sites (no external domain) are
    // publish-ready through TAYA itself; a site with an external domain is
    // DISCOVERED_EXTERNAL once the crawl confirms it — draft-only until the
    // TAYA Web Bridge authorizes publishing (later Phase 2 slice).
    const siteMode = core.site?.connectionMode ?? null;
    if (siteMode) {
      checks.push({
        check: "publishing_mode_identified",
        status: "pass",
        reason:
          siteMode === "TAYA_NATIVE"
            ? "TAYA_NATIVE: the site is hosted by TAYA and publishes directly."
            : siteMode === "DISCOVERED_EXTERNAL"
              ? "DISCOVERED_EXTERNAL: the external site was discovered — publishing requires the TAYA Web Bridge (draft-only until connected)."
              : `Publishing mode recorded: ${siteMode}.`,
      });
    } else {
      checks.push({
        check: "publishing_mode_identified",
        status: "pending",
        reason:
          "Discovery is running — the connection mode is recorded once the crawl confirms the external site.",
      });
    }

    // —— PR-2 §7: workspace auto-conform + ownership verification ——————————————
    // Auto-conform (workspace_auto_conformed): TAYA_NATIVE sites get their
    // module UI from the provisioning config directly; DISCOVERED_EXTERNAL
    // sites get it from the discovery snapshot's conform plan, applied
    // atomically with the snapshot. A missing map is PENDING (crawl still
    // running), never a silent pass — and never a fail either, since the
    // workspace exists and drafting works regardless.
    const modeForConform = core.site?.connectionMode ?? null;
    const map = core.contentMap;
    if (modeForConform === "TAYA_NATIVE") {
      checks.push({
        check: "workspace_auto_conformed",
        status: "pass",
        reason:
          "TAYA_NATIVE: the workspace module UI comes from the provisioning config — no external conform needed.",
      });
    } else if (!map) {
      checks.push({
        check: "workspace_auto_conformed",
        status: "pending",
        reason:
          "Discovery is running — the workspace will be auto-conformed from the crawl snapshot when it lands. This resolves automatically.",
      });
    } else if (map.conformed) {
      checks.push({
        check: "workspace_auto_conformed",
        status: "pass",
        reason: `Workspace conformed to the discovered site — ${map.keyCount} content keys mapped.`,
      });
    } else {
      checks.push({
        check: "workspace_auto_conformed",
        status: "pending",
        reason:
          "The discovery snapshot is recorded but the conform plan was not applied. Re-run discovery from the workspace.",
      });
    }

    // Ownership verification state (ownership_verification_state): the
    // publish gate is server-side (convex/publishing.ts), and an unverified
    // DISCOVERED_EXTERNAL site is draft-only BY DESIGN — so unverified /
    // verification_pending are PENDING with explicit reasons, never a fail
    // (publishing is not expected yet). Verified sites pass. TAYA_NATIVE
    // sites have nothing external to verify, so they pass with a native
    // reason. Publishing remains server-blocked until this check passes.
    const ownership = core.ownership;
    const modeForOwnership = core.site?.connectionMode ?? null;
    if (modeForOwnership === "TAYA_NATIVE") {
      checks.push({
        check: "ownership_verification_state",
        status: "pass",
        reason:
          "TAYA_NATIVE: the site is hosted by TAYA — no external ownership proof is needed to publish.",
      });
    } else if (modeForOwnership === "TAYA_CONNECTED") {
      checks.push({
        check: "ownership_verification_state",
        status: "pass",
        reason:
          "TAYA_CONNECTED: ownership is verified and publishing is unlocked server-side.",
      });
    } else if (!ownership || ownership.state === "unverified") {
      checks.push({
        check: "ownership_verification_state",
        status: "pending",
        reason:
          "Publishing is blocked until you verify ownership — open Site Verification in your workspace and add the one-line token to your site or DNS. Drafting and preview work right now.",
      });
    } else if (ownership.state === "verification_pending") {
      checks.push({
        check: "ownership_verification_state",
        status: "pending",
        reason:
          "Ownership verification is in progress — run “Check now” in Site Verification once the token is visible on your domain.",
      });
    } else if (ownership.state === "verified") {
      checks.push({
        check: "ownership_verification_state",
        status: "pass",
        reason: `Ownership verified via ${ownership.method ?? "bridge"} at ${new Date(
          ownership.verifiedAt ?? 0,
        ).toISOString()}.`,
      });
    } else {
      checks.push({
        check: "ownership_verification_state",
        status: "pending",
        reason: `Ownership verification state: ${ownership.state}.`,
      });
    }

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

    // §16: latest discovery snapshot (the read-only crawl outcome the
    // page_discovery_completed check reports on).
    const latestSnapshot = await ctx.db
      .query("discoverySnapshots")
      .withIndex("by_site_startedAt", (q: any) => q.eq("siteId", siteId))
      .order("desc")
      .first();

    // PR-2 §7: the durable §5 page/content map (workspace_auto_conformed)
    // and the ownership verification sub-document (ownership_verification_state).
    const contentMap = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .first();

    return {
      identityPresent,
      userPresent: !!user,
      subjectMatch: !!user && !!identity && user.clerkUserId === identity.subject,
      sitePresent: !!site,
      ownerRoleValid,
      noUnauthorizedRoles: unauthorized.length === 0,
      site: site
        ? {
            _id: site._id,
            name: site.name,
            slug: site.slug,
            domain: site.domain ?? null,
            // Spec §6: connection mode (TAYA_NATIVE at provisioning or
            // DISCOVERED_EXTERNAL once the crawl confirmed an external site).
            connectionMode: (site as any).connectionMode ?? null,
          }
        : null,
      discovery: latestSnapshot
        ? {
            kind: latestSnapshot.kind,
            status: latestSnapshot.status,
            keyCount: (latestSnapshot as any).report?.keyCount ?? 0,
            failureReason: (latestSnapshot as any).failureReason ?? null,
          }
        : null,
      // PR-2 §7: auto-conform + ownership surfaces for the new checks.
      contentMap: contentMap
        ? {
            keyCount: contentMap.keyCount ?? 0,
            conformed: contentMap.conformed ?? false,
            builtFromSnapshotAt: (contentMap as any).builtFromSnapshotAt ?? null,
            refreshedAt: (contentMap as any).refreshedAt ?? null,
          }
        : null,
      ownership: site
        ? {
            state: ((site as any).ownershipVerification?.state as string | undefined) ?? "unverified",
            method:
              ((site as any).ownershipVerification?.method as string | undefined) ?? null,
            verifiedAt: ((site as any).ownershipVerification?.verifiedAt as number | undefined) ?? null,
          }
        : null,
    };
  },
});
