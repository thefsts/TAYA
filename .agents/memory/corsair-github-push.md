---
name: Corsair GitHub push pattern
description: How to push commits to thefsts/Corsair-Tactical-Solutions via GitHub API
---

Use GitHub REST API with GITHUB_PERSONAL_ACCESS_TOKEN secret.

Pattern: POST /git/blobs (one per changed file) → POST /git/trees (base_tree=HEAD SHA) → POST /git/commits (parents=[full 40-char HEAD SHA]) → PATCH /git/refs/heads/main

Author for every commit:
{"name": "Thefsts", "email": "amorebey@gmail.com"}

**Why:** Direct commits keep Vercel auto-deploy working (Vercel watches main branch). Never force-push.

**How to apply:** Every time a change needs to be pushed to the live site.
