# www.fstsclientsystem.com — Domain Fix

**Status as of August 1, 2026:** `www.fstsclientsystem.com` accepts a TLS connection but returns no HTTP response. The apex domain `fstsclientsystem.com` is fully active (HTTP 200, Vercel CDN). The fix is a 2-minute change in the Vercel dashboard.

## Root Cause

`www.fstsclientsystem.com` has a DNS A/CNAME record pointing at Vercel's CDN (TLS negotiates successfully), but the Vercel project `fsts-client-dashboard-for-sites-api-server` does not have `www.fstsclientsystem.com` registered as a domain alias. Vercel accepts the TCP+TLS connection but closes it at the HTTP layer because no project claims that hostname.

## Evidence

```
# Apex — works correctly
curl -sI https://fstsclientsystem.com
# → HTTP/2 200  server: Vercel  strict-transport-security: max-age=63072000

# www — silent close after TLS
curl -sI https://www.fstsclientsystem.com
# → (no output — connection closes before any HTTP response)
```

## Fix — Vercel Dashboard (2 minutes)

1. Log in at **https://vercel.com** and open the **`fsts-client-dashboard-for-sites-api-server`** project.
2. Go to **Settings → Domains**.
3. Click **Add**.
4. Enter `www.fstsclientsystem.com` and click **Add**.
5. When Vercel asks how to handle the www subdomain, select **"Redirect to `fstsclientsystem.com`"** (308 Permanent Redirect). This is the default option when the apex domain is already present.
6. Vercel will provision the domain within ~30 seconds (TLS cert already exists; no DNS change needed).

## Verification After Fix

Run these two checks — both should return an HTTP response:

```bash
# www should 308 → apex
curl -sI https://www.fstsclientsystem.com
# Expected:
# HTTP/2 308
# location: https://fstsclientsystem.com/
# server: Vercel

# Apex should still 200
curl -sI https://fstsclientsystem.com
# Expected:
# HTTP/2 200
# server: Vercel
```

## Alternative: Vercel REST API

If you prefer the API over the dashboard, the equivalent call is:

```bash
# Replace <VERCEL_TOKEN> and <PROJECT_ID>
curl -X POST "https://api.vercel.com/v9/projects/fsts-client-dashboard-for-sites-api-server/domains?teamId=team_00AzAewtangFumhXtrI6kseh" \
  -H "Authorization: Bearer <VERCEL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "www.fstsclientsystem.com",
    "redirect": "fstsclientsystem.com",
    "redirectStatusCode": 308
  }'
```

Expected response: `{"name":"www.fstsclientsystem.com","redirect":"fstsclientsystem.com","redirectStatusCode":308,"verified":true,...}`

## Why No DNS Change Is Needed

The DNS record for `www.fstsclientsystem.com` already resolves to Vercel's CDN (TLS negotiates, confirming Vercel handles the connection). The missing piece is Vercel routing the request — that is purely a project-level domain alias configuration, not a DNS issue.
