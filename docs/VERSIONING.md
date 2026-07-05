# Platform Versioning

The FSTS dashboard is a shared platform serving multiple client sites. It has
its own version, separate from any individual client site's content or
deployment.

## Current version

**v1.0** — first stabilization release ("FSTS Website Operating System™ v1.0").

## Where the version is displayed

The version string is rendered directly in the dashboard shell so support
staff and client admins can always see which platform build they're on:

- Sidebar header trademark line (`FSTS Website Operating System™`)
- Sidebar footer trademark line (`FSTS Website Operating System™ v1.0`)

Both live in `artifacts/fsts-dashboard/src/pages/app/SiteDashboard.tsx`
(`AppLayout` component).

## Bumping the version

There is intentionally no build-time version injection yet (no `package.json`
version wiring, no git-tag automation). For v1.0 this is a plain literal
string. When the platform reaches its next milestone release:

1. Update the footer string in `SiteDashboard.tsx`.
2. Update "Current version" above.
3. Note the change in the git commit message; there is no separate changelog
   file yet.

**Why manual for now:** the platform is pre-1.0-in-spirit and only has one
release so far. Automating version injection (e.g. from `package.json` or git
tags) is worth doing once releases become more frequent — see the roadmap
note in `ONBOARDING.md`'s "Known manual steps" for the same rationale pattern.
