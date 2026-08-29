# TAYA Public Marketing Website — Build Foundation

Status: ACTIVE BUILD
Owner: Full Stack Tech & Solutions LLC
Repository: `thefsts/TAYA`

## Build boundary

The public marketing website is a separate customer-facing surface from the TAYA application/dashboard. Marketing work must not redesign, weaken, or interfere with dashboard architecture, authentication, tenant controls, production data, or existing client websites.

## Technical baseline

- Stay inside the existing TAYA monorepo.
- Node.js 24.x.
- pnpm only.
- Reuse the workspace React/Vite/Tailwind conventions where appropriate.
- Keep the public site independently deployable so marketing releases cannot break the dashboard.
- No unnecessary new dependencies.
- Preserve the workspace supply-chain controls and `minimumReleaseAge` policy.
- Production changes require build/typecheck/QA before promotion.

## Initial information architecture

1. Home
2. Platform
3. Website Management
4. Client Portals
5. Forms & Lead Management
6. Media & Content
7. Automation
8. Industries / Use Cases
9. Pricing
10. About
11. Contact / Demo
12. Login
13. Privacy Policy
14. Terms & Conditions
15. Accessibility

## Homepage direction

The homepage should position TAYA as a polished website operations and client-management platform from Full Stack Tech & Solutions LLC. It should communicate that businesses can manage content, services, products, events/classes, forms, media, SEO, and client-facing operations without giving users unsafe access to source code or locked site design systems.

### Homepage sections

- Premium hero with clear TAYA value proposition
- Trust/value strip
- Platform overview
- Core capability cards
- Website management section
- Client portal / operations section
- Events and classes lifecycle section
- Forms and lead workflow section
- Media/content section
- Security and controlled-access section
- Industry/use-case section
- Pricing preview
- FAQ
- Strong demo/contact CTA
- Full FSTS ownership/legal footer

## Production requirements

- Fully responsive mobile/tablet/desktop layouts
- WCAG-minded semantic structure and keyboard navigation
- SEO metadata, canonical strategy, Open Graph and social metadata
- `robots.txt` and sitemap strategy
- Organization/Product/SoftwareApplication/FAQ structured data where appropriate
- Fast LCP and optimized media
- No important branding assets hot-linked from unrelated domains
- Branded favicon/app icons
- Clear marketing-site-to-dashboard login boundary
- No client-facing code/layout editing controls
- Security headers reviewed before production
- Analytics and consent strategy before launch
- Contact/demo forms protected against spam and abuse
- Legal/privacy/accessibility pages before production launch

## Build sequence

### Phase 1 — Foundation
- Lock marketing-site boundary and architecture
- Establish public-site package/deployment target
- Establish branding/design tokens
- Build global header/footer/navigation
- Build responsive homepage

### Phase 2 — Conversion pages
- Platform
- Features/capabilities
- Industries/use cases
- Pricing
- Demo/contact

### Phase 3 — Trust and launch readiness
- About
- FAQ
- Legal/privacy/accessibility
- SEO/schema
- Analytics/consent
- Performance/accessibility QA
- Production deployment and domain verification

## Guardrails

Do not start over on the TAYA dashboard. Do not move dashboard routes merely to accommodate marketing. Do not expose tenant administration or internal FSTS controls through the public site. Do not allow public marketing changes to alter client website design locks or production tenant data.
