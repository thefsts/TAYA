---
name: Replit main-repl sync behavior
description: How Replit's internal git-sync server (main-repl) interacts with local git state and validation runs, and how to write boundary checks that are immune to it.
---

# Replit main-repl sync behavior

## The rule
`git fetch origin main && git reset --hard origin/main` fixes the LOCAL workspace momentarily, but the Replit platform's internal git-sync server (`main-repl` remote at `git+ssh://git@ssh.worf.replit.dev:/home/runner/workspace`) will rebase its commits back onto local `main` within seconds — including during a 54-second validation window.

**Why:** The `main-repl` remote is the Replit workspace's canonical git server. It stores commits made by Replit agents under the workspace's platform identity (`fstacktsolution <59946806-fstacktsolution@users.noreply.replit.com>` or `Replit Agent <agent@replit.com>`). The platform automatically rebases `main-repl/main` onto local `main` after any divergence is detected.

**How to apply:** Any CI check that uses `origin/main..HEAD` (outgoing range) will always fail when the validation window overlaps with a main-repl sync. Instead, write checks that audit the REMOTE history directly:

```bash
# fetch with no credential prompt — fails silently if no auth cached
GIT_TERMINAL_PROMPT=0 git fetch origin main 2>/dev/null || true

# check the full published history, not the local outgoing range
bash check-commit-identity.sh "origin/main"
```

This makes the check independent of what the Replit sync has put into local HEAD.

## git-filter-repo interaction
`git-filter-repo --mailmap` rewrites all local commits and garbage-collects old objects. After a filter-repo run:
- The old dirty SHAs (`ee7c6e1`, `bff603c`, etc.) are gone from the local object store
- `main-repl/main` still points to the old dirty SHA, but as a dangling ref
- On the next sync the platform may rebase using those old objects if they still exist in main-repl's store (they do — the main-repl server is separate)

## Pushing to main-repl
`git push --force main-repl main` hangs waiting for an SSH password (`git@ssh.worf.replit.dev`). Cannot be done programmatically. This is why the main-repl sync cannot be fully stopped — only worked around via the fetch+full-history-check pattern above.

## GIT_TERMINAL_PROMPT=0
Any `git fetch` in a CI/boundary-check script MUST be gated with `GIT_TERMINAL_PROMPT=0`. Without it, the fetch hangs indefinitely waiting for a password when the origin URL has no embedded credentials. The hanging causes the entire validation run to time out.
