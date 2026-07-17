---
name: Vercel alias & protection fix via Replit connector
description: How to manage Vercel aliases and project protection settings when VERCEL_TOKEN is SAML-locked
---

## The problem
`VERCEL_TOKEN` in Replit secrets is SAML-scoped to the `fullstacksolutions` team — all REST API calls return 403 with `"enforced": false`. Pushing a new commit to GitHub main triggers Vercel CI but does NOT re-attach a manually-removed production alias.

## Working solution: Replit's built-in Vercel connector
Replit has a Vercel integration (`connection:conn_vercel_01KW8B3K8AP14WE30EDZ87885P`) that uses its own properly-scoped credentials. Use it via:

```js
// In code_execution sandbox:
await addIntegration("connection:conn_vercel_01KW8B3K8AP14WE30EDZ87885P");
// Then: proposeIntegration(...) to bind the Repl — this pauses for user click-through
// Then use connectors.proxy via the SDK:

const { ReplitConnectors } = await import(
  '/home/runner/workspace/.config/npm/node_global/lib/node_modules/@replit/connectors-sdk/index.js'
);
const connectors = new ReplitConnectors();
const resp = await connectors.proxy("vercel", "/v4/aliases/...");
const data = await resp.json();
```

Install SDK first: `npm install -g @replit/connectors-sdk`

## Vercel project coordinates
- Team: `fullstacksolutions` — `team_00AzAewtangFumhXtrI6kseh`
- Project: `corsair-tactical-solutions` — `prj_dUtXgicvwQB5DDhsdMbfs6tLilL2`

## Alias assignment
```js
// POST /v2/deployments/{uid}/aliases?teamId=...
// body: { "alias": "corsair-tactical-solutions1.vercel.app" }
```

## SSO Protection
The project had `ssoProtection: {"deploymentType":"all_except_custom_domains"}` which blocks all `.vercel.app` URLs (not just previews) from public visitors. Fixed by patching to null:
```js
// PATCH /v9/projects/{id}?teamId=... body: { ssoProtection: null }
```

**Why:** A removed custom alias won't auto-reattach on new deployments — only the default project alias (`{project}.vercel.app`) is auto-assigned. Custom aliases like `corsair-tactical-solutions1.vercel.app` must be explicitly re-assigned via API.

**How to apply:** When the Corsair site alias breaks again, skip VERCEL_TOKEN entirely, go straight to the Replit Vercel connector. Two-step fix: (1) assign alias, (2) check/patch ssoProtection.
