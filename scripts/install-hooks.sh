#!/bin/bash
# Installs committed git hooks from scripts/hooks/ into .git/hooks/.
# Runs automatically via the `prepare` lifecycle on every `pnpm install`.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_SRC="$SCRIPT_DIR/hooks"
GIT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --git-dir 2>/dev/null || true)"

if [ -z "$GIT_DIR" ]; then
  echo "install-hooks: git repo not found — skipping"
  exit 0
fi

# Resolve to absolute path (git --git-dir may return a relative path)
GIT_DIR="$(cd "$SCRIPT_DIR" && git rev-parse --git-dir)"
if [[ "$GIT_DIR" != /* ]]; then
  GIT_DIR="$(cd "$SCRIPT_DIR/$GIT_DIR" && pwd)"
fi

HOOKS_DEST="$GIT_DIR/hooks"

if [ ! -d "$HOOKS_DEST" ]; then
  echo "install-hooks: $HOOKS_DEST not found — skipping"
  exit 0
fi

for hook in "$HOOKS_SRC"/*; do
  name="$(basename "$hook")"
  dest="$HOOKS_DEST/$name"
  cp "$hook" "$dest"
  chmod +x "$dest"
  echo "install-hooks: installed $name"
done
