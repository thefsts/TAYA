# Corsair Tactical Solutions — Launch Checklist

This document captures the remaining launch steps. The code side is ready;
the items below are operational / infrastructure tasks that must be performed
by a human with access to the various dashboards.

---

## ✅ Already done in code (commit history)

- Per-page unique SEO metadata (title, description, canonical, OG, Twitter)
- Homepage title: **"Corsair Tactical Solutions | Firearms Training, Security
  Services & Certification"**
- `/sitemap.xml` (all 10 locales + hreflang alternates, ~350 entries)
- `/robots.txt` (disallows `/api`, `/_next`, `/_vercel`, `/*/confirmation`,
  `/*/training-waiver*`, points to sitemap, sets host)
- JSON-LD schemas: Organization, LocalBusiness, WebSite, Course,
  CourseInstance, Event, FAQPage, BreadcrumbList, Offer
- Social `sameAs` (Instagram, Facebook, TikTok) in Organization +
  LocalBusiness schemas
- Favicon from Corsair logo (`favicon.ico`, `icon.png`, `apple-icon.png`)
- Branded 1200×630 Open Graph card (`/og-default.jpg`)
- "Dominion Word LTC" fully renamed to **"Texas License to Carry Certification"**
  in every locale, slug changed to `/courses/texas-license-to-carry`
- Analytics placeholders (GA4, Meta Pixel, TikTok Pixel) that load **only
  after cookie consent is granted** for the relevant category
- Accessibility pass: `prefers-reduced-motion`, `:focus-visible` outlines
- `.env.example` documents all required env vars
- Default `SITE_URL` now points to `https://corsairtacticalsolutions.com`,
  so canonicals/OG/sitemap are correct even if the env var isn't set
- Orphan assets removed (next.svg, vercel.svg, globe.svg, file.svg, window.svg)
- Legacy JSON keys renamed (`dominionWord` → `texasLtcCertification`)

All 367 routes build cleanly with Next.js 16 App Router + Turbopack.

---

## 🔲 Human action required (cannot be automated from code)

### 1. Vercel project configuration

- In the Vercel dashboard for this project:
  1. **Settings → Domains:** add `corsairtacticalsolutions.com` and
     `www.corsairtacticalsolutions.com` (redirect `www` → apex, or vice versa).
  2. **Settings → Environment Variables** (Production scope):
     ```
     NEXT_PUBLIC_SITE_URL=https://corsairtacticalsolutions.com
     ```
     Optional (leave unset until you actually have the IDs):
     ```
     NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
     NEXT_PUBLIC_META_PIXEL_ID=000000000000000
     NEXT_PUBLIC_TIKTOK_PIXEL_ID=XXXXXXXXXXXXXXXXXX
     ```
  3. Redeploy (or push a new commit) so the env vars take effect.

### 2. DNS

- Point the apex A/ALIAS record for `corsairtacticalsolutions.com` at
  Vercel's recommended IP (`76.76.21.21` currently) or set a CNAME to
  `cname.vercel-dns.com` per Vercel's domain setup instructions.

### 3. Search engine submission

- **Google Search Console** (https://search.google.com/search-console):
  1. Add `https://corsairtacticalsolutions.com` as a property (URL prefix).
  2. Verify via DNS TXT record or HTML tag.
  3. Submit `https://corsairtacticalsolutions.com/sitemap.xml`.
- **Bing Webmaster Tools** (https://www.bing.com/webmasters):
  1. Add the site, verify via DNS or meta tag.
  2. Submit `https://corsairtacticalsolutions.com/sitemap.xml`.
  3. (Optional) Import directly from Google Search Console.

### 4. Google Business Profile

- Update the **Website** field on the Corsair Google Business Profile
  listing so it shows `https://corsairtacticalsolutions.com` (not the
  vercel.app URL).
- Confirm NAP (Name / Address / Phone) matches the LocalBusiness schema:
  - Name: Corsair Tactical Solutions
  - Phone: +1 (214) 335-6652
  - Email: corsairtacticalsolutions@gmail.com
  - Area served: Texas

### 5. Social profiles

Update the "Website" / bio link on each profile to
`https://corsairtacticalsolutions.com`:

- Instagram: https://www.instagram.com/corsairtacticalsolution?igsh=MTd1MmhkZzZtaWh2MQ==
- Facebook: https://www.facebook.com/share/17iPFcVg7j/
- TikTok: https://www.tiktok.com/@stevehopwood0

### 6. (Optional) Analytics tracking IDs

When you're ready to enable analytics, obtain the IDs and add them to Vercel
env vars (step 1 above). No code change is required — the tracking scripts
will start loading automatically **only after a visitor accepts the
corresponding cookie category** (analytics / marketing).

- Google Analytics 4 → `NEXT_PUBLIC_GA_ID`
- Meta Pixel → `NEXT_PUBLIC_META_PIXEL_ID`
- TikTok Pixel → `NEXT_PUBLIC_TIKTOK_PIXEL_ID`

---

## 🔲 Post-launch smoke test (after DNS is live)

Once `https://corsairtacticalsolutions.com` resolves to the production build,
run through this list in an incognito window:

- [ ] `https://corsairtacticalsolutions.com/` → redirects to `/en` (or user's
      preferred locale) and shows homepage
- [ ] `https://corsairtacticalsolutions.com/sitemap.xml` loads, all URLs use
      the live domain
- [ ] `https://corsairtacticalsolutions.com/robots.txt` points at the live
      sitemap
- [ ] `https://corsairtacticalsolutions.com/favicon.ico` shows the Corsair logo
- [ ] Social preview test on:
      https://www.opengraph.xyz/url/https%3A%2F%2Fcorsairtacticalsolutions.com
- [ ] Rich Results test:
      https://search.google.com/test/rich-results (check Course, Event,
      FAQPage, LocalBusiness, BreadcrumbList)
- [ ] Mobile-Friendly test:
      https://search.google.com/test/mobile-friendly
- [ ] PageSpeed Insights:
      https://pagespeed.web.dev/?url=https%3A%2F%2Fcorsairtacticalsolutions.com
- [ ] Language switcher works (hits all 10 locales)
- [ ] Contact form submits and triggers confirmation page
- [ ] Waiver form submits (check destination email arrives)
- [ ] Cookie consent banner appears; Accept → Analytics loads;
      Reject → nothing loads
- [ ] Accessibility widget opens and applies settings
- [ ] Mobile menu opens/closes, dropdowns work, footer social links open
      the right accounts in a new tab
- [ ] No console errors on Chrome DevTools
- [ ] OG share card looks correct when pasting URL in Facebook / Slack /
      iMessage / WhatsApp
