/**
 * Convex unit-test environment setup.
 *
 * The real `provisionUser` (convex/lib/getCurrentUser.ts) resolves superadmin
 * status from the `SUPERADMIN_EMAILS` env allowlist via `accessFlagsForEmail`.
 * Tests seed superadmin users with `isSuperAdmin: true` in the DB and call
 * functions as `withIdentity({ subject: "superadmin" })` without an explicit
 * email, so `provisionUser` derives the identity email as
 * `${subject}@unknown.local`. Without `SUPERADMIN_EMAILS` configured,
 * `reconcileExistingAccess` flips the seeded `isSuperAdmin` back to `false`,
 * causing "Forbidden: superAdmin required" failures.
 *
 * Setting this allowlist here (before any test runs) makes the test superadmin
 * identities resolve correctly through the REAL provisionUser path — no
 * production code is mocked or altered.
 */
process.env.SUPERADMIN_EMAILS = [
  "superadmin@unknown.local",
  "superadmin_module_test@unknown.local",
  "amorebey@gmail.com",
].join(",");

process.env.INTERNAL_QA_EMAILS = "";
