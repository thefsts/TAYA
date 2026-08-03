#!/bin/bash
# Seed a complete test site via the Convex CLI.
# Requires: npx convex run to be available and CONVEX_DEPLOY_KEY set.
# Usage: bash scripts/seed-test-site.sh
set -e

echo "=== FSTS-WOS™ Test Site Seed ==="
echo ""
echo "→ Step 1: Seed add-on catalog…"
npx convex run addons:seedCatalog 2>&1 | grep -v "npm warn" | grep -v "npm notice"

echo ""
echo "→ Step 2: Create test site via onboarding session…"
SESSION_KEY="fsts-onboard-test-$(date +%s)-seed"

# Create the onboarding session
npx convex run onboarding:createSession \
  "{\"sessionKey\": \"${SESSION_KEY}\"}" 2>&1 | grep -v "npm warn" | grep -v "npm notice"

# Save step data (all 10 steps in one payload)
npx convex run onboarding:saveStep "{
  \"sessionKey\": \"${SESSION_KEY}\",
  \"step\": 0,
  \"data\": {
    \"businessName\": \"Apex Fitness Studio\",
    \"websiteName\": \"Apex Fitness Studio\",
    \"industry\": \"fitness_wellness\",
    \"description\": \"Premium personal training and group fitness classes in downtown Tampa.\",
    \"phone\": \"(813) 555-0190\",
    \"email\": \"hello@apexfitnesstampa.com\",
    \"address\": \"1201 N Franklin St, Tampa, FL 33602\",
    \"timezone\": \"America/New_York\",
    \"purposes\": [\"promote_services\", \"accept_bookings\", \"generate_leads\"],
    \"pages\": [\"home\", \"about\", \"services\", \"products\", \"contact\", \"privacy_policy\", \"terms\"],
    \"brandColorPrimary\": \"#dc2626\",
    \"brandColorSecondary\": \"#1e1e1e\",
    \"fontHeading\": \"Montserrat\",
    \"fontBody\": \"Inter\",
    \"designStyle\": \"bold\",
    \"templateId\": \"bold_contemporary\",
    \"contentSetup\": \"guided\",
    \"priceRange\": [\"Personal Training\", \"Group Classes\", \"Elite Coaching\"],
    \"domainChoice\": \"temp\",
    \"customDomain\": \"\",
    \"integrations\": [\"operon_crm\", \"google_analytics\"],
    \"addOnSelections\": [\"smart-seo-pro\", \"website-health-pro\"]
  }
}" 2>&1 | grep -v "npm warn" | grep -v "npm notice"

echo ""
echo "→ Step 3: Launch site…"
RESULT=$(npx convex run onboarding:launch "{
  \"sessionKey\": \"${SESSION_KEY}\",
  \"stepData\": {}
}" 2>&1 | grep -v "npm warn" | grep -v "npm notice")

echo "$RESULT"
echo ""
echo "✓ Test site seed complete."
echo "  Business:  Apex Fitness Studio"
echo "  Industry:  fitness_wellness"
echo "  Pages:     Home, About, Services, Products, Contact + policy pages"
echo "  Add-ons:   Smart SEO Pro (trial), Website Health Pro (trial)"
echo "  Domain:    apex-fitness-studio.fstsclientsystem.com (temp)"
echo ""
echo "Sign in as superAdmin (amorebey@gmail.com) to view the workspace."
