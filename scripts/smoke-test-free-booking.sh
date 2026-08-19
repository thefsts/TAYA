#!/usr/bin/env bash
# smoke-test-free-booking.sh — FSTS-WOS™ Public Booking System smoke test
#
# Verifies the end-to-end public booking flow for a known free Corsair course:
#
#   1. GET  /api/public/availability → HTTP 200, requiresPayment=false
#   2. POST /api/public/register     → HTTP 200, registrationId present in body
#   3. POST /api/public/cancel       → HTTP 200 (cleanup — removes the test row)
#
# If the Corsair courses are not seeded yet (availability returns 404), the
# script attempts to seed them via:
#   npx convex run seedCorsair:ensureCorsairCourses
# using CONVEX_DEPLOY_KEY (set as a Replit secret). On success it retries once.
#
# A failure at any step means visitors who submit the FSTSPublicBookingForm may
# silently receive no confirmation and no database entry.
#
# Exits 0 on success, 1 on any failure.
# When run as part of boundary-check.sh the caller interprets the exit code.

set -euo pipefail

CONVEX_SITE="https://uncommon-cobra-336.convex.site"
SITE_SLUG="corsair-tactical-solutions"
ENTITY_TYPE="course"
# "basic-handgun-private-instruction" is seeded as free (priceCents: undefined)
# and published, making it the canonical test target for the free-booking flow.
ENTITY_SLUG="basic-handgun-private-instruction"

# Use a timestamp-suffixed address so each run is a fresh registration.
# The domain (.invalid) is RFC 2606-reserved and can never receive mail.
TEST_EMAIL="smoke-test-booking-$(date +%s)@boundary-check.invalid"
TEST_NAME="Boundary Check Bot"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  echo "[free-booking-smoke] ❌  $*" >&2
  exit 1
}

# ── Helper: call the availability endpoint, write to temp file ───────────────
check_availability() {
  local status
  status=$(curl -s -o /tmp/fsts-booking-avail-resp.json -w "%{http_code}" \
    --max-time 20 \
    "${CONVEX_SITE}/api/public/availability?slug=${SITE_SLUG}&type=${ENTITY_TYPE}&entitySlug=${ENTITY_SLUG}" \
    2>&1) || { echo "curl error"; return 1; }
  echo "$status"
}

# ── Step 1: Availability ─────────────────────────────────────────────────────
echo "[free-booking-smoke] Step 1 — checking availability for free course: $ENTITY_SLUG"

AVAIL_STATUS_CODE=$(check_availability) || fail "Availability request failed (curl network error)"

if [ "$AVAIL_STATUS_CODE" = "404" ]; then
  echo "[free-booking-smoke]    Course not found (404) — attempting to seed Corsair courses..."

  # Try seeding via the Convex CLI. CONVEX_DEPLOY_KEY must be in the environment.
  if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
    fail "Course '$ENTITY_SLUG' not found (404) and CONVEX_DEPLOY_KEY is not set.
       Run the Corsair seed manually:
         npx convex run seedCorsair:ensureCorsairCourses
       or set CONVEX_DEPLOY_KEY so this script can seed automatically."
  fi

  echo "[free-booking-smoke]    Running: npx convex run seedCorsair:ensureCorsairCourses"
  SEED_OUTPUT=$(CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
    npx --yes convex run seedCorsair:ensureCorsairCourses 2>&1) \
    || fail "Seed command failed.
       Output: $SEED_OUTPUT
       Make sure the Convex deployment is up to date (deploy convex/ first)."

  echo "[free-booking-smoke]    Seed output: $SEED_OUTPUT"

  # Retry availability after seeding
  echo "[free-booking-smoke]    Retrying availability check..."
  AVAIL_STATUS_CODE=$(check_availability) \
    || fail "Availability request failed after seeding (curl network error)"
fi

AVAIL_RESP=$(cat /tmp/fsts-booking-avail-resp.json 2>/dev/null || echo "{}")

if [ "$AVAIL_STATUS_CODE" != "200" ]; then
  fail "Availability returned HTTP $AVAIL_STATUS_CODE (expected 200).
       URL: ${CONVEX_SITE}/api/public/availability?slug=${SITE_SLUG}&type=${ENTITY_TYPE}&entitySlug=${ENTITY_SLUG}
       Body: $AVAIL_RESP"
fi

# Extract key fields with plain grep/sed — no jq dependency.
ENTITY_ID=$(echo "$AVAIL_RESP" | grep -o '"entityId":"[^"]*"' | head -1 | cut -d'"' -f4)
REQUIRES_PAYMENT=$(echo "$AVAIL_RESP" | grep -o '"requiresPayment":[^,}]*' | head -1 | cut -d: -f2 | tr -d ' "')
REG_OPEN=$(echo "$AVAIL_RESP" | grep -o '"registrationOpen":[^,}]*' | head -1 | cut -d: -f2 | tr -d ' "')

if [ -z "$ENTITY_ID" ]; then
  fail "Availability response is missing entityId.
       Body: $AVAIL_RESP"
fi

echo "[free-booking-smoke]    entityId=$ENTITY_ID requiresPayment=$REQUIRES_PAYMENT registrationOpen=$REG_OPEN"

if [ "$REQUIRES_PAYMENT" = "true" ]; then
  fail "Expected a free course (requiresPayment: false) but got true.
       Check that '$ENTITY_SLUG' has no priceCents set in seedCorsair.ts."
fi

echo "[free-booking-smoke] ✅  Step 1 passed — availability OK, course is free"

# ── Step 2: Register ─────────────────────────────────────────────────────────
echo "[free-booking-smoke] Step 2 — submitting registration for $TEST_EMAIL"

REG_BODY=$(printf \
  '{"slug":"%s","entityType":"%s","entitySlug":"%s","customerName":"%s","customerEmail":"%s","notes":"Automated boundary-check smoke test — safe to cancel","termsAccepted":true}' \
  "$SITE_SLUG" "$ENTITY_TYPE" "$ENTITY_SLUG" "$TEST_NAME" "$TEST_EMAIL")

REG_STATUS_CODE=$(curl -s -o /tmp/fsts-booking-reg-resp.json -w "%{http_code}" \
  --max-time 20 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$REG_BODY" \
  "${CONVEX_SITE}/api/public/register" 2>&1) \
  || fail "Registration request failed (curl network error)"

REG_RESP=$(cat /tmp/fsts-booking-reg-resp.json 2>/dev/null || echo "{}")

if [ "$REG_STATUS_CODE" != "200" ]; then
  fail "Registration returned HTTP $REG_STATUS_CODE (expected 200).
       Body: $REG_RESP"
fi

REGISTRATION_ID=$(echo "$REG_RESP" | grep -o '"registrationId":"[^"]*"' | head -1 | cut -d'"' -f4)
REG_STATUS=$(echo "$REG_RESP" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$REGISTRATION_ID" ]; then
  fail "Registration response missing registrationId — backend accepted the request
       but returned no registrationId. Body: $REG_RESP"
fi

echo "[free-booking-smoke]    registrationId=$REGISTRATION_ID status=$REG_STATUS"
echo "[free-booking-smoke] ✅  Step 2 passed — registration landed with status=$REG_STATUS"

# ── Step 3: Cancel (cleanup) ─────────────────────────────────────────────────
echo "[free-booking-smoke] Step 3 — cancelling test registration (cleanup)"

CANCEL_BODY=$(printf '{"registrationId":"%s","customerEmail":"%s"}' \
  "$REGISTRATION_ID" "$TEST_EMAIL")

CANCEL_STATUS_CODE=$(curl -s -o /tmp/fsts-booking-cancel-resp.json -w "%{http_code}" \
  --max-time 20 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$CANCEL_BODY" \
  "${CONVEX_SITE}/api/public/cancel" 2>&1) \
  || { echo "[free-booking-smoke] ⚠️  Cleanup cancel request failed (curl error) — test row may remain (registrationId=$REGISTRATION_ID)"; exit 0; }

CANCEL_RESP=$(cat /tmp/fsts-booking-cancel-resp.json 2>/dev/null || echo "{}")

if [ "$CANCEL_STATUS_CODE" != "200" ]; then
  # Warn but do not fail — cleanup failure is not a booking-flow regression.
  echo "[free-booking-smoke] ⚠️  Cleanup cancel returned HTTP $CANCEL_STATUS_CODE — test row may remain (registrationId=$REGISTRATION_ID). Body: $CANCEL_RESP"
else
  echo "[free-booking-smoke] ✅  Step 3 passed — test registration cancelled (cleanup complete)"
fi

echo "[free-booking-smoke] ✅  Free course booking smoke test passed."
