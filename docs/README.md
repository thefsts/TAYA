# FSTS Website Operating System™ — Platform Docs

This `docs/` folder is the source of truth for how the FSTS dashboard platform
operates, independent of any single client site. Site-specific content lives
in the database, not here.

## Index

- [`VERSIONING.md`](./VERSIONING.md) — how the platform version number is tracked and bumped.
- [`ONBOARDING.md`](./ONBOARDING.md) — what happens automatically when a new client site is created, and what still requires manual setup.
- [`OPERON_GAP_ANALYSIS.md`](./OPERON_GAP_ANALYSIS.md) — known gaps in the Operon Connector™ CRM integration.

## Where to look for other things

- Workspace structure, TypeScript setup, package conventions: see the `pnpm-workspace` skill (`.local/skills/pnpm-workspace`).
- Day-to-day run/build commands and stack overview: root `replit.md`.
- Database schema source of truth: `lib/db/src/schema/`.
- API contract source of truth: the OpenAPI spec consumed by `@workspace/api-spec` codegen.
