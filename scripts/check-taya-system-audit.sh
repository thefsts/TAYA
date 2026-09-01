#!/usr/bin/env bash
set -euo pipefail

ROOT="artifacts/fsts-dashboard/src"
fail=0

check_forbidden() {
  local pattern="$1"
  local label="$2"
  if grep -RIn --exclude='*.test.*' --exclude='*.spec.*' -- "$pattern" "$ROOT" >/tmp/taya-audit-match 2>/dev/null; then
    echo "FAIL: $label"
    cat /tmp/taya-audit-match
    fail=1
  else
    echo "PASS: $label"
  fi
}

# Runtime/auth migration guards. TAYA production uses Clerk's verified custom
# domain and hosted account portal, not the legacy proxy integration.
check_forbidden 'VITE_CLERK_PROXY_URL' 'Legacy Clerk proxy reference removed from active dashboard source'

# Product identity guards. FSTS ownership/legal references are allowed, but the
# interactive product UI must use TAYA branding instead of the retired WOS look.
check_forbidden 'hsl(84 65% 25%)' 'Retired olive primary color removed from active dashboard source'
check_forbidden 'Technology • Automation • Yield • Administration' 'Retired TAYA expansion removed from active dashboard source'
check_forbidden 'fsts_header_logo_' 'Legacy FSTS product logo removed from active dashboard source'

# Lime was the retired dashboard accent. Semantic status colors such as green,
# amber and red remain valid; lime is reserved from product chrome.
if grep -RIn --include='*.tsx' --include='*.ts' -- 'lime-' "$ROOT/pages/app" >/tmp/taya-lime-match 2>/dev/null; then
  echo "FAIL: Retired lime dashboard accents remain"
  cat /tmp/taya-lime-match
  fail=1
else
  echo "PASS: No retired lime dashboard accents"
fi

rm -f /tmp/taya-audit-match /tmp/taya-lime-match

if [[ "$fail" -ne 0 ]]; then
  echo "TAYA system audit guard FAILED."
  exit 1
fi

echo "TAYA system audit guard PASSED."
