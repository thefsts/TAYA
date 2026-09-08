import { mutation, query, action, internalQuery } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { provisionUser } from "../lib/getCurrentUser";
import {
  insertSiteWithSeedContent,
  defaultModules,
} from "../lib/siteProvisioning";
import { publishAuthorityFor, PUBLISH_BLOCKED_MESSAGE } from "../publishing";
import { ownershipState } from "../ownershipVerification";
import { logActivity } from "../lib/logActivity";

/**
 * thirdSiteProof -- guarded end-to-end proof harness for the S11 third-site
 * contract (PR-2, Phase 2).
 *
 * WHAT THIS IS. The spec requires the Web Bridge + ownership verification +
 * auto-conform pipeline to be proven on a REAL third site that TAYA did NOT
 * build -- the same treatment production clients get. This file is the
 * server-side driver for that proof: a step-wise walk of the EXISTING
 * production functions, in the exact order the dashboard runs them, with
 * the evidence recorded at every step. It adds no new capability -- every
 * step composes functions that already ship to production:
 *
 *   onboarding path    -> provisionUser + insertSiteWithSeedContent +
 *                         owner-role bind + scheduled discovery.run (the
 *                         same four writes provisionSite performs, in the
 *                         same order, with the same lib helpers)
 *   ownership flow     -> ownershipVerification.beginVerification /
 *                         checkVerification (the real network html-meta
 *                         check against the fixture's live homepage)
 *   publishing flow    -> publishing.saveDraft / publishContentMap. The
 *                         server-side ownership gate lives INSIDE
 *                         publishContentMap; this harness calls the REAL
 *                         public mutation AS the owner and PROVES it throws
 *                         while the site is unverified -- then proves the
 *                         identical call succeeds after verification.
 *   bridge surface     -> bridge._content -- exactly what
 *                         /api/bridge/content serves to the site's snippet.
 *
 * WHAT THIS IS NOT. It is not per-customer code: the bridge, the crawler,
 * the conform plan, the verification checks and the publish gate contain
 * zero customer names, and none of them import this file. This file names
 * the FIXTURE site only as its guard scope -- the one site it is allowed
 * to touch. It is deleted after certification.
 *
 * GUARD (swapSwappedClientBindings pattern). setup refuses to attach a
 * site to any user record that already holds site roles, and refuses when
 * the proof domain already belongs to a different site. Every other step
 * resolves the proof site by slug and fails closed (explicit error / null)
 * when it is absent. The preconditions on attemptDraft /
 * attemptPublishBlocked / publishAfterVerify refuse to run out of order
 * (an already-verified site proves nothing about the block). The harness
 * cannot misfire on a real tenant.
 *
 * IDENTITY. Every mutating step is driven with the SAME synthetic owner
 * through the Convex CLI's --identity flag, whose subject is taken
 * verbatim from the JSON, so provisionUser resolves the same canonical
 * user (by_clerk_user_id) on every step. Nested ctx.runMutation /
 * ctx.runAction calls forward that auth context, so the REAL public
 * mutations see the owner -- not a bypass. Each step echoes the identity
 * it ran as, so the transcript proves one consistent owner drove the walk.
 *
 * RUN SEQUENCE (production, after deploy; the fixture site must be live
 * first -- a controlled third-party static site TAYA did not build):
 *
 *   OWNER='{"subject":"proof-owner-taya-proof-site",
 *            "email":"proof-owner@thefsts.github.io",
 *            "name":"TAYA Proof Owner"}'
 *
 *   1. npx convex run migrations/thirdSiteProof:setup --prod
 *        ...discovery crawls the fixture asynchronously...
 *   2. npx convex run migrations/thirdSiteProof:check --prod
 *        ...want: snapshot completed, map keyCount > 0, proof keys present...
 *   3. npx convex run migrations/thirdSiteProof:attemptDraft --identity "$OWNER" --prod
 *   4. npx convex run migrations/thirdSiteProof:attemptPublishBlocked --identity "$OWNER" --prod
 *        ...want: blocked=true, error == PUBLISH_BLOCKED_MESSAGE...
 *   5. npx convex run migrations/thirdSiteProof:attachMetaVerification --identity "$OWNER" --prod
 *        ...put the returned token in the fixture's
 *        <meta name="taya-verification" content="..."> and redeploy it...
 *   6. npx convex run migrations/thirdSiteProof:runCheck --identity "$OWNER" --prod
 *        ...want: state=verified, connectionMode=TAYA_CONNECTED...
 *   7. npx convex run migrations/thirdSiteProof:publishAfterVerify --identity "$OWNER" --prod
 *   8. npx convex run migrations/thirdSiteProof:checkPublishedServed --prod
 *   9. curl "https://uncommon-cobra-336.convex.site/api/bridge/content?slug=taya-proof-site"
 *  10. Browser: the fixture's live pages render the PUBLISHED text via the
 *      bridge snippet it already carries.
 */

// ---------------------------------------------------------------------------
// Proof fixture identifiers -- the ONLY site and owner this harness touches.
// General production logic never references these.
// ---------------------------------------------------------------------------

const PROOF_SLUG = "taya-proof-site";
const PROOF_DOMAIN = "thefsts.github.io";
const PROOF_NAME = "TAYA Proof Studio";
const SYNTHETIC_OWNER_EMAIL = "proof-owner@thefsts.github.io";
const SYNTHETIC_OWNER_NAME = "TAYA Proof Owner";

/** The S5 hero keys the fixture site tags with data-taya-edit. */
const PROOF_KEYS = ["home.hero.heading", "home.hero.subheading"];

/** Draft values -- prove an UNVERIFIED external site can draft (S16). */
const PROOF_DRAFT_VALUES = [
  {
    key: "home.hero.heading",
    value:
      "Proof Draft Heading - publishing stays blocked until ownership is verified",
  },
  {
    key: "home.hero.subheading",
    value:
      "This draft line proves an unverified external site can draft, but not publish.",
  },
];

/** Published values -- what the bridge must serve after verification. */
const PROOF_PUBLISH_VALUES = [
  {
    key: "home.hero.heading",
    value:
      "TAYA Proof Studio - ownership verified, publishing enabled through the TAYA Web Bridge",
  },
  {
    key: "home.hero.subheading",
    value:
      "This line was drafted while unverified, blocked from publishing, verified with an html meta token, then published to the live site through the TAYA Web Bridge.",
  },
];

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------

const norm = (s: unknown) =>
  typeof s === "string" ? s.trim().toLowerCase() : "";

/** Find the proof site by slug -- the guard anchor for every step. */
async function proofSite(ctx: any) {
  return await ctx.db
    .query("sites")
    .withIndex("by_slug", (q: any) => q.eq("slug", PROOF_SLUG))
    .first();
}

/**
 * Internal reader: the proof site doc + its server-side publish authority.
 * ACTIONS have no ctx.db -- they resolve the proof site through this query
 * (the same pattern ownershipVerification uses for _verificationState).
 */
export const _proofSiteState = internalQuery({
  args: {},
  handler: async (ctx): Promise<any> => {
    const site = await proofSite(ctx);
    if (!site) return null;
    return { site, authority: publishAuthorityFor(site) };
  },
});

/** Fail closed when the proof site is absent (action contexts). */
async function requireProofSiteForAction(ctx: any, step: string) {
  const state = await ctx.runQuery(
    internal.migrations.thirdSiteProof._proofSiteState,
    {},
  );
  if (!state || !state.site) {
    throw new Error(
      `thirdSiteProof.${step}: proof site "${PROOF_SLUG}" not found -- run setup first. No data was modified.`,
    );
  }
  return state as { site: any; authority: any };
}

/** Require the synthetic owner's identity (supplied via --identity). */
async function requireOwnerIdentity(ctx: any, step: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error(
      `thirdSiteProof.${step}: run with --identity (the synthetic proof owner).`,
    );
  }
  return identity;
}

/** Best-effort error text from a nested function call (ConvexError data or message). */
function errorMessage(err: any): string {
  if (typeof err?.data === "string") return err.data;
  if (typeof err?.message === "string") return err.message;
  return String(err);
}

const identityEcho = (identity: any) => ({
  subject: identity?.subject ?? null,
  email: identity?.email ?? null,
  name: identity?.name ?? null,
});

// ---------------------------------------------------------------------------
// Step 1 -- setup (mutation): provision the proof site + synthetic owner and
// schedule auto-discovery, mirroring provisionSite's four writes exactly.
// ---------------------------------------------------------------------------

export const setup = mutation({
  args: {},
  handler: async (ctx): Promise<any> => {
    // Idempotent by slug: an existing proof site is reused, never recreated.
    const existing = await proofSite(ctx);
    if (existing) {
      return {
        proofStep: "setup",
        status: "reused",
        siteId: existing._id,
        slug: existing.slug,
        domain: existing.domain ?? null,
        connectionMode: (existing as any).connectionMode ?? null,
        note: "The proof site already exists -- the walk can resume at check.",
      };
    }

    // ---- The synthetic owner (the canonical creator, provisionUser). ----
    const identity = await requireOwnerIdentity(ctx, "setup");
    const user = await provisionUser(ctx, {
      email: SYNTHETIC_OWNER_EMAIL,
      name: SYNTHETIC_OWNER_NAME,
    });

    // ---- Guards: never attach to an existing tenant's user or site. ----
    const roles = (user as any).roles ?? [];
    if (roles.length > 0) {
      throw new Error(
        `thirdSiteProof.setup: REFUSING -- ${SYNTHETIC_OWNER_EMAIL} already holds ` +
          `${roles.length} site role(s). This harness must never attach a site to an ` +
          `existing tenant member. No data was modified.`,
      );
    }

    const domainOwner = (await ctx.db.query("sites").collect()).find(
      (s: any) => norm(s.domain) === norm(PROOF_DOMAIN),
    );
    if (domainOwner) {
      throw new Error(
        `thirdSiteProof.setup: REFUSING -- the proof domain ${PROOF_DOMAIN} already ` +
          `belongs to site ${domainOwner._id} (${domainOwner.slug}). No data was modified.`,
      );
    }

    // ---- The site: the same seed path as sites.create / provisionSite. ----
    const { siteId } = await insertSiteWithSeedContent(ctx, {
      name: PROOF_NAME,
      slug: PROOF_SLUG,
      status: "active",
      domain: PROOF_DOMAIN,
      websiteType: "business_website",
      enabledModules: defaultModules("business_website"),
    });

    // ---- Owner bind on the caller's OWN record (provisionSite pattern). ----
    await ctx.db.patch((user as any)._id, {
      roles: [...roles, { siteId, role: "owner" }],
    });

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "site",
      page: "Third-Site Proof",
      details: `Proof harness: provisioned the fixture site ${PROOF_SLUG} (${PROOF_DOMAIN}) for the S11 third-site walk.`,
    });

    // ---- Fire-and-forget auto-discovery (identical to provisionSite). ----
    await ctx.scheduler.runAfter(0, internal.discovery.run, {
      siteId,
      triggeredBy: user.email,
    });

    return {
      proofStep: "setup",
      status: "created",
      siteId,
      slug: PROOF_SLUG,
      domain: PROOF_DOMAIN,
      owner: { email: user.email, name: user.name },
      identity: identityEcho(identity),
      next: "run check after the crawl completes (usually < 1 minute).",
    };
  },
});

// ---------------------------------------------------------------------------
// Step 2 -- check (query, read-only): the mid-walk evidence snapshot --
// discovery snapshot, S5 page map, proof-key state, conform, mode and the
// server-side publish verdict. Safe to re-run at any point in the walk.
// ---------------------------------------------------------------------------

export const check = query({
  args: {},
  handler: async (ctx): Promise<any> => {
    const site = await proofSite(ctx);
    if (!site) {
      return {
        proofStep: "check",
        status: "not_provisioned",
        slug: PROOF_SLUG,
        next: "run setup (with --identity) first.",
      };
    }
    const siteId = site._id;

    const snapshot = await ctx.db
      .query("discoverySnapshots")
      .withIndex("by_site_startedAt", (q: any) => q.eq("siteId", siteId))
      .order("desc")
      .first();

    const map = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .first();

    const navItems = await ctx.db
      .query("navigationItems")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect();

    const entries: Record<string, any> = (map?.entries as any) ?? {};
    const proofKeyState: Record<string, any> = {};
    for (const key of PROOF_KEYS) proofKeyState[key] = entries[key] ?? null;

    const authority = publishAuthorityFor(site);

    return {
      proofStep: "check",
      site: {
        siteId,
        slug: site.slug,
        domain: site.domain ?? null,
        connectionMode: (site as any).connectionMode ?? null,
        detectedPlatform: (site as any).detectedPlatform ?? null,
        ownershipVerification: ownershipState(site),
      },
      discovery: snapshot
        ? {
            kind: snapshot.kind,
            status: snapshot.status,
            domain: snapshot.domain,
            failureReason: snapshot.failureReason ?? null,
            startedAt: snapshot.startedAt,
            completedAt: snapshot.completedAt ?? null,
          }
        : null,
      contentMap: map
        ? {
            version: map.version,
            domain: map.domain,
            keyCount: map.keyCount,
            conformed: (map as any).conformed ?? false,
            pages: (map.pages as any) ?? [],
            sampleKeys: Object.keys(entries).slice(0, 12),
          }
        : null,
      navigationItemCount: navItems.length,
      proofKeys: proofKeyState,
      publishAuthority: authority,
      verdict:
        map && snapshot?.status === "completed"
          ? "discovery complete -- run attemptDraft + attemptPublishBlocked (with --identity)"
          : "discovery pending -- re-run check until the snapshot completes",
    };
  },
});

// ---------------------------------------------------------------------------
// Step 3 -- attemptDraft (action, owner identity): the REAL public
// publishing.saveDraft while the site is unverified. S16: drafts are allowed
// in every mode -- this must SUCCEED.
// ---------------------------------------------------------------------------

export const attemptDraft = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const { site, authority: authorityBefore } = await requireProofSiteForAction(
      ctx,
      "attemptDraft",
    );
    const identity = await requireOwnerIdentity(ctx, "attemptDraft");

    // Precondition: the site must still be unverified/unpublishable --
    // drafting on an already-verified site proves nothing about S16.
    if (authorityBefore.canPublish) {
      throw new Error(
        `thirdSiteProof.attemptDraft: PRECONDITION FAILED -- ${PROOF_SLUG} is already ` +
          `publishable (${authorityBefore.connectionMode ?? "no mode"} / ` +
          `${authorityBefore.ownershipState}). This step must run BEFORE verification. No data was modified.`,
      );
    }

    // The REAL public mutation, as the owner -- not a reimplementation.
    const applied = await ctx.runMutation(api.publishing.saveDraft, {
      siteId: site._id,
      entries: PROOF_DRAFT_VALUES,
    });

    return {
      proofStep: "attemptDraft",
      expectation: "drafting succeeds while unverified (S16 draft-only world)",
      identity: identityEcho(identity),
      result: applied,
      draftedKeys: PROOF_KEYS,
      next: "run attemptPublishBlocked (with --identity) -- it MUST be blocked",
    };
  },
});

// ---------------------------------------------------------------------------
// Step 4 -- attemptPublishBlocked (action, owner identity): the REAL public
// publishing.publishContentMap while unverified. The server-side ownership
// gate lives INSIDE it -- this must THROW the exact S16 block message.
// ---------------------------------------------------------------------------

export const attemptPublishBlocked = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const { site, authority: authorityBefore } = await requireProofSiteForAction(
      ctx,
      "attemptPublishBlocked",
    );
    const identity = await requireOwnerIdentity(ctx, "attemptPublishBlocked");

    // Precondition: still unverified -- otherwise this step proves nothing.
    if (authorityBefore.canPublish) {
      throw new Error(
        `thirdSiteProof.attemptPublishBlocked: PRECONDITION FAILED -- ${PROOF_SLUG} is ` +
          `already publishable (${authorityBefore.connectionMode ?? "no mode"} / ` +
          `${authorityBefore.ownershipState}). This step must run BEFORE verification. No data was modified.`,
      );
    }

    // The REAL public mutation, as the owner. It MUST throw.
    let blocked: false | string = false;
    try {
      await ctx.runMutation(api.publishing.publishContentMap, {
        siteId: site._id,
        keys: PROOF_KEYS,
      });
    } catch (err: any) {
      blocked = errorMessage(err);
    }

    if (blocked === false) {
      return {
        proofStep: "attemptPublishBlocked",
        PROOF_FAILED: true,
        reason:
          "publishContentMap did NOT throw for an unverified external site -- the S16 server-side gate is broken.",
      };
    }

    const matches = blocked.includes(PUBLISH_BLOCKED_MESSAGE);

    return {
      proofStep: "attemptPublishBlocked",
      expectation:
        "publishContentMap throws the exact server-block message while unverified",
      identity: identityEcho(identity),
      blocked: true,
      error: blocked,
      matchesPUBLISH_BLOCKED_MESSAGE: matches,
      PROOF_FAILED: !matches,
      next:
        "run attachMetaVerification (with --identity), put the token in the fixture meta tag, then runCheck",
    };
  },
});

// ---------------------------------------------------------------------------
// Step 5 -- attachMetaVerification (action, owner identity): the REAL public
// ownershipVerification.beginVerification (html_meta_token). Mints the token,
// flips the site to verification_pending, returns the meta-tag instructions.
// ---------------------------------------------------------------------------

export const attachMetaVerification = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const { site } = await requireProofSiteForAction(
      ctx,
      "attachMetaVerification",
    );
    const identity = await requireOwnerIdentity(ctx, "attachMetaVerification");

    const begun = await ctx.runAction(
      api.ownershipVerification.beginVerification,
      {
        siteId: site._id,
        method: "html_meta_token",
      },
    );

    const token = (begun as any)?.token ?? null;

    return {
      proofStep: "attachMetaVerification",
      expectation:
        "beginVerification mints a token and returns meta-tag instructions",
      identity: identityEcho(identity),
      result: begun,
      fixtureAction: token
        ? `Put this tag in the <head> of https://${PROOF_DOMAIN} and redeploy it: ` +
          `<meta name="taya-verification" content="${token}">`
        : "No token returned -- inspect the result above.",
      next: "update + redeploy the fixture site, then run runCheck (with --identity)",
    };
  },
});

// ---------------------------------------------------------------------------
// Step 6 -- runCheck (action, owner identity): the REAL public
// ownershipVerification.checkVerification -- a REAL network fetch of the
// fixture homepage looking for the meta tag. Verified => TAYA_CONNECTED.
// ---------------------------------------------------------------------------

export const runCheck = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const { site } = await requireProofSiteForAction(ctx, "runCheck");
    const identity = await requireOwnerIdentity(ctx, "runCheck");

    const result = await ctx.runAction(
      api.ownershipVerification.checkVerification,
      { siteId: site._id },
    );

    const verified = (result as any)?.state === "verified";

    return {
      proofStep: "runCheck",
      expectation:
        "the live network check finds the meta tag and flips the site to TAYA_CONNECTED",
      identity: identityEcho(identity),
      result,
      verified,
      next: verified
        ? "run publishAfterVerify (with --identity)"
        : "fix the fixture meta tag (must match the minted token), redeploy, re-run runCheck",
    };
  },
});

// ---------------------------------------------------------------------------
// Step 7 -- publishAfterVerify (action, owner identity): re-draft the final
// proof values, then the SAME REAL publishContentMap call that was blocked
// in step 4 -- which must now SUCCEED (TAYA_CONNECTED).
// ---------------------------------------------------------------------------

export const publishAfterVerify = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const { site, authority: authorityBefore } = await requireProofSiteForAction(
      ctx,
      "publishAfterVerify",
    );
    const identity = await requireOwnerIdentity(ctx, "publishAfterVerify");

    // Precondition: verification must have landed.
    if (!authorityBefore.canPublish) {
      throw new Error(
        `thirdSiteProof.publishAfterVerify: PRECONDITION FAILED -- ${PROOF_SLUG} is not ` +
          `publishable (${authorityBefore.reason}). Run runCheck first. No data was modified.`,
      );
    }

    // Refine the draft to the final proof values (the owner edits, then
    // publishes -- publishContentMap promotes existing drafts).
    await ctx.runMutation(api.publishing.saveDraft, {
      siteId: site._id,
      entries: PROOF_PUBLISH_VALUES,
    });

    // The same call attemptPublishBlocked made -- now it must succeed.
    const published = await ctx.runMutation(api.publishing.publishContentMap, {
      siteId: site._id,
      keys: PROOF_KEYS,
    });

    return {
      proofStep: "publishAfterVerify",
      expectation: "the identical publishContentMap call now succeeds",
      identity: identityEcho(identity),
      result: published,
      publishedKeys: PROOF_KEYS,
      next: "run checkPublishedServed, then curl /api/bridge/content",
    };
  },
});

// ---------------------------------------------------------------------------
// Step 8 -- checkPublishedServed (query, read-only): the REAL bridge payload
// (bridge._content -- exactly what /api/bridge/content serves) must carry the
// PUBLISHED values. Drafts are never served.
// ---------------------------------------------------------------------------

export const checkPublishedServed = query({
  args: {},
  handler: async (ctx): Promise<any> => {
    const site = await proofSite(ctx);
    if (!site) {
      throw new Error(
        `thirdSiteProof.checkPublishedServed: proof site "${PROOF_SLUG}" not found -- run setup first.`,
      );
    }

    const served = await ctx.runQuery(internal.bridge._content, {
      slug: PROOF_SLUG,
    });
    if (!served) {
      return {
        proofStep: "checkPublishedServed",
        PROOF_FAILED: true,
        reason: "bridge._content returned null -- no content map for the site.",
      };
    }

    const values: Record<string, string> = (served as any).values ?? {};
    const proofKeysServed: Record<string, boolean> = {};
    for (const { key, value } of PROOF_PUBLISH_VALUES) {
      proofKeysServed[key] = values[key] === value;
    }
    const allServed = Object.values(proofKeysServed).every(Boolean);

    return {
      proofStep: "checkPublishedServed",
      expectation: "the bridge serves the PUBLISHED values (drafts never served)",
      bridge: {
        version: (served as any).version,
        bridgeVersion: (served as any).bridgeVersion,
        domain: (served as any).domain,
        mode: (served as any).mode,
        publishedAt: (served as any).publishedAt,
        pages: (served as any).pages,
      },
      servedValues: values,
      proofKeysServed,
      PROOF_FAILED: !allServed,
      httpUrl: `https://uncommon-cobra-336.convex.site/api/bridge/content?slug=${PROOF_SLUG}`,
    };
  },
});
