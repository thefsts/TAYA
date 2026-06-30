# Final Launch Checklist — STATUS

## Items I completed from code

- [x] Set `NEXT_PUBLIC_SITE_URL` default fallback to the final domain
      (`https://corsairtacticalsolutions.com`) so canonicals/sitemap are
      correct even without the env var
- [x] Full audit: Dominion Word ✓ none, Vercel logo ✓ none,
      snow/skiing images ✓ none, stock photos ✓ none, placeholder text ✓ none
- [x] Removed orphan SVGs (next.svg, vercel.svg, globe.svg, file.svg, window.svg)
- [x] Renamed legacy JSON key `dominionWord` → `texasLtcCertification`
      in all 10 locales and in `src/app/[locale]/page.tsx`
- [x] `npm run build` with production env → 367/367 pages, no errors
- [x] Sitemap uses final domain exclusively (verified)
- [x] Canonical + hreflang URLs use final domain (verified)
- [x] robots.txt points to final sitemap + final host (verified)
- [x] Analytics confirmed consent-gated (no tracking scripts render without
      consent — verified via curl of cold page)
- [x] Smoke tested all key pages → 200 (all 10 locales, all course/service
      pages, sitemap/robots/icons/OG image)
- [x] Old `/en/courses/dominion-word-ltc` correctly 404s
- [x] New `/en/courses/texas-license-to-carry` correctly 200s
- [x] Social links (Instagram/Facebook/TikTok) verified in Footer/Header
      and in Organization+LocalBusiness JSON-LD `sameAs`
- [x] Wrote `LAUNCH.md` documenting remaining human steps
- [x] Commit + push

## Items that require human action (documented in LAUNCH.md)

- [ ] Set `NEXT_PUBLIC_SITE_URL` in Vercel dashboard (Production env)
- [ ] Configure DNS and add custom domain in Vercel
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Update Google Business Profile website URL
- [ ] Update Instagram / Facebook / TikTok bio links
- [ ] Add GA / Meta / TikTok tracking IDs to Vercel env (when ready)
