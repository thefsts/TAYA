## P11/P0 — Repair swapped Clerk bindings (FSTS ⇄ Corsair) + §22 tenant-binding-integrity regression suite

### Root cause (live-proven 2026-09-06)
The P2 repair migration `repairInvitedClientRecords.ts` paired the two orphan Clerk IDs to the WRONG invitations, swapping `clerkUserId` bindings between the Corsair and FSTS client records. Owner-verified ground truth (user-assisted live login as cdweemsbey@gmail.com → `window.Clerk.user.id = user_3IqPwkRg7oeRLHcCRv0N4yxlMRs`):

- **FSTS client** cdweemsbey@gmail.com = user_3IqPwkRg7oeRLHcCRv0N4yxlMRs → site qd74hpd1vk391fkpy797xk7dzh8drmz9
- **Corsair client** corsairtacticalsolutions@gmail.com = user_3IsuGrs6vmVY9rDYlZ86SZn7l9k → site qd7cpjk68m0z4rme5hw4sqgeys8bk1zc

But production binds these IDs to the opposite records → cdweemsbey lands in the Corsair workspace (owner-reported), and the Corsair client's login loops (their subject hits the FSTS record and bounces).

### Fix
`convex/migrations/swapSwappedClientBindings.ts` — one-off guarded production repair:
- `audit` query: read-only binding map + state report (`swapped` / `canonical` / `unknown` / `missing-records`)
- `swap` mutation: idempotent (alreadyCanonical no-op), refuses unless state is exactly the audited swapped state AND each record's roles are verified canonical for its own site (so a swap can never hand a stranger the wrong tenant); exactly two `ctx.db.patch()` calls swapping ONLY `clerkUserId` — record IDs, roles, emails, names, invitation history, all FKs untouched.

### Regression coverage (spec §22 — permanent suite)
`tests/convex-unit/src/tenant-binding-integrity.test.ts` (9 tests) pins the identity/authorization contract with the canonical FSTS+Corsair fixtures: subject→one-record uniqueness; cross-tenant denial server-side via `sites.get` both directions; `sites.listWithHealth` single-site isolation; superadmin control view; swapped-state detection + blast radius (wrong workspace served + own site unreachable — the exact live defect); stale-preference harmlessness; no-steal reconciliation.

`tests/convex-unit/src/swap-swapped-client-bindings.test.ts` (5 tests) guards the repair itself: swap corrects to canonical; everything else untouched; idempotent no-op; refusal on unknown state; refusal on cross-tenant roles.

### Test evidence
- `swap-swapped-client-bindings.test.ts`: 5/5 PASS
- `tenant-binding-integrity.test.ts`: 9/9 PASS
- Full convex-unit suite: **579/579 PASS (35 files)**

### Deployment note
After merge: deploy Convex prod, then run `npx convex run migrations/swapSwappedClientBindings:swap --prod` (expected `status: "swapped", swapped: 2`), verify with a fresh prod audit (`…:audit --prod` → `state: "canonical"`), then owner live re-login verification (cdweemsbey → FSTS workspace only; Corsair → Corsair only, no loop).
