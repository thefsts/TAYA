# Homepage Redesign to Match Approved Screenshot

## Phase 1: Setup & Investigation
- [ ] Check current globals.css file location
- [ ] Check current Header component structure
- [ ] Check current Homepage (page.tsx) structure
- [ ] Verify logo file paths
- [ ] Check existing Tailwind config

## Phase 2: Apply Style System
- [ ] Add brand color tokens to globals.css (CSS variables)
- [ ] Apply body background (light concrete/tactical feel)
- [ ] Apply .concrete-bg utility
- [ ] Apply .site-header styles (96px, backdrop blur, sticky)
- [ ] Apply .header-inner, .header-logo (150px, large)
- [ ] Apply .nav-link styles with red underline on active/hover
- [ ] Apply .btn-red, .btn-navy, .btn-white button styles
- [ ] Apply .home-hero with real photo background
- [ ] Apply .hero-title, .hero-subtitle, .hero-actions, .hero-trust-bar
- [ ] Apply .home-main, .home-grid, .lower-grid layouts
- [ ] Apply .section-title with red accent bar
- [ ] Apply .course-grid and .course-card styles
- [ ] Apply .why-card (navy right-side card)
- [ ] Apply .trust-strip styles
- [ ] Apply .cta-panel (blue gradient)
- [ ] Apply responsive breakpoints (1180px, 768px, 460px)

## Phase 3: Update Header Component
- [ ] Remove company name text beside logo
- [ ] Use large logo (150px desktop, 92px mobile)
- [ ] Use .site-header, .header-inner classes
- [ ] Update nav to use .nav-link with active state red underline
- [ ] Update action buttons to .btn-red + .btn-navy

## Phase 4: Update Homepage
- [ ] Replace HeroCarousel with new .home-hero section
- [ ] Use real photo (group-range-training-01.jpg) as hero background
- [ ] Apply new .hero-content, .hero-title, .hero-subtitle
- [ ] Apply new trust bar (Veteran-Owned · Texas State-Certified · Licensed · Insured)
- [ ] Remove San Antonio, TX from hero
- [ ] Update featured courses section to use new .course-card styles
- [ ] Map course images to real photos (LTC, Handgun, Defensive, Rifle)
- [ ] Create Why Train With Corsair navy card (.why-card)
- [ ] Create bottom trust strip (.trust-strip)
- [ ] Create blue CTA panel (.cta-panel)

## Phase 5: QA & Deploy
- [ ] Run `next build` and verify success
- [ ] Test desktop (1440px) in browser
- [ ] Test mobile (375px) in browser
- [ ] Verify all real photos load
- [ ] Verify no console errors
- [ ] Commit changes to new branch
- [ ] Push to GitHub
