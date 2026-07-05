---
name: Corsair GitHub push pattern
description: How to push file changes to thefsts/Corsair-Tactical-Solutions via GitHub API
---

## Push pattern
blob → tree → commit → PATCH refs/heads/main (force: false)
Author: name "Thefsts" — email stored in GITHUB_PERSONAL_ACCESS_TOKEN owner's git config.
Token: GITHUB_PERSONAL_ACCESS_TOKEN secret.

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
