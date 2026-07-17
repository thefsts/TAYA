#!/bin/bash
# CI guard: fail if any corsair-source/ files are tracked by git.
# Run standalone via: pnpm run test:corsair-guard
# Also called by scripts/post-merge.sh.

set -e

tracked=$(git ls-files corsair-source/ 2>/dev/null || true)

if [ -n "$tracked" ]; then
  echo ""
  echo "✗ corsair-source/ files are tracked by git:"
  echo "$tracked" | head -20 | sed 's/^/    /'
  echo ""
  echo "  These files must never be committed to this repository."
  echo "  To remove them from git tracking without deleting the files:"
  echo "    git rm -r --cached corsair-source/"
  echo "    git commit -m 'chore: stop tracking corsair-source/'"
  echo ""
  exit 1
fi

echo "✓ corsair-source/ is not tracked by git"
