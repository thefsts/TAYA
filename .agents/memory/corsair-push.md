---
name: Corsair GitHub push pattern
description: How to push file changes to thefsts/Corsair-Tactical-Solutions via GitHub API
---

## Push pattern
blob → tree → commit → PATCH refs/heads/main (force: false)
Author: `{"name": "Thefsts", "email": "amorebey@gmail.com"}`
Token: GITHUB_PERSONAL_ACCESS_TOKEN secret.

## Anchor safety rules for courses.ts str.replace
1. Always use `count=1` and check `old in content` before replacing.
2. Use the NEXT COURSE SLUG as part of the anchor to guarantee uniqueness
   (e.g. `... ],\n  },\n\n  'next-course-slug':` at the end of the old string).
3. TypeScript string literal \uXXXX escapes are stored as literal text
   (6 chars: \, u, X, X, X, X) — NOT as unicode characters.
   Use surrounding ASCII context instead of relying on unicode in anchors.
4. Characters in TypeScript COMMENTS are real unicode (═══, ─── etc.)
   and can be used via Python \uXXXX escapes safely.
5. Multiple courses can share the same optionalAddOns text; always anchor
   uniquely via a unique pricingOption id (e.g. `id: 'ltc-prof'`) or slug.

**Why:** Learned from Task #23 — 3 anchor failures due to: (a) em dash literal vs character,
(b) non-unique optionalAddOns block matching wrong course, (c) BEGINNER section anchor issue.
