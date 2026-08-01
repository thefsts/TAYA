---
name: Task-agent rebase stuck duplicate pick
description: How to fix an interactive rebase that gets stuck because a commit appears in both the done list and the todo list after parallel task-agent merges.
---

## The rule
When the post-merge interactive rebase gets stuck with `git status` showing "interactive rebase in progress" and the **same commit SHA appears as the last entry in `.git/rebase-merge/done` AND the first entry in `.git/rebase-merge/git-rebase-todo`**, run:

```bash
git rebase --skip
```

Then let the rebase continue normally. Do NOT use `--abort` (loses already-replayed work) or `--continue` alone (working tree clean but git still stalls on the duplicate pick).

**Why:** The post-merge identity-rewrite rebase (used by task agents to normalize commit authors) can encounter the same commit SHA twice when merges from multiple parallel task agents land in rapid succession. The duplicate pick creates a no-op cherry-pick that git refuses to auto-resolve, halting the rebase.

**How to apply:** Always check `.git/rebase-merge/done` (last line) vs `.git/rebase-merge/git-rebase-todo` (first pick line) when a rebase stalls with "working tree clean". If SHAs match → `git rebase --skip`. If they differ → investigate for an actual conflict.
