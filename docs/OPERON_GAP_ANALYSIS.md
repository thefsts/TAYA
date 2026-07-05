# Operon CRM — Repo Findings & Gap Analysis (Task 65)

Fetched via authenticated GitHub API (`thefsts/operon-crm`, private, real product at operoncrm.com).

## What Operon CRM actually is
- Monorepo: `crm-platform/` (Turborepo + pnpm) with `apps/convex` (backend), `apps/web` (React 19 + Vite), `apps/mobile` (Expo), `apps/portal` (client portal), `apps/store`, `apps/marketing`.
- Backend is **Convex** (real-time serverless functions), NOT a traditional REST/Express API. Functions are `query`/`mutation`/`action`/`httpAction`, called via Convex's client protocol or a small set of exposed `httpAction` routes in `http.ts`.
- Multi-tenant: every record has `organizationId`; roles `owner/admin/member/readonly`; tiers `starter/pro/enterprise`.
- Real entity modules confirmed present with real mutation names: `clients.create/update/remove`, `leads.create/update/convertToDeal`, `deals.create/update/updateStatus/moveStage`, `invoices.create/applyPayment/send`, `appointments.create/update/cancel/confirm/reschedule`.

## Confirmed capabilities we can rely on
1. **API tokens** (`apiTokens.ts`): org-scoped tokens prefixed `oprn_`, granular scopes (`read:clients`, `write:leads`, `admin:webhooks`, `full_access`, etc.), hashed at rest. This is the intended mechanism for the spec's "API key" connection method.
2. **Clerk-based SSO binding** (`clerkUsers.ts`): Operon already has `ensureUserFromClerk`, `currentClerkUser`, `lookupByClerkId`, keyed on `clerkUserId`. FSTS-WOS (`fsts-dashboard`) also uses `@clerk/react`. Real SSO is architecturally reachable if both apps trust the same Clerk instance/JWT — this is the intended mechanism for the spec's "SSO into Operon workspace."
3. **Outbound webhook infra** (`webhookConfigs.ts`, `webhookEvents.ts`): Operon can register per-org webhook subscriptions and deliver events. This is the natural transport for Operon→website sync (status/notes/lead/tag updates).
4. **Integrations registry** (`integrations.ts`): generic `type` enum + `connect/get/list` — pattern exists for connecting third-party services, but the enum does not include a "website"/external-CRM-sync entry, and it's designed for org-admin-initiated connections inside Operon's own UI, not partner-initiated inbound provisioning.

## Confirmed GAPS (must be flagged to the user — Operon-side work needed before this goes fully live)
1. **No working inbound REST API for partners.** `apiTokens.ts` issues and stores tokens, but grepping every `httpAction` in `http.ts` shows zero routes that check an `oprn_` token. The token system is unwired — there is currently no endpoint a website can POST a contact/lead/order to using an API key. This must be added on the Operon side (e.g. `/api/external/v1/*` httpActions that validate `Authorization: Bearer oprn_...` and call the existing `clients.create`/`leads.create`/etc. mutations with the token's org scope).
2. **No confirmed webhook-registration UI/API for arbitrary external subscriber URLs.** `webhookConfigs.ts` exists but needs verification that a non-Operon-owned URL (FSTS's callback) can be registered as a subscriber for entity-level events (appointment status, lead status, tags) — only skimmed, not fully verified against schema.
3. **No dedicated "website"/"connector" integration type** in `integrations.ts`'s `INTEGRATION_TYPES` — would need Operon to add one so Operon's own Settings UI can reflect the FSTS-WOS connection (this is a nice-to-have; not blocking since FSTS-WOS can host the connection state itself).
4. **SSO is not yet cross-tenant-proven** — `ensureUserFromClerk` assumes the same Clerk application/session; if FSTS-WOS and Operon run separate Clerk instances, true single-click SSO needs either (a) shared Clerk org/instance, or (b) a signed handoff token exchange endpoint on Operon (not found in the repo).

## Design decision for this build
Given the above, FSTS-WOS will ship a **complete, production-shaped connector platform** (schema, encrypted credential storage, per-entity toggles, sync logs with retry, Settings UI, nav SSO entry point, modular multi-CRM-ready interface) with a real `OperonConnector` implementation that:
- Authenticates outbound calls using the `oprn_...` API-key format Operon already defines.
- Exposes an inbound webhook receiver endpoint (`/api/connectors/operon/webhook`) ready to accept Operon-origin events the moment Operon's webhook delivery is confirmed to support external URLs.
- Marks outbound entity-sync calls against Operon's confirmed mutation names, but degrades to a clear "pending Operon API" logged status (not a silent fake success) until Operon ships the inbound REST surface described in Gap #1 — per the project's "no silent fallbacks" principle.
