# Production Startup Guard

## Overview

FSTS-WOS™ uses two complementary mechanisms to surface missing production configuration before it causes a silent failure:

1. **`scripts/check-prod-config.sh`** — a shell script that validates environment variables before every deployment, emitting structured JSON-lines output so CI logs and alerting tools can parse it.
2. **`GET /api/admin/config-status`** — a protected Convex HTTP endpoint that superadmins can call at any time to get a live configuration report without leaving the platform.

Neither mechanism ever exposes secret values — only `"configured"` or `"missing"` status.

---

## Variable Catalogue

| Variable | Classification | Feature Protected | Failure Mode When Absent |
|---|---|---|---|
| `CONVEX_DEPLOY_KEY` | **Required** | Convex deployment | `npx convex deploy` cannot authenticate; deployment is impossible |
| `CONVEX_DEPLOYMENT_ENVIRONMENT` | **Required** | Sandbox/production gate | `isTestMode()` fails open; test-mode backdoor remains accessible on production |
| `CLERK_SECRET_KEY` | **Required** | Clerk authentication (server-side) | Server-side Clerk calls fail; user management and webhook verification break |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Required** | Clerk authentication (client-side) | Dashboard fails to initialise Clerk; all users see a blank auth screen |
| `VITE_CONVEX_URL` | **Required** | Convex backend connectivity | Dashboard cannot connect to Convex; all data loading fails silently |
| `RESEND_API_KEY` | **Required (per-site)** | Transactional email delivery | Welcome emails and form-submission notifications are silently skipped with no visible error |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | **Required (per-site)** | Square webhook signature verification | Webhooks accept any payload without verifying the Square signature; spoofed payment events pass unchallenged |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Recommended | AI Dashboard Assistant | AI chat assistant is silently unavailable |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Recommended | AI Dashboard Assistant (endpoint routing) | AI requests may hit the wrong endpoint |
| `SESSION_SECRET` | Recommended | Session signing | Sessions may be unsigned or use an insecure default |
| `CLERK_JWT_ISSUER_DOMAIN` | Optional | Convex Clerk JWT issuer config | Convex JWT validation may fail on cold start if the issuer domain is not embedded in `auth.config.ts` |

> **Classification meanings**
> - **Required** — the deployment is unsafe or non-functional without this variable. `check-prod-config.sh` exits 1 if any Required variable is missing.
> - **Required (per-site)** — the platform boots but individual site features silently degrade. The script logs these as `missing` but does _not_ block the deploy.
> - **Recommended** — graceful degradation; operators should be aware but the deploy can proceed.
> - **Optional** — capability-gated; absence has no production impact.

---

## Running the Pre-Deploy Check

### Locally

```bash
bash scripts/check-prod-config.sh
```

The script reads variables from your current shell environment. Set them first:

```bash
export CONVEX_DEPLOY_KEY="..."
export CONVEX_DEPLOYMENT_ENVIRONMENT="production"
# ... etc.
bash scripts/check-prod-config.sh
```

### Filtering the output

The script emits one JSON object per line (JSON Lines format). Pipe through `jq` to filter:

```bash
# Show only missing variables
bash scripts/check-prod-config.sh | jq 'select(.status == "missing")'

# Show only Required variables that are missing
bash scripts/check-prod-config.sh | jq 'select(.status == "missing" and .classification == "Required")'

# Count missing Required variables
bash scripts/check-prod-config.sh | jq -r 'select(.status == "missing" and .classification == "Required") | .variable' | wc -l
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | All Required variables are present. Safe to deploy. |
| `1` | One or more Required variables are missing. Deployment blocked. |

---

## Wiring into Vercel Deploy Hooks

Add the check as the first step of your Vercel build command so a missing Required variable aborts the build before any compilation begins.

**Option A — `vercel.json`**

```json
{
  "buildCommand": "bash scripts/check-prod-config.sh && pnpm --filter @workspace/fsts-dashboard run build"
}
```

**Option B — Vercel Dashboard**

1. Go to your Vercel project → **Settings** → **General** → **Build & Development Settings**.
2. Set **Build Command** to:
   ```
   bash scripts/check-prod-config.sh && pnpm --filter @workspace/fsts-dashboard run build
   ```
3. Make sure all Required variables are added under **Environment Variables** → **Production**.

**Option C — GitHub Actions pre-deploy job**

```yaml
jobs:
  config-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check production config
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
          CONVEX_DEPLOYMENT_ENVIRONMENT: production
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
          VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}
          VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
        run: bash scripts/check-prod-config.sh
```

---

## Calling the Config-Status API Endpoint

### Endpoint

```
GET https://<your-convex-deployment>.convex.site/api/admin/config-status?siteSlug=<slug>
```

### Authentication

The endpoint requires a valid Clerk JWT from an active superadmin account. Pass the token in the `Authorization` header:

```
Authorization: Bearer <clerk-session-token>
```

### Parameters

| Parameter | Required | Description |
|---|---|---|
| `siteSlug` | No | Optional site slug to include in the report for context |

### Response — 200 OK

```json
{
  "squareWebhookVerification": "configured",
  "resendApiKey": "missing",
  "convexEnvironment": "production",
  "emailDelivery": "missing",
  "siteSlug": "apex-fitness-studio",
  "checkedAt": "2026-08-03T14:22:01.000Z"
}
```

| Field | Values | Meaning |
|---|---|---|
| `squareWebhookVerification` | `"configured"` \| `"missing"` | Whether `SQUARE_WEBHOOK_SIGNATURE_KEY` is set |
| `resendApiKey` | `"configured"` \| `"missing"` | Whether `RESEND_API_KEY` is set |
| `convexEnvironment` | `"production"` \| `"sandbox"` \| `"unknown"` | Value of `CONVEX_DEPLOYMENT_ENVIRONMENT` |
| `emailDelivery` | `"configured"` \| `"missing"` | Same as `resendApiKey`; present as a semantic alias |
| `siteSlug` | string \| `null` | The `siteSlug` query param you passed in |
| `checkedAt` | ISO 8601 | Timestamp of when the check ran |

### Response — 401 Unauthorized

No `Authorization` header provided or JWT is invalid.

```json
{ "error": "Unauthorized" }
```

### Response — 403 Forbidden

JWT is valid but the authenticated user is not an active superadmin.

```json
{ "error": "Forbidden" }
```

### Example curl call

```bash
# Get a Clerk session token from your browser dev tools → Application → Cookies → __session
TOKEN="<your-clerk-jwt>"
CONVEX_URL="https://uncommon-cobra-336.convex.site"

curl -s -H "Authorization: Bearer $TOKEN" \
  "$CONVEX_URL/api/admin/config-status?siteSlug=apex-fitness-studio" | jq .
```

---

## Reading the Script Output

Each line of output is a self-contained JSON object. A typical passing run looks like:

```jsonl
{"variable":"CONVEX_DEPLOY_KEY","classification":"Required","status":"present","feature":"Convex deployment","failureMode":"...","ownerAction":"..."}
{"variable":"CONVEX_DEPLOYMENT_ENVIRONMENT","classification":"Required","status":"present","feature":"Sandbox/production gate","failureMode":"...","ownerAction":"..."}
{"variable":"CLERK_SECRET_KEY","classification":"Required","status":"present","feature":"Clerk authentication (server-side)","failureMode":"...","ownerAction":"..."}
{"variable":"VITE_CLERK_PUBLISHABLE_KEY","classification":"Required","status":"present","feature":"Clerk authentication (client-side)","failureMode":"...","ownerAction":"..."}
{"variable":"VITE_CONVEX_URL","classification":"Required","status":"present","feature":"Convex backend connectivity","failureMode":"...","ownerAction":"..."}
{"variable":"RESEND_API_KEY","classification":"Required (per-site)","status":"missing","feature":"Transactional email delivery","failureMode":"...","ownerAction":"Run: npx convex env set RESEND_API_KEY <key>"}
...
{"summary":"PASSED","message":"All Required variables are present. Deployment is safe to proceed."}
```

A blocking failure emits the summary to stderr and exits 1:

```
{"summary":"FAILED","message":"One or more Required variables are missing. Deployment blocked."}
```

---

## 10-Step Deployment Verification Procedure

Run these steps in order before every production deployment.

1. **Pull and verify identity** — confirm your local HEAD matches `origin/main` and all commits are authored by `THEFSTS <amorebey@gmail.com>`.

2. **Run the config guard** — `bash scripts/check-prod-config.sh`. Fix any Required variables that are missing before continuing.

3. **Run the prod-env check** — `bash scripts/check-prod-env.sh`. Verifies `CONVEX_TEST_MODE` is absent and `CONVEX_DEPLOYMENT_ENVIRONMENT=production` is set in the live deployment.

4. **Run the full test suite** — `pnpm run test:convex-unit && pnpm run test:design-lock`. All tests must pass.

5. **Build the dashboard** — `VERCEL=1 pnpm --filter @workspace/fsts-dashboard run build`. Confirm zero errors and a clean bundle.

6. **Deploy Convex** — `bash scripts/deploy-convex.sh`. This runs `check-prod-env.sh` automatically before pushing.

7. **Verify the config-status endpoint** — call `GET /api/admin/config-status` with a superadmin token and confirm every field shows `"configured"` (or `"production"` for `convexEnvironment`).

8. **Verify email delivery** — `bash scripts/verify-email-delivery.sh` (requires `RESEND_API_KEY` to be set). Send a test welcome email and confirm receipt.

9. **Check the domain** — `curl -sI https://fstsclientsystem.com | grep -E "HTTP|server|x-vercel"`. Confirm HTTP 200 from Vercel.

10. **Sign in as a real user** — open `https://fstsclientsystem.com`, complete the Clerk sign-in flow, and confirm the dashboard loads with the correct role.

---

## Adding New Required Variables

When a new environment variable is introduced that is required for correct operation:

1. Add a row to the **Variable Catalogue** table above.
2. Add a corresponding `emit_line` call in `scripts/check-prod-config.sh` with the correct classification.
3. If the variable is checked at runtime in Convex, add it to the `configStatusHandler` in `convex/adminConfig.ts` and update the response shape documented here.
4. Update the unit test in `tests/convex-unit/src/config-status.test.ts` to stub the new variable.
