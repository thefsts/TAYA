---
name: FSTS-WOS security model
description: How site-scoped authorization works in the Convex backend, and the traps when auditing it
---

## Authorization vocabulary
Site access is enforced via several helpers, not one: `checkSiteAccess` / `checkModuleAccess` (queries, return-empty pattern), `requireSiteAccessMutation` / `requireModuleAccess` / `requireDesignCapability` (mutations, throw), `internal.lib.siteAccessInternal.check` (membership check for actions), `internal.square.checkSiteAccessForAction` (WRITE-role check for actions), plus inline `isSuperAdmin` / `isAgencyAdmin` checks in users/sites/agencies/accessControl.

**Why:** an audit that greps for only `requireSiteAccess` massively over-reports gaps (a subagent audit did exactly this and wrongly called articles/courses/events unprotected).

**How to apply:** when auditing coverage, scan per exported function with the FULL guard vocabulary above; queries return `[]`/`null` for outsiders by convention, mutations throw `Forbidden`.

## Test-mode gate
`CONVEX_TEST_MODE=true` unlocks test bootstrap functions (`users.upsertTestSuperAdmin`, `users.promoteToSuperAdminByClerkId` without a superadmin caller, `healthScans.testHarness`). It must NEVER be set on a shared/prod Convex deployment — that re-opens a superadmin backdoor. E2E must target a test deployment with this flag set.

## Tenant isolation tests
`tests/convex-unit/src/tenant-isolation.test.ts` uses `convex-test` (+`@edge-runtime/vm`, `@vitest-environment edge-runtime` pragma) against the real schema/functions. Seed users BEFORE calling functions — `provisionUser` makes the first-ever user a superadmin.
