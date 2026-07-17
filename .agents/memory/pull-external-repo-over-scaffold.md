---
name: Pull external repo over the Replit scaffold
description: How to replace this repl's starter scaffold with an existing GitHub repo that has unrelated history.
---

# Bringing an existing GitHub repo into a fresh Replit workspace

When a repl starts as a scaffold (its own `Initial commit`) but the real project
lives in an existing GitHub repo, the scaffold history and the repo history are
**unrelated**, so a normal pull/merge fails.

**Sequence that works:**
1. Connect the GitHub integration (connection, not connector), then set `origin`
   to the repo URL. Plain `git` over HTTPS fails with "Password authentication is
   not supported" — auth is only injected by the managed `gitPull`/`gitPush`
   callbacks (CodeExecution), not by raw `git fetch`/`clone`.
2. Call `gitPull({ branch: "<default>" })`. The **merge step fails** (unrelated
   histories / `CLI_ERROR: UNKNOWN`), but the **fetch already succeeded** — so
   `refs/remotes/origin/<branch>` is now populated locally.
3. `git reset --hard origin/<branch>` to move the workspace onto the real repo.
   Untracked files (e.g. `attached_assets/`) are preserved.
4. `git branch --set-upstream-to=origin/<branch> <branch>`.

**Why:** raw git can't authenticate; only the callbacks can. And you can't merge
unrelated histories, but you don't need to — after the fetch, a hard reset adopts
the repo's tree and history cleanly, and future commits fast-forward on push.
