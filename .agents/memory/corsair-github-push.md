---
name: Corsair GitHub push pattern
description: How to push commits to thefsts/Corsair-Tactical-Solutions via GitHub API to keep Vercel auto-deploy working
---

Use the GitHub REST API (GITHUB_PERSONAL_ACCESS_TOKEN secret) — never commit via git CLI.

Pattern: POST /git/blobs → POST /git/trees (base_tree=HEAD SHA) → POST /git/commits (parents must be the full 40-char HEAD SHA) → PATCH /git/refs/heads/main

**Why:** Vercel watches the main branch for auto-deploy. Pushing via the API keeps the deployment pipeline intact. Force-pushing breaks the deploy hook.

**How to apply:** Every session that needs to ship changes to the live Corsair site.
