# FSTS-WOS™ Production Domain Status Report
Generated: 2026-07-31

## Summary

| Hostname | DNS | SSL | HTTP Status | Notes |
|---|---|---|---|---|
| fstsclientsystem.com | ✅ Vercel (216.150.1.193) | ✅ Let's Encrypt, valid until 2026-10-05 | ✅ 200 OK | Canonical production URL — fully operational |
| www.fstsclientsystem.com | ✅ Vercel | ⚠️ Cert mismatch (SAN missing) | ⚠️ Redirect chain broken on HTTPS | See issue below |
| http://fstsclientsystem.com | — | — | ✅ 308 → https://fstsclientsystem.com/ | HTTP→HTTPS redirect correct |
| http://www.fstsclientsystem.com | — | — | ✅ 308 → https://www.fstsclientsystem.com/ | Then fails SSL — see issue |
| api.fstsclientsystem.com | ❌ Not configured | ❌ None | ❌ No response | Requires manual Vercel dashboard action |
| status.fstsclientsystem.com | ❌ Not configured | ❌ None | ❌ No response | Requires manual Vercel dashboard action |
| docs.fstsclientsystem.com | ❌ Not configured | ❌ None | ❌ No response | Requires manual Vercel dashboard action |

---

## Apex Domain — fstsclientsystem.com ✅

- **DNS target:** 216.150.1.193 (Vercel CDN, region: iad1)
- **SSL issuer:** Let's Encrypt (YR1)
- **SSL CN:** `fstsclientsystem.com`
- **SSL expiry:** 2026-10-05 21:41:38 UTC
- **TLS version:** TLSv1.3 / TLS_AES_128_GCM_SHA256
- **HTTP/2:** Yes
- **Routing destination:** FSTS Client Dashboard (artifacts/fsts-dashboard)
- **HTTP → HTTPS redirect:** ✅ 308 Permanent Redirect to https://fstsclientsystem.com/
- **Status:** Fully operational. No action required.

---

## www Subdomain — www.fstsclientsystem.com ⚠️

- **DNS target:** Vercel (responds on port 80)
- **HTTP → HTTPS:** ✅ 308 redirect to https://www.fstsclientsystem.com/
- **SSL:** ⚠️ **ISSUE**: Vercel's SSL certificate for this project only has `CN=fstsclientsystem.com`. The Subject Alternative Name (SAN) list does **not** include `www.fstsclientsystem.com`. This causes an SSL verification failure on all HTTPS connections to the www subdomain.
- **www → apex redirect:** ⚠️ Partially configured (HTTP layer only — Vercel returns 308 to the apex via HTTP, but the HTTPS path fails at SSL negotiation before the redirect can fire)
- **Status:** NEEDS ACTION. The www domain must be properly added to the Vercel project so its SSL cert is re-issued with www in the SAN list.

### Required action (Vercel Dashboard):
1. Go to the FSTS dashboard project in Vercel → **Settings → Domains**
2. If `www.fstsclientsystem.com` is already listed: remove it and re-add it to trigger a fresh SSL certificate issuance (or click "Refresh" / "Re-verify")
3. If it is not listed: add `www.fstsclientsystem.com` and set the redirect target to `fstsclientsystem.com` with 308 status
4. Wait for Vercel to provision the SSL cert (typically < 60 seconds)
5. Confirm: `curl -I https://www.fstsclientsystem.com` should return `HTTP/2 308` with `location: https://fstsclientsystem.com/`

---

## Reserved Subdomains — NOT YET CONFIGURED ❌

These three subdomains have no DNS records and are not added to the Vercel project. No application is deployed to them (out of scope); they need only to be reserved with valid DNS and SSL provisioned.

### api.fstsclientsystem.com
- **Intended purpose:** Future FSTS API server / backend
- **Required DNS record:** `CNAME api.fstsclientsystem.com → cname.vercel-dns.com`
- **Required Vercel action:** Add domain to FSTS dashboard project in Vercel Settings → Domains

### status.fstsclientsystem.com
- **Intended purpose:** Future status page (e.g. Statuspage, Betterstack)
- **Required DNS record:** `CNAME status.fstsclientsystem.com → cname.vercel-dns.com`
- **Required Vercel action:** Add domain to FSTS dashboard project in Vercel Settings → Domains

### docs.fstsclientsystem.com
- **Intended purpose:** Future documentation site
- **Required DNS record:** `CNAME docs.fstsclientsystem.com → cname.vercel-dns.com`
- **Required Vercel action:** Add domain to FSTS dashboard project in Vercel Settings → Domains

### Steps to configure all three (Vercel Dashboard):
1. Open Vercel → Project: `fsts-client-dashboard-for-sites-api-server` (team: `fullstacksolutions`)
2. Go to **Settings → Domains**
3. Add each subdomain: `api.fstsclientsystem.com`, `status.fstsclientsystem.com`, `docs.fstsclientsystem.com`
4. Vercel will display the required DNS records — add them to your DNS registrar
5. The DNS record type will be either:
   - **CNAME** → `cname.vercel-dns.com` (if your registrar supports CNAME at subdomain level)
   - **A** → `76.76.21.21` (Vercel's anycast IP, if CNAME is not supported)
6. Vercel auto-provisions Let's Encrypt SSL for each domain once DNS is verified

---

## DNS Registrar Reference

The domain `fstsclientsystem.com` is currently resolving to Vercel's infrastructure (IP 216.150.1.193). DNS management is handled at your domain registrar. The Vercel project name within the `fullstacksolutions` team is `fsts-client-dashboard-for-sites-api-server`.

---

## Verification Commands

Run these after completing the manual steps above:

```bash
# Apex domain
curl -I https://fstsclientsystem.com
# Expected: HTTP/2 200, server: Vercel, x-vercel-cache: HIT/MISS

# www → apex redirect
curl -I https://www.fstsclientsystem.com
# Expected: HTTP/2 308, location: https://fstsclientsystem.com/

# HTTP → HTTPS redirects
curl -I http://fstsclientsystem.com
# Expected: HTTP/1.0 308, location: https://fstsclientsystem.com/

# Subdomains (after DNS + Vercel setup)
curl -I https://api.fstsclientsystem.com
curl -I https://status.fstsclientsystem.com
curl -I https://docs.fstsclientsystem.com
# Expected: HTTP/2 200 (or redirect to wherever they point)
```

---

## Blocker Note

Programmatic domain configuration via the Vercel API was not possible during this task run:
- The Replit Vercel connector (previously stored as `conn_vercel_01KW8B3K8AP14WE30EDZ87885P`) is no longer present in the Replit integration catalog
- No `VERCEL_TOKEN` environment variable is configured
- Vercel CLI installation was blocked by the workspace security policy

All remaining items require **manual action in the Vercel dashboard** by a team member with project admin access.
