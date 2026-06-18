---
name: Corsair mobile responsiveness audit
description: Findings from a full-site mobile audit — what is already responsive and what was fixed
---

# Corsair Mobile Responsiveness Audit

## Result: Site is already largely mobile-responsive

All 30+ pages and 30+ components were audited. The vast majority already use correct Tailwind responsive breakpoints. The only fixes needed were 4 form-field grids.

**Why:** The site was built mobile-first with Tailwind. Most page layouts use `grid-cols-1 md:grid-cols-N` or `flex flex-col sm:flex-row` patterns consistently.

## What is already correct (do NOT re-audit these)
- `Header.tsx` — full hamburger + accordion mobile menu ✓
- `HeroCarousel.tsx` — right panels use `hidden lg:block` / `hidden lg:flex` ✓
- `Footer.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` ✓
- `CTABanner.tsx` — `flex flex-col sm:flex-row` ✓
- `PageHero.tsx`, `TrustBar.tsx`, `TexasLicenseBar.tsx`, `QuickConsultForm.tsx` ✓
- All 30 page routes in `src/app/[locale]/` ✓

## The only fix that was needed
`BookingForm.tsx` (L553, L604, L634) and `EventBookingForm.tsx` (L213):

```
grid grid-cols-2 gap-3  →  grid grid-cols-1 sm:grid-cols-2 gap-3
```

Form field pairs (First/Last Name, Emergency Contact, Date+Experience) were displaying in 2 cramped columns on all phone sizes.

## Audit approach that works
Use Python + GitHub API to grep for `grid grid-cols-[2-9]` (space before grid-cols, not `sm:grid-cols`) followed by no responsive breakpoint on the same line. The naive regex `grid-cols-[2-9](?!.*sm:)` generates many false positives by matching inside `sm:grid-cols-N`.

**Correct pattern:** `re.search(r'grid grid-cols-[2-9]', line)` then check the substring AFTER the match for any `sm:|md:|lg:`.
