---
name: Clerk dev-preview sign-in blockers (FSTS dashboard)
description: Why browser-based Clerk sign-in cannot work from the Replit workspace against the production Clerk instance, and which fallbacks work.
---

# Clerk dev-preview sign-in blockers

Browser sign-in (Clerk UI or `__clerk_ticket` flow) to the FSTS dashboard cannot work from this workspace:

1. **Misconfigured publishable key** — the workspace's Clerk publishable-key secret holds a placeholder, not a valid key, so Clerk JS resolution is broken in dev preview until the secret is corrected (tracked by a follow-up task).
2. **TLS handshake failure to the Clerk frontend domain** (`clerk.fstsclientsystem.com`) — the Cloudflare edge rejects the handshake from this network over both IPv4 and IPv6, so Clerk JS never loads regardless of key.
3. **No server-side fallback** — production Clerk instances refuse Backend-API-minted sessions (`request_invalid_for_environment`), so a Convex JWT cannot be minted server-side either.

**What still works:** Clerk Backend API user management works. Permission/access verification must fall back to the convex-test unit suite (`tests/convex-unit/`), which covers design-lock RBAC, flyer lifecycle, and tenant isolation.

**How to apply:** any task needing an authenticated browser session on the FSTS dashboard should first check TLS to the Clerk frontend domain (`curl https://clerk.fstsclientsystem.com/v1/environment`); if it fails, don't burn cycles on ticket flows — use unit-suite evidence and note the blocker.
