---
name: FSTS superAdmin allowlist
description: How superAdmin is granted — replaced first-signup bootstrap with SUPERADMIN_EMAILS env var.
---

## The change

`convex/lib/getCurrentUser.ts` — `provisionUser` function.

Old behaviour: `isFirstUser = allUsers.length === 0` → first signup gets superAdmin. **This was a security vulnerability.**

New behaviour: `SUPERADMIN_EMAILS` Convex env var (comma-separated). Any new signup whose email is in the list gets `isSuperAdmin: true`. Emails NOT in the list get `isSuperAdmin: false`. No automatic fallback.

## Current allowlist (on uncommon-cobra-336)

- `amorebey@gmail.com` — platform owner
- `e2e-test@fstsclientsystem.com` — automated test user

To update: `npx convex env set SUPERADMIN_EMAILS "amorebey@gmail.com,newemail@example.com"`

## Promoting an existing user manually

Use `convex/users.ts` mutation `promoteToSuperAdminByClerkId` (requires a superAdmin caller). From the dashboard Admin section.

## Existing users are unaffected

Users already in the DB with `isSuperAdmin: true` keep that value. The env var only affects NEW signups.

**Why:** A public first-signup claiming platform-wide admin is unacceptable for a production SaaS. Env var allowlist is explicit, auditable, and version-controlled.
