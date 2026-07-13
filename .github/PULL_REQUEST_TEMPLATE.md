## Summary

<!-- What does this PR do? Link the task or issue it closes. -->

---

## Product Boundary Checkpoint ✅

> **Read this before merging.** The FSTS-WOS™ / Operon CRM™ boundary is permanent. See [`docs/product-boundaries.md`](../docs/product-boundaries.md) for the authoritative specification.

Answer each question. If any answer is "yes", describe how you've handled it.

- [ ] **Does this feature act on customers or leads** (e.g., sending emails, scoring leads, managing reviews, scheduling appointments)?
  - If yes → it belongs in **Operon CRM™**, not here. Route it through the **Operon Connector™** if FSTS-WOS™ needs to trigger it.

- [ ] **Does this feature touch reputation management, marketing automation, lead intelligence, advanced ecommerce, or appointment scheduling?**
  - These are explicitly excluded from FSTS-WOS™ (see §2.1 of product-boundaries.md). Do not build them here, even as "lightweight" versions.

- [ ] **Does this feature display or import external review data?**
  - If yes → it must follow the **Website Reviews Module™** pattern (display-only, read-only connector tokens). Review requesting, responding, or campaigning belongs in Operon CRM™ (§6).

- [ ] **Does this feature add new CRM connectivity?**
  - All CRM integration must flow exclusively through the **Operon Connector™** schema (`lib/db/src/schema/crm-connector.ts`). No direct API calls, shared databases, or embedded CRM UI outside that schema. New CRM vendors are added by registering in `CRM_PROVIDERS` — no schema rewrite required (§3, §7).

- [ ] **Does this feature add metrics to the Business Intelligence Dashboard™?**
  - Only website-focused KPIs are allowed (traffic, form conversions, payment revenue, site health). CRM pipeline, campaign performance, review analytics, and booking analytics belong in Operon CRM™ (§4).

- [ ] **Does this feature extend the AI Dashboard Assistant™?**
  - The assistant may only access site data and FSTS-WOS™ features. It must never generate marketing copy, manage reviews, score leads, or read Operon CRM™ data directly (§5).

---

## Type of Change

- [ ] Bug fix
- [ ] New feature (FSTS-WOS™ scope confirmed above)
- [ ] Refactor / tech debt
- [ ] Dependency update
- [ ] Configuration / infrastructure

## Testing

- [ ] Typecheck passes (`pnpm run typecheck`)
- [ ] Relevant unit / integration tests updated or added
- [ ] Manual smoke test performed

## Notes for Reviewer

<!-- Anything else the reviewer should know — migration steps, env vars, follow-up tasks. -->
