---
name: Corsair GitHub push pattern
description: How to push file changes to thefsts/Corsair-Tactical-Solutions via GitHub API
---

## Push pattern
blob → tree → commit → PATCH refs/heads/main (force: false)
Token: GITHUB_PERSONAL_ACCESS_TOKEN secret.
User's requested commit author identity is stored in `replit.md` under "User preferences"
(not here, since it's an email address) — always pass an explicit `author`/`committer` object
on the `POST /git/commits` call using that identity rather than relying on the token's default
git config, which may not match.

## Anchor safety rules for courses.ts str.replace
1. Always use `count=1` and check `old in content` before replacing.
2. Use the NEXT COURSE SLUG as part of the anchor to guarantee uniqueness
   (e.g. `... ],\n  },\n\n  'next-course-slug':` at the end of the old string).
3. TypeScript string literal \uXXXX escapes are stored as literal text
   (6 chars: \, u, X, X, X, X) — NOT as unicode characters.
   Use surrounding ASCII context instead of relying on unicode in anchors.
4. Characters in TypeScript COMMENTS are real unicode (═══, ─── etc.)
   and can be used via Python \uXXXX escapes safely.
5. Multiple courses can share the same optionalAddOns text; always anchor
   uniquely via a unique pricingOption id (e.g. `id: 'ltc-prof'`) or slug.

**Why:** Learned from Task #23 — 3 anchor failures due to: (a) em dash literal vs character,
(b) non-unique optionalAddOns block matching wrong course, (c) BEGINNER section anchor issue.

## Verifying a push
`raw.githubusercontent.com` can 404/lag briefly after a push (CDN cache). Verify via the
Contents API (`/contents/<path>?ref=main`) instead — it reflects the live repo state immediately.

## Footer component location
`src/components/Footer.tsx` holds the site footer (bottom bar has Cookie Settings button,
policy links, trust line) — this is the anchor point for any global footer link additions
(e.g. an "Admin Portal" link to the dashboard).

## New client sites need content-table seeding, not just a `sites` row
Registering a client in the dashboard's `sites` table does not seed its per-entity content
tables (homepage_content, contact_info, footer_content, seo_settings, etc.) — editor forms
for an unseeded site can hard-fail on save if a field has a NOT NULL/min-length constraint
(e.g. heroSubheadline) but the GET route returns an empty-string placeholder when no row exists.
**Why:** Discovered onboarding Corsair Tactical Solutions as first production client — its
homepage/contact/footer tables had zero rows despite the site being registered, so any editor
save round-tripped an empty required field back and got rejected by the update Zod schema.
**How to apply:** When onboarding a new site, seed at least homepage_content and contact_info
with real (or real-ish, pulled from the live site's source) values before considering the site
"connected" — don't rely on the empty-string GET fallback as a substitute for real seed data.

## Bulk repo-replace push (whole-monorepo-subset → external GitHub repo)
Same blob/tree/commit/PATCH primitives scale to a full multi-hundred-file push that fully
replaces an existing repo's contents (e.g. porting a pnpm-workspace subset into a separate
GitHub repo for external hosting), not just single-file edits:
1. Build the file list explicitly (curated allowlist, not everything) — exclude Replit-only
   infra (`.replit`, `replit.nix`), dev-only workspace packages irrelevant to the ported app's
   runtime/build (test suites, internal tooling artifacts), and large binary asset dirs unless
   actually referenced by import paths.
2. Text files can go straight into the tree entry as `content` (no blob call needed); only
   true binary files (images, fonts) need an explicit `POST /git/blobs` with base64 encoding.
3. Create the tree WITHOUT `base_tree` when the intent is a full replace — this makes the new
   tree the complete file set, dropping anything not in your list (e.g. an old unrelated
   starter template previously in the repo).
4. Commit with `parents: [current-head-sha]` and PATCH the ref with `force: false` — this stays
   a valid fast-forward since the new commit's parent is the old HEAD, even though the tree
   contents are unrelated to the parent's tree.
**Why:** Ported the FSTS dashboard (Express+Postgres+Vite monorepo subset) into a GitHub repo
that previously held an unrelated Next.js+Sanity starter, for Vercel hosting.

## Local corsair-source clone can drift from GitHub production
The local `corsair-source/` working copy is a separate clone, not a live mirror — it can silently
fall behind the `thefsts/Corsair-Tactical-Solutions` GitHub `main` branch if edits happened
upstream (e.g. via the GitHub API directly) without a corresponding local pull.
**Why:** Found local history several commits behind remote HEAD when starting unrelated dashboard
work — editing the stale local copy would have produced a push that reverted newer production
content.
**How to apply:** Before editing anything under `corsair-source/`, diff/pull from GitHub `main`
first and resync local files if they differ, rather than trusting the working directory as-is.

## `content_versions` / Version History requires explicit wiring per content route
The dashboard's DB schema has a `content_versions` table and a `versions.ts` route that reads/
restores from it, but no content route (homepage, footer, contact, courses, events, articles)
ever wrote to it — "Version History" silently did nothing for every site, not just one client.
**Why:** Found while verifying Version History worked for a specific client (Corsair) during
onboarding QA; the gap was global, tracked separately from `activity_log` (which was wired
correctly and worked).
**How to apply:** When adding a new content-editing route, call both `logActivity()` and a
`recordVersion()` helper (mirrors `logActivity`'s pattern: `{siteId, actor, entityType, entityId,
snapshot}`) after every create/update — don't assume version history "just works" alongside
activity logging.

## Backend route path must match the OpenAPI spec exactly, not just "close enough"
The versions backend route was registered at `/sites/:siteId/content-versions`, but the OpenAPI
spec (source of truth) and the Orval-generated frontend client both call `/sites/:siteId/versions`.
DB writes succeeded (confirmed via direct psql) but the UI always showed an empty list, because the
GET request 404'd silently against the wrong path — no runtime error surfaced, since content-version
writes and reads are wired to different codepaths.
**Why:** A feature can pass "does the DB write happen?" checks and still be completely broken
end-to-end if the read-side route path drifts from the spec; typecheck doesn't catch this because
route strings aren't type-checked against the OpenAPI paths.
**How to apply:** When a UI list/table appears empty despite confirmed DB writes, diff the actual
registered Express route path against `lib/api-spec/openapi.yaml` and the generated client call —
don't assume the bug is in the write path just because that's where you were last working.

## Vercel project coordinates (fullstacksolutions team)
- Team: `fullstacksolutions` — `team_00AzAewtangFumhXtrI6kseh`
- Project: `corsair-tactical-solutions` — `prj_dUtXgicvwQB5DDhsdMbfs6tLilL2`
- Old token (`VERCEL_TOKEN` secret) returns 403 on project listing — wrong team scope.
- Working token is in Replit secrets as `VERCEL_FULL_TOKEN` (full-account VCP token).
- Build log endpoint: `GET /v3/deployments/{uid}/events?teamId=…&limit=2000&direction=forward&follow=0` with `Accept: application/x-ndjson`

## ConvexArticle optional fields — index guard pattern
- `ConvexArticle.category` is `string | undefined` (and most other fields are optional).
- Indexing `Record<string, …>` with `string | undefined` is a TS strict-mode error.
- Pattern: `CATEGORY_STYLES[article.category ?? '']` — always use `?? ''` when indexing with an optional string field.
- Same applies to `featured.category ?? ''`, `article.topic ?? ''`, etc.
