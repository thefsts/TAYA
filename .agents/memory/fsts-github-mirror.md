---
name: FSTS GitHub mirror push pattern
description: How to push from Replit to the GitHub mirror repo using the injected PAT
---

# FSTS GitHub Mirror Push Pattern

## Rule
Use `GITHUB_PERSONAL_ACCESS_TOKEN` (env var injected by Replit's GitHub OAuth integration) to configure a git remote and run `git push github main` in `scripts/post-merge.sh`.

**Why:** The Replit GitHub integration does NOT expose a raw token via `listConnections()` or the connectors SDK proxy — it only supports `connectors.proxy('github', ...)` API calls. But the platform injects the PAT as `GITHUB_PERSONAL_ACCESS_TOKEN` in the shell environment, which can be used directly for `git push`.

**How to apply:**
- In post-merge hooks: set remote URL to `https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/...`, push, then strip token from remote URL
- The initial push to a repo with divergent history requires `--force`; subsequent merges are non-force fast-forwards
- Repo: `thefsts/FSTS-client-Dashboard-for-sites-`; branch: `main`; author: `Thefsts <amorebey@gmail.com>`
