# FSTS-WOS™ — Release Checklist

Use this checklist before every significant release or feature merge.

---

## Code Quality
- [ ] `pnpm run typecheck` — clean
- [ ] `pnpm run test:convex-unit` — all passing
- [ ] `pnpm run test:design-lock` — all passing
- [ ] `pnpm run test:visual` — all passing (restart Component Preview Server if stale)
- [ ] `pnpm --filter @workspace/fsts-dashboard run build` — succeeds with PORT + BASE_PATH set
- [ ] `bash scripts/check-boundary.sh` — passes

## Security
- [ ] Every new mutation calls `checkSiteAccess` or `requireSiteAccessMutation`
- [ ] Every new query validates siteId belongs to current user (or is superAdmin)
- [ ] No new test-mode bypasses on production paths
- [ ] No secrets committed (run `git log -1 --stat` and confirm)
- [ ] Commit identity: `THEFSTS <amorebey@gmail.com>` on all commits

## New Pages / Routes
- [ ] Page has loading skeleton (not blank while data fetches) — Task #78
- [ ] Page has access-denied guard (module check or permission check) — Task #79
- [ ] Page has empty state (not blank when no data)
- [ ] Page handles error state (not blank on Convex error)
- [ ] Page is mobile-responsive (tested at 375px width)
- [ ] Page added to DASHBOARD_FEATURE_MATRIX.md

## New Convex Functions
- [ ] Mutations use `requireSiteAccessMutation` or explicit superAdmin check
- [ ] Queries filter by siteId with `.withIndex("by_site")`
- [ ] New tables have `by_site` index
- [ ] Internal mutations are marked `internalMutation`, not `mutation`
- [ ] Tenant-isolation test added to `tests/convex-unit/src/tenant-isolation.test.ts`

## Git
- [ ] `git config user.name` → `THEFSTS`
- [ ] `git config user.email` → `amorebey@gmail.com`
- [ ] Commit messages are descriptive and task-specific
- [ ] No corsair-source/ files tracked (check-boundary passes)
- [ ] Push succeeds without force (fast-forward to origin/main)

## Post-Deploy
- [ ] Verify https://fstsclientsystem.com loads
- [ ] Verify Convex functions are live (check Convex dashboard)
- [ ] Verify no 500 errors in browser console
- [ ] Verify authentication flow works (sign in → sites list → site workspace)
