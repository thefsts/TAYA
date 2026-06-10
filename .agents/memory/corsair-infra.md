---
name: Corsair Vercel + Square + Resend credentials reference
description: Project IDs and env var names for Corsair Tactical Solutions infrastructure
---

Vercel project ID: prj_dUtXgicvwQB5DDhsdMbfs6tLilL2
Vercel token: in session state (vcp_3HBziom…) — do NOT hardcode; use from session

Square env vars (in Vercel): SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID=LC0D0J614KW7H,
  SQUARE_ENVIRONMENT=production, NEXT_PUBLIC_SQUARE_APPLICATION_ID,
  NEXT_PUBLIC_SQUARE_ENVIRONMENT, NEXT_PUBLIC_SQUARE_LOCATION_ID

Resend: RESEND_API_KEY in Vercel, from address = contact@corsairtacticalsolution.com (single 'n'),
  admin to = corsairtacticalsolutions@gmail.com

Email pattern: raw fetch to https://api.resend.com/emails, fire-and-forget with Promise.all.
  NOT using Resend SDK — plain fetch only.

next-intl: localePrefix 'as-needed', default locale 'en', redirect /en/:path* → /:path*

**Why:** These are the production creds; Square is in production mode (not sandbox).
