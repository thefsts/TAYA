#!/usr/bin/env bash
# Run visual regression tests against the mockup-sandbox.
# Starts the Component Preview Server if it is not already listening on
# PORT=8081, runs the tests, then stops any server process it started.

set -euo pipefail

PORT=8081
BASE_PATH="/__mockup"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "[visual-tests] Stopping Component Preview Server (PID $SERVER_PID)…"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Check if something is already listening on the port.
if curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; then
  echo "[visual-tests] Component Preview Server already running on port ${PORT}."
else
  echo "[visual-tests] Starting Component Preview Server on port ${PORT}…"
  PORT=$PORT BASE_PATH=$BASE_PATH \
    pnpm --filter @workspace/mockup-sandbox run dev &
  SERVER_PID=$!

  # Wait up to 60 s for the server to become ready.
  READY=0
  for i in $(seq 1 60); do
    if curl -sf "http://localhost:${PORT}${BASE_PATH}/" > /dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 1
  done

  if [ "$READY" -ne 1 ]; then
    echo "[visual-tests] ERROR: Component Preview Server did not start within 60 s." >&2
    exit 1
  fi
  echo "[visual-tests] Component Preview Server is ready."
fi

echo "[visual-tests] Running visual regression tests…"
pnpm run test:visual
