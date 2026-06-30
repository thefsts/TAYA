# Corsair Navigation + i18n + Image Audit Update

## 1. Header / Navigation Restructure
- [x] Remove "Corsair Tactical Solutions" text next to logo (logo only)
- [x] Rename "Home" → "Corsair"
- [x] Add Services dropdown (Security Services, Private Investigations, Security Training)
- [x] Add Contact dropdown (Contact, FAQ)
- [x] Remove standalone Services/FAQ top-level links
- [x] Mirror same structure in mobile menu

## 2. Footer logo cleanup
- [ ] Remove company text next to logo in footer (or keep per spec?) - spec only says menu bar so keep footer as-is

## 3. Real i18n System
- [x] Create src/i18n/en.json + src/i18n/es.json
- [x] Create i18n provider / translation hook
- [x] LanguageSelector actually switches language (cookie + localStorage)
- [x] Document i18n system in comments
- [x] Cookie stored for future server-side /en|/es routing

## 4. Stripe Planning Doc
- [x] Create STRIPE_INTEGRATION.md with Phase 1 + Phase 2 plan
- [x] No fake payment code

## 5. Image Audit — Verified Gun/Range Only
- [x] HeroCarousel slide 1 — indoor range training (photo-1551698618)
- [x] HeroCarousel slide 2 — corporate security officer (photo-1557804506)
- [x] HeroCarousel slide 3 — range qualification (photo-1595590424283, was classroom)
- [x] Home course cards — all swapped off classroom/instruction stock
- [x] /courses hero — indoor gun range (photo-1551698618)
- [x] lib/courses.ts — all 6 course images verified firearms/range
- [x] /security-services hero — physical security officer (kept)
- [x] /security-services church image — church interior (kept, physical)
- [x] /security-training hero — range qualification (photo-1595590424283, was classroom)
- [x] /private-investigations hero — professional portrait (kept)
- [x] /about supporting image — range training (was classroom)
- [x] /faq hero — indoor range (was classroom)
- [x] /contact hero — firearms range consultation (was office)

## 6. Build + QA + Push
- [x] npm run build clean — 28/28 routes, 0 errors
- [x] Verified no classroom/office IDs remain (greped)
- [x] git commit + push via GITHUB_TOKEN