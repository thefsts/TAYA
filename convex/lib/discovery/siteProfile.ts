/**
 * PHASE 6 — AUTO-CONFORM SITE PROFILES (Chat C).
 *
 * PURE LIBRARY — no Convex ctx, no network, no per-customer logic (§23).
 *
 * Turns a completed DiscoverySnapshot into the site-specific CAPABILITY
 * PROFILE persisted on siteContentMaps.siteProfile:
 *
 *   extractSignals(snapshot)      — the raw evidence a crawl carries:
 *                                    routes, section roles, content text,
 *                                    prices, booking/ecommerce/donation
 *                                    vocabulary, forms, videos, downloads,
 *                                    platform, hero CTA.
 *   deriveFeatures(signals)       — reusable FEATURE flags (hasBooking,
 *                                    productCatalog, courses, menu, …) that
 *                                    are the shared vocabulary between
 *                                    site-type inference and capability
 *                                    recommendations. NO rigid industry
 *                                    apps: features are shared, reusable,
 *                                    and combinable across site types.
 *   inferSiteType(signals)        — weighted, data-driven ranking of the
 *                                    11 candidate site types with evidence
 *                                    and a confidence score. Deterministic.
 *   businessTerminology(...)      — the client-facing NOUNS (what the site
 *                                    calls its repeatables) and primary
 *                                    ACTION, preferring DISCOVERED text over
 *                                    any hardcoded label.
 *   recommendCapabilities(...)    — capability recommendations split into
 *                                    autoEnabled (conformable modules —
 *                                    UI configuration only) and suggested
 *                                    (capabilities that require owner/FSTS
 *                                    approval; NEVER auto-granted).
 *   classifyEditability(...)      — per-region editability classification
 *                                    for sites TAYA did not build (and, via
 *                                    the shared pure fn, native ones too):
 *                                    FULL EDIT / REPLACE CONTENT / REORDER /
 *                                    ADD CONTENT / READ ONLY / UNSUPPORTED.
 *                                    Never claims unsupported editability —
 *                                    bridge-based sites cap at REPLACE
 *                                    CONTENT / READ ONLY / UNSUPPORTED.
 *   buildSiteProfile(...)         — the assembled profile document.
 *
 * DIRECTIVE SAFETY (Chat C §5/§6): this module only DESCRIBES the site and
 * RECOMMENDS capabilities. It grants nothing, enables nothing on its own,
 * and its output is applied by discovery.persistSnapshot under the existing
 * §7 discipline (enable-only, allowlisted, override-preserving).
 */

import type { DiscoverySnapshot } from "./crawl";
import { CONFORMABLE_MODULES, moduleForRoute } from "./contentMap";
import { CAPABILITIES } from "../capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// Signal extraction — the raw evidence a crawl carries
// ─────────────────────────────────────────────────────────────────────────────

/** Weighted evidence harvested from a completed snapshot. */
export interface SiteSignals {
  /** Route paths discovered (nav/footer/sitemap), lowercased. */
  routePaths: string[];
  /** Route labels discovered, lowercased (evidence for terminology). */
  routeLabels: string[];
  /** Section roles seen across all pages, with counts. */
  sectionRoles: Record<string, number>;
  /** Combined visible text (hero + sections + headings), lowercased. */
  siteText: string;
  /** Hero primary CTA label, as discovered. */
  heroCtaLabel: string | null;
  /** Count of `.price` content keys (prices on repeatable cards). */
  priceKeyCount: number;
  /** Count of extracted videos (embeds/files). */
  videoCount: number;
  /** Count of extracted downloads (pdf/doc/zip links). */
  downloadCount: number;
  /** Count of extracted forms. */
  formCount: number;
  /** Detected platform (shopify/wordpress/…), null when unidentified. */
  platform: string | null;
  /** Which conformable modules the snapshot's routes map to. */
  routeModules: string[];
}

/** Route-pattern signal table — DATA, not per-customer branches (§23). */
const ROUTE_SIGNALS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /^\/(shop|store|cart|checkout|catalog)(\/|$)/, signal: "route_shop" },
  { pattern: /^\/(products)(\/|$)/, signal: "route_products" },
  { pattern: /^\/(courses|training|classes|academy|programs|learn)(\/|$)/, signal: "route_training" },
  { pattern: /^\/(tours|trips|destinations|travel|itineraries|vacations|excursions)(\/|$)/, signal: "route_travel" },
  { pattern: /^\/(menu|dining)(\/|$)/, signal: "route_menu" },
  { pattern: /^\/(properties|listings|homes|real-estate|rentals|neighborhoods)(\/|$)/, signal: "route_listings" },
  { pattern: /^\/(book|booking|book-now|appointments|schedule|reservations|reserve)(\/|$)/, signal: "route_booking" },
  { pattern: /^\/(donate|donations|support-us|give)(\/|$)/, signal: "route_donate" },
  { pattern: /^\/(events|calendar|upcoming)(\/|$)/, signal: "route_events" },
  { pattern: /^\/(membership|members|join|plans)(\/|$)/, signal: "route_membership" },
  { pattern: /^\/(pricing)(\/|$)/, signal: "route_pricing" },
  { pattern: /^\/(about|team|our-team|staff|instructors)(\/|$)/, signal: "route_team" },
  { pattern: /^\/(blog|articles|news|journal|resources|guides)(\/|$)/, signal: "route_articles" },
  { pattern: /^\/(faq|questions)(\/|$)/, signal: "route_faq" },
  { pattern: /^\/(testimonials|reviews)(\/|$)/, signal: "route_testimonials" },
  { pattern: /^\/(services|offerings|solutions|what-we-do)(\/|$)/, signal: "route_services" },
  { pattern: /^\/(downloads|resources\/downloads|documents|media)(\/|$)/, signal: "route_downloads" },
  { pattern: /^\/(careers|jobs)(\/|$)/, signal: "route_careers" },
  { pattern: /^\/(contact|contact-us|get-in-touch|quote|estimate)(\/|$)/, signal: "route_contact" },
];

/** Text-vocabulary signal table — DATA. */
const TEXT_SIGNALS: Array<{ pattern: RegExp; signal: string; weight?: number }> = [
  { pattern: /\b(add to cart|checkout|buy now|shop now|our shop|online store)\b/, signal: "text_shop" },
  { pattern: /\$\s?\d[\d,]*(\.\d{2})?/, signal: "text_price", weight: 1 },
  { pattern: /\b(enroll|enrolment|enrollment|certification|curriculum|students|our courses|course catalog)\b/, signal: "text_training" },
  { pattern: /\b(guided tour|our tours|book a tour|day tour|multi-day|itinerary|destinations|travel packages)\b/, signal: "text_travel" },
  { pattern: /\b(our menu|full menu|dinner menu|lunch menu|reservations?|catering|our chef|fine dining)\b/, signal: "text_restaurant" },
  { pattern: /\b(listing|listings|property|properties|bedrooms?|bathrooms?|sq\.? ?ft|square feet|realtor|open house|mls)\b/, signal: "text_realestate" },
  { pattern: /\b(become a member|membership|members only|join now|subscribe|subscription plans)\b/, signal: "text_membership" },
  { pattern: /\b(donate|donation|make a gift|501\(c\)|nonprofit|non-profit|tax-deductible)\b/, signal: "text_donate" },
  { pattern: /\b(book now|book an appointment|schedule an appointment|make a reservation|reserve your|appointment request)\b/, signal: "text_booking" },
  { pattern: /\b(get a quote|free consultation|request a quote|free estimate|contact us for a|let's talk)\b/, signal: "text_leadgen" },
  { pattern: /\b(our services|what we offer|service areas|our team|our staff|how it works)\b/, signal: "text_services" },
];

/** Extract the weighted evidence from a completed snapshot. PURE. */
export function extractSignals(snapshot: DiscoverySnapshot): SiteSignals {
  const sectionRoles: Record<string, number> = {};
  const textParts: string[] = [];
  let heroCtaLabel: string | null = null;
  let priceKeyCount = 0;
  let videoCount = 0;
  let downloadCount = 0;
  let formCount = 0;

  for (const page of snapshot.pages) {
    if (page.status !== "fetched" || !page.model) continue;
    const model = page.model;
    if (model.hero.primaryButton?.label) heroCtaLabel ??= model.hero.primaryButton.label;
    if (model.hero.heading) textParts.push(model.hero.heading);
    if (model.hero.subheading) textParts.push(model.hero.subheading);
    for (const section of model.sections) {
      sectionRoles[section.role] = (sectionRoles[section.role] ?? 0) + 1;
      if (section.heading) textParts.push(section.heading);
      if (section.body) textParts.push(section.body);
      for (const item of section.items) {
        if (item.title) textParts.push(item.title);
        if (item.description) textParts.push(item.description);
      }
    }
    for (const h of model.headings) textParts.push(h.text);
    videoCount += (model as any).videos?.length ?? 0;
    downloadCount += (model as any).downloads?.length ?? 0;
    formCount += model.forms.length;
  }

  // Price keys come from the folded content map (single source of truth).
  for (const [key, entry] of Object.entries(snapshot.contentMap)) {
    if (key.endsWith(".price") && entry.value) priceKeyCount++;
  }

  const routeModules = new Set<string>();
  for (const route of snapshot.routes) {
    const moduleKey = moduleForRoute(route.path);
    if (moduleKey) routeModules.add(moduleKey);
  }

  return {
    routePaths: snapshot.routes.map((r) => r.path.toLowerCase()),
    routeLabels: snapshot.routes.map((r) => r.label.toLowerCase()),
    sectionRoles,
    siteText: textParts.join(" \u2022 ").toLowerCase(),
    heroCtaLabel,
    priceKeyCount,
    videoCount,
    downloadCount,
    formCount,
    platform: snapshot.platform ? snapshot.platform.toLowerCase() : null,
    routeModules: [...routeModules],
  };
}

function routeSignal(signals: SiteSignals, signal: string): boolean {
  return signals.routePaths.some((p) => {
    for (const row of ROUTE_SIGNALS) {
      if (row.signal !== signal) continue;
      if (row.pattern.test(p)) return true;
    }
    return false;
  });
}

function textSignal(signals: SiteSignals, signal: string): number {
  let hits = 0;
  for (const row of TEXT_SIGNALS) {
    if (row.signal !== signal) continue;
    if (row.pattern.test(signals.siteText)) hits += row.weight ?? 2;
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Features — the REUSABLE vocabulary shared by inference + recommendations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature flags: reusable capabilities a site demonstrates, independent of
 * the industry label. Recommendations and terminology are driven by
 * FEATURES so a new/unknown site type still gets correct recommendations —
 * no rigid industry applications (Chat C §2).
 */
export interface SiteFeatures {
  productCatalog: boolean;
  booking: boolean;
  courses: boolean;
  events: boolean;
  articles: boolean;
  testimonials: boolean;
  team: boolean;
  faq: boolean;
  downloads: boolean;
  videos: boolean;
  donations: boolean;
  membership: boolean;
  menu: boolean;
  listings: boolean;
  tours: boolean;
  contactForm: boolean;
  leadGen: boolean;
  pricing: boolean;
  services: boolean;
  careers: boolean;
}

/** Derive reusable features from signals. PURE. */
export function deriveFeatures(signals: SiteSignals): SiteFeatures {
  const has = (signal: string) => routeSignal(signals, signal);
  const text = (signal: string) => textSignal(signals, signal) > 0;
  const roleCount = (role: string) => signals.sectionRoles[role] ?? 0;

  return {
    // Product catalog = COMMERCE evidence only: shop/products routes, a
    // products section, shop vocabulary, or a storefront platform. Prices
    // alone are NOT catalog evidence — a priced menu/tour/course list is
    // repeatable content, not a storefront (kept as secondary weight in
    // TYPE_WEIGHTS.ecommerce instead, stacking only when commerce evidence
    // is present).
    productCatalog:
      has("route_shop") || has("route_products") || roleCount("products") > 0 ||
      text("text_shop") || signals.platform === "shopify",
    booking:
      has("route_booking") || text("text_booking") ||
      /\b(book|reserve|schedule)\b/i.test(signals.heroCtaLabel ?? ""),
    courses: has("route_training") || signals.routeModules.includes("courses") || text("text_training"),
    events: has("route_events") || signals.routeModules.includes("events") || roleCount("events") > 0,
    articles: has("route_articles") || signals.routeModules.includes("articles") || roleCount("blog") > 0,
    testimonials:
      has("route_testimonials") || roleCount("testimonials") > 0 || signals.routeModules.includes("testimonials"),
    team: has("route_team") || roleCount("team") > 0 || signals.routeModules.includes("team"),
    faq: has("route_faq") || roleCount("faq") > 0 || signals.routeModules.includes("faq"),
    downloads:
      has("route_downloads") || signals.downloadCount > 0 || signals.routeModules.includes("downloads"),
    videos: signals.videoCount > 0,
    donations: has("route_donate") || text("text_donate"),
    membership: has("route_membership") || text("text_membership") || roleCount("pricing") > 0,
    menu: has("route_menu") || roleCount("menu") > 0 || text("text_restaurant"),
    listings: has("route_listings") || text("text_realestate"),
    tours: has("route_travel") || text("text_travel") || roleCount("tours") > 0,
    contactForm: signals.formCount > 0,
    leadGen: text("text_leadgen"),
    pricing: has("route_pricing") || roleCount("pricing") > 0,
    services:
      has("route_services") || signals.routeModules.includes("services") || roleCount("services") > 0,
    careers: has("route_careers") || signals.routeModules.includes("careers"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Site-type inference — weighted, data-driven, deterministic
// ─────────────────────────────────────────────────────────────────────────────

/** Candidate site types (aligned with existing websiteType vocabulary). */
export const SITE_TYPE_CANDIDATES = [
  "training_academy",
  "ecommerce",
  "travel",
  "restaurant",
  "real_estate",
  "membership",
  "nonprofit",
  "booking",
  "lead_generation",
  "service_business",
  "business_website",
] as const;

export type SiteType = (typeof SITE_TYPE_CANDIDATES)[number];

/**
 * Weight table: each candidate scores evidence from features + signals.
 * DATA — a new candidate is a new row, not a new code path (§23).
 */
const TYPE_WEIGHTS: Array<{
  type: SiteType;
  score: (s: SiteSignals, f: SiteFeatures) => number;
}> = [
  {
    type: "ecommerce",
    // Prices are SECONDARY evidence: they add weight only when real
    // commerce evidence (catalog feature, shop vocabulary, storefront
    // platform) exists. A priced menu/tour/course list is NOT a storefront.
    score: (s, f) =>
      (f.productCatalog ? 4 : 0) +
      (f.productCatalog ? Math.min(3, s.priceKeyCount) : 0) +
      Math.min(2, Math.floor(textSignal(s, "text_shop") / 2)) +
      (s.platform === "shopify" ? 3 : 0),
  },
  {
    type: "training_academy",
    score: (s, f) =>
      (f.courses ? 4 : 0) +
      (s.sectionRoles["services"] && f.courses ? 2 : 0) +
      Math.min(2, Math.floor(textSignal(s, "text_training") / 2)),
  },
  {
    type: "travel",
    score: (s, f) => (f.tours ? 4 : 0) + (f.listings && f.tours ? 1 : 0) + (f.booking && f.tours ? 1 : 0),
  },
  {
    type: "restaurant",
    score: (s, f) => (f.menu ? 4 : 0) + (f.booking && f.menu ? 1 : 0) + (f.booking && f.menu && f.team ? 1 : 0),
  },
  {
    type: "real_estate",
    score: (s, f) =>
      (f.listings ? 4 : 0) + (f.listings && f.team ? 1 : 0) + (f.listings && f.leadGen ? 1 : 0),
  },
  {
    type: "membership",
    score: (s, f) =>
      (f.membership ? 3 : 0) + (f.membership && f.pricing ? 1 : 0) + (f.membership && f.events ? 1 : 0),
  },
  {
    type: "nonprofit",
    score: (s, f) => (f.donations ? 4 : 0) + (f.donations && f.events ? 1 : 0) + (f.donations && f.team ? 1 : 0),
  },
  {
    type: "booking",
    score: (s, f) => (f.booking ? 4 : 0) + (f.booking && f.pricing ? 1 : 0) + (f.booking && f.team ? 1 : 0),
  },
  {
    type: "lead_generation",
    score: (s, f) => (f.leadGen ? 4 : 0) + (f.leadGen && f.contactForm ? 1 : 0) + (f.leadGen && f.team ? 1 : 0),
  },
  {
    type: "service_business",
    score: (s, f) => (f.services ? 2 : 0) + (f.team ? 1 : 0) + (f.testimonials ? 1 : 0) + (f.faq ? 1 : 0),
  },
  { type: "business_website", score: () => 1 },
];

export interface SiteTypeInference {
  /** The inferred type (never null; business_website = unclassified). */
  type: SiteType;
  /** 0..1 confidence. */
  confidence: number;
  /** Ranked evidence lines (§14 — the report says what was found). */
  evidence: string[];
  /** Runner-up types with scores, deterministic order. */
  runnerUps: Array<{ type: SiteType; score: number }>;
}

/** Infer the site type from weighted evidence. PURE, deterministic. */
export function inferSiteType(signals: SiteSignals, features: SiteFeatures): SiteTypeInference {
  const scored = TYPE_WEIGHTS.map((row) => ({
    type: row.type,
    score: row.score(signals, features),
  })).sort((a, b) => (b.score - a.score) || (SITE_TYPE_CANDIDATES.indexOf(a.type) - SITE_TYPE_CANDIDATES.indexOf(b.type)));

  const top = scored[0];
  const runnerUps = scored.slice(1, 4).filter((r) => r.score > 0);

  if (top.score <= 1) {
    return {
      type: "business_website",
      confidence: 0.3,
      evidence: ["No strong business-type signals in the crawl — treated as a general business website."],
      runnerUps: [],
    };
  }

  const second = scored[1]?.score ?? 0;
  const confidence =
    second > 0
      ? Math.round((top.score / (top.score + second)) * 100) / 100
      : Math.min(0.95, 0.6 + 0.08 * top.score);

  // Human-readable evidence for the report (§14: explicit, never fabricated).
  const evidence: string[] = [];
  const push = (cond: boolean, line: string) => {
    if (cond) evidence.push(line);
  };
  push(features.productCatalog, "Product catalog signals (shop/products routes, storefront vocabulary, or a commerce platform).");
  push(features.courses, "Training/course signals (courses or training routes, curriculum vocabulary).");
  push(features.tours, "Travel signals (tours, trips, destinations, or itineraries).");
  push(features.menu, "Restaurant signals (menu/dining routes or vocabulary).");
  push(features.listings, "Real-estate signals (properties, listings, bedrooms, or realtor vocabulary).");
  push(features.membership, "Membership signals (join/membership routes or subscription vocabulary).");
  push(features.donations, "Nonprofit signals (donate routes or donation vocabulary).");
  push(features.booking, "Booking signals (booking routes, appointment vocabulary, or a booking CTA).");
  push(features.leadGen, "Lead-generation signals (quote/consultation/estimate vocabulary).");
  push(features.services, "Service-business signals (services routes or sections).");
  if (signals.platform) evidence.push(`Platform detected: ${signals.platform}.`);

  return { type: top.type, confidence: Math.round(confidence * 100) / 100, evidence, runnerUps };
}

// ─────────────────────────────────────────────────────────────────────────────
// Business terminology — prefer DISCOVERED words over hardcoded labels
// ─────────────────────────────────────────────────────────────────────────────

export interface BusinessTerminology {
  /** What this site calls its repeatable offering (Services/Trips/…). */
  primaryNoun: string;
  /** The site's primary action verb phrase (Book now/Enroll/…). */
  primaryAction: string | null;
  /** Where each value came from (§14 evidence). */
  evidence: { primaryNoun: string; primaryAction: string };
}

/** Terminology feature → default noun. DATA, fallback only. */
const FEATURE_NOUNS: Array<{ feature: keyof SiteFeatures; noun: string }> = [
  { feature: "tours", noun: "Trips" },
  { feature: "courses", noun: "Courses" },
  { feature: "menu", noun: "Menu" },
  { feature: "listings", noun: "Listings" },
  { feature: "productCatalog", noun: "Products" },
  { feature: "services", noun: "Services" },
];

/** Derive the client-facing vocabulary. PURE. */
export function businessTerminology(signals: SiteSignals, features: SiteFeatures): BusinessTerminology {
  // Prefer the site's own nav labels for the primary noun.
  const nounCandidates = ["services", "courses", "trips", "tours", "menu", "products", "shop", "listings", "properties", "classes", "training"];
  const discovered = signals.routeLabels.find((label) =>
    nounCandidates.some((n) => label.includes(n)),
  );
  let primaryNoun: string;
  let nounEvidence: string;
  if (discovered) {
    primaryNoun = discovered.replace(/^(our|the)\s+/, "").trim();
    primaryNoun = primaryNoun.charAt(0).toUpperCase() + primaryNoun.slice(1);
    nounEvidence = `discovered nav label "${discovered}"`;
  } else {
    const fallback = FEATURE_NOUNS.find((row) => features[row.feature]);
    primaryNoun = fallback?.noun ?? "Content";
    nounEvidence = `derived from detected features (no explicit label discovered)`;
  }
  return {
    primaryNoun,
    primaryAction: signals.heroCtaLabel,
    evidence: { primaryNoun: nounEvidence, primaryAction: signals.heroCtaLabel ? "discovered hero CTA label" : "no CTA discovered" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability recommendations — reusable across ALL site types
// ─────────────────────────────────────────────────────────────────────────────

export interface CapabilityRecommendation {
  capabilityId: string;
  label: string;
  /** Why this was recommended — feature-driven, never industry-hardcoded. */
  reason: string;
  /** Module key when the recommendation maps to a conformable module. */
  moduleKey: string | null;
}

export interface CapabilityRecommendations {
  /** Conformable modules auto-conform may ENABLE (UI config only, §7). */
  autoEnabled: CapabilityRecommendation[];
  /** Capabilities that require owner/FSTS approval — NEVER auto-granted. */
  suggested: CapabilityRecommendation[];
}

const capabilityLabel = (id: string): string =>
  CAPABILITIES.find((c) => c.id === id)?.label ?? id;

/** Feature → conformable module table. DATA. */
const FEATURE_MODULES: Array<{ feature: keyof SiteFeatures; module: string; reason: string }> = [
  { feature: "courses", module: "courses", reason: "Training/course content discovered." },
  { feature: "events", module: "events", reason: "Events or calendar content discovered." },
  { feature: "articles", module: "articles", reason: "Blog/articles content discovered." },
  { feature: "productCatalog", module: "products", reason: "Product catalog signals discovered." },
  { feature: "services", module: "services", reason: "Services content discovered." },
  { feature: "menu", module: "services", reason: "Menu content discovered (managed as repeatable service items)." },
  { feature: "listings", module: "services", reason: "Property listings discovered (managed as repeatable items)." },
  { feature: "tours", module: "services", reason: "Trips/tours discovered (managed as repeatable items)." },
  { feature: "team", module: "team", reason: "Team/staff content discovered." },
  { feature: "faq", module: "faq", reason: "FAQ content discovered." },
  { feature: "testimonials", module: "testimonials", reason: "Testimonials/reviews discovered." },
  { feature: "downloads", module: "downloads", reason: "Downloadable resources discovered." },
  { feature: "careers", module: "careers", reason: "Careers content discovered." },
];

/** Feature → suggested (approval-required) capability table. DATA. */
const FEATURE_SUGGESTED: Array<{ feature: keyof SiteFeatures; capabilityId: string; reason: string }> = [
  { feature: "contactForm", capabilityId: "manage_forms", reason: "Contact/lead forms discovered on the site." },
  { feature: "contactForm", capabilityId: "view_inbox", reason: "Form submissions should land in an inbox." },
  { feature: "booking", capabilityId: "manage_forms", reason: "Booking requests are best captured as managed forms." },
  { feature: "booking", capabilityId: "manage_pricing", reason: "Bookable offerings usually need pricing/payment display settings." },
  { feature: "leadGen", capabilityId: "manage_forms", reason: "Lead-capture vocabulary (quotes/consultations) discovered." },
  { feature: "leadGen", capabilityId: "view_inbox", reason: "Lead submissions should land in an inbox." },
  { feature: "donations", capabilityId: "manage_forms", reason: "Donation intent discovered — capture it with a managed form." },
  { feature: "membership", capabilityId: "manage_pricing", reason: "Membership/subscription plans discovered." },
  { feature: "productCatalog", capabilityId: "manage_pricing", reason: "Product pricing discovered." },
  { feature: "videos", capabilityId: "manage_media", reason: "Video embeds discovered — manage them in the media library." },
  { feature: "downloads", capabilityId: "manage_downloads", reason: "Downloadable documents discovered." },
  { feature: "testimonials", capabilityId: "manage_testimonials", reason: "Reviews/testimonials discovered." },
];

/** Recommend capabilities from FEATURES (reusable across all site types). PURE. */
export function recommendCapabilities(
  features: SiteFeatures,
  /** Inferred site type (§2 inference) — the restaurant commerce policy
   *  below keys off it. Optional: pure/legacy callers without a type keep
   *  the universal behavior. */
  inferredSiteType?: string | null,
): CapabilityRecommendations {
  const autoEnabled: CapabilityRecommendation[] = [];
  const seenModules = new Set<string>();
  // PM locked rule (restaurant convergence): a restaurant site NEVER gets
  // the generic `products` module auto-enabled — even when genuine
  // storefront/catalog evidence exists. That evidence surfaces honestly as
  // an ADVISORY (suggested) recommendation for the owner instead; only an
  // explicit owner/FSTS decision turns Products on (§6). All other site
  // types keep the existing universal behavior.
  const restaurantNoProducts = inferredSiteType === "restaurant" ? "products" : null;
  const advisory: CapabilityRecommendation[] = [];
  for (const row of FEATURE_MODULES) {
    if (!features[row.feature]) continue;
    if (!CONFORMABLE_MODULES.includes(row.module)) continue;
    if (seenModules.has(row.module)) continue;
    seenModules.add(row.module);
    if (row.module === restaurantNoProducts) {
      // Genuine catalog/storefront signals on a restaurant site: report
      // them (transparency, §14) but require an owner decision — never an
      // automatic enablement.
      advisory.push({
        capabilityId: `module:${row.module}`,
        label: "Products",
        reason: "Storefront/catalog signals discovered on a restaurant site — enable the Products module only if you sell online (owner decision).",
        moduleKey: null,
      });
      continue;
    }
    autoEnabled.push({
      capabilityId: `module:${row.module}`,
      label: capabilityLabel(`module:${row.module}`) === `module:${row.module}` ? row.module : row.module,
      reason: row.reason,
      moduleKey: row.module,
    });
  }

  const suggested: CapabilityRecommendation[] = [];
  const seenCapabilities = new Set<string>();
  for (const row of FEATURE_SUGGESTED) {
    if (!features[row.feature]) continue;
    if (seenCapabilities.has(row.capabilityId)) continue;
    seenCapabilities.add(row.capabilityId);
    suggested.push({
      capabilityId: row.capabilityId,
      label: capabilityLabel(row.capabilityId),
      reason: row.reason,
      moduleKey: null,
    });
  }

  // Restaurant commerce advisory (PM locked rule): the products-module
  // recommendation displaced from autoEnabled lands here, with moduleKey
  // null so it can never be mistaken for an automatic enablement.
  for (const item of advisory) {
    if (!suggested.some((s) => s.capabilityId === item.capabilityId)) {
      suggested.push(item);
    }
  }

  // SEO is universally recommended (content tier, always safe to suggest).
  if (!suggested.some((s) => s.capabilityId === "configure_seo")) {
    suggested.push({
      capabilityId: "configure_seo",
      label: capabilityLabel("configure_seo"),
      reason: "SEO settings are recommended for every site.",
      moduleKey: null,
    });
  }

  return { autoEnabled, suggested };
}

// ─────────────────────────────────────────────────────────────────────────────
// External-site editability classification (Chat C §4)
// ─────────────────────────────────────────────────────────────────────────────

/** The locked classification vocabulary (§4). */
export const EDITABILITY_LEVELS = [
  "FULL_EDIT",
  "REPLACE_CONTENT",
  "REORDER",
  "ADD_CONTENT",
  "READ_ONLY",
  "UNSUPPORTED",
] as const;

export type EditabilityLevel = (typeof EDITABILITY_LEVELS)[number];

export interface EditabilityArea {
  /** Region identifier: a page path, a content-type band, or a route. */
  area: string;
  classification: EditabilityLevel;
  /** Human explanation of what the classification means here. */
  note: string;
  /** Affected §5 content-key prefixes (evidence). */
  keyPrefixes: string[];
}

export interface EditabilityClassification {
  areas: EditabilityArea[];
  /** Counts per classification (summary for the report). */
  summary: Record<EditabilityLevel, number>;
}

/** Routes owned by external platforms/dynamic engines — never editable. */
const PLATFORM_LOCKED_ROUTES: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /^\/(cart|checkout|checkout\/.*)$/, note: "Checkout flow is owned by the external platform." },
  { pattern: /^\/(cart|checkout)/, note: "Commerce flow is owned by the external platform." },
  { pattern: /^\/(my-account|account|login|signin|signup|register)/, note: "Account/auth flow is owned by the external platform." },
  { pattern: /^\/(book|booking)\b.*(widget|engine|calendar)/, note: "Booking engine is owned by the external platform." },
];

/** Classify a discovered region band of content keys. */
function classifyKeyBand(
  classification: EditabilityLevel,
  note: string,
  keyPrefixes: string[],
): EditabilityArea {
  return { area: keyPrefixes.join(", ") || "(none)", classification, note, keyPrefixes };
}

/**
 * Classify discovered regions for editability (§4). For sites TAYA did NOT
 * build, this is the honest map of what TAYA can and cannot do — it NEVER
 * claims editability beyond what the §5 map + connection mode support.
 * The honest boundary is the bridge runtime (lib/web-bridge/src/snippet.ts):
 * it applies published/draft VALUES to existing [data-taya-edit] elements
 * (textContent/src/href) — replacement only. Bridge v1 has no reordering
 * and no insertion mechanism, so bridge-based modes never claim FULL_EDIT,
 * REORDER, or ADD_CONTENT:
 *
 *  - TAYA_NATIVE: content is served by TAYA's own editors/managers
 *    (CoursesList/ProductsManager/ServicesManager/homepage sections), which
 *    genuinely support full edit, reorder, and add — FULL_EDIT / REORDER /
 *    ADD_CONTENT are honest claims for native mapped regions.
 *  - TAYA_CONNECTED / DISCOVERED_EXTERNAL (bridge-based external sites):
 *    text, images, links, and repeatable entries are REPLACE_CONTENT
 *    (drafted now, published after ownership verification); mapped pages
 *    are replacement surfaces, not insertion zones; external embeds/assets
 *    (videos, downloads) are READ_ONLY (they point at third-party hosts);
 *    platform-locked routes are UNSUPPORTED. Verification (TAYA_CONNECTED)
 *    unlocks PUBLISHING of replacements — it does not add editing
 *    operations the bridge does not have.
 */
export function classifyEditability(
  snapshot: DiscoverySnapshot,
  connectionMode: string | null,
): EditabilityClassification {
  const areas: EditabilityArea[] = [];
  // Only TAYA-served sites get full/reorder/add claims: their content is
  // edited through TAYA's real editors and managers. TAYA_CONNECTED is an
  // external site with the bridge installed (schema connectionMode docs) —
  // the bridge is replacement-only, so it classifies with the external lane.
  const native = connectionMode === "TAYA_NATIVE";

  // Band the §5 keys by suffix family. Index segments normalize to [*] so
  // services.items[0]…[11] fold into ONE band (services.items[*].title).
  const bands: Record<string, string[]> = {};
  for (const key of Object.keys(snapshot.contentMap)) {
    const suffix = key.replace(/\[\d+\]/g, "[*]").split(".").slice(-2).join(".");
    (bands[suffix] ??= []).push(key.replace(/\.\w+$/, ""));
  }

  // Suffix matchers tolerate the [*] index suffix of array bands.
  const endsWith = (band: string, ...words: string[]) => {
    const last = band.split(".").pop() ?? "";
    const bare = last.replace(/\[\*\]$/, "");
    return words.includes(bare);
  };
  const textBands = Object.keys(bands).filter((b) =>
    endsWith(b, "heading", "body", "title", "description", "subheading", "text", "label", "price"),
  );
  const imageBands = Object.keys(bands).filter((b) => endsWith(b, "image", "images"));
  const listBands = Object.keys(bands).filter((b) => endsWith(b, "buttons", "links", "list_item"));
  const itemBands = Object.keys(bands).filter((b) => b.includes("items"));
  // Video/download bands are two-segment: videos[*].src / downloads[*].href.
  const videoBands = Object.keys(bands).filter((b) => /^videos\[\*\]\./.test(b));
  const downloadBands = Object.keys(bands).filter((b) => /^downloads\[\*\]\./.test(b));

  if (textBands.length > 0) {
    areas.push(
      native
        ? classifyKeyBand("FULL_EDIT", "Text content is fully editable through TAYA's own editors.", textBands)
        : classifyKeyBand("REPLACE_CONTENT", "Text can be replaced in drafts; publishing unlocks after ownership verification.", textBands),
    );
  }
  if (imageBands.length > 0) {
    areas.push(
      native
        ? classifyKeyBand("FULL_EDIT", "Images are fully editable through TAYA's own editors.", imageBands)
        : classifyKeyBand("REPLACE_CONTENT", "Images can be swapped in drafts; publishing unlocks after ownership verification.", imageBands),
    );
  }
  if (itemBands.length > 0) {
    areas.push(
      native
        ? classifyKeyBand("FULL_EDIT", "Repeatable items are fully editable.", itemBands)
        : // Bridge v1 replaces values on existing elements; it cannot
          // reorder DOM nodes. Entries are replaceable in place — honest
          // classification is REPLACE_CONTENT, never REORDER.
          classifyKeyBand(
            "REPLACE_CONTENT",
            "Repeatable entry values (titles, descriptions, links) can be replaced in drafts; the bridge cannot reorder or insert list items, so list structure stays as-is.",
            itemBands,
          ),
    );
  }
  if (listBands.length > 0) {
    areas.push(
      native
        ? classifyKeyBand("FULL_EDIT", "Buttons/links are fully editable.", listBands)
        : classifyKeyBand("REPLACE_CONTENT", "Button/link labels can be replaced in drafts; targets stay stable.", listBands),
    );
  }

  // Sections/pages: mapped pages are honest ADD_CONTENT ONLY for TAYA_NATIVE
  // (TAYA's own managers add real sections/pages through its content APIs).
  // Bridge-based sites have no insertion mechanism — the draft overlay
  // applies values to EXISTING [data-taya-edit] elements only, so "no safe
  // insertion zone → do not advertise insertion" (§4). Verified ownership
  // publishes replacements; it never manufactures an insertion zone.
  const pagePaths = snapshot.pages.filter((p) => p.status === "fetched").map((p) => p.path);
  if (pagePaths.length > 0) {
    areas.push(
      native
        ? classifyKeyBand(
            "ADD_CONTENT",
            "New sections/pages can be added and published through TAYA.",
            pagePaths.map((p) => p),
          )
        : classifyKeyBand(
            "REPLACE_CONTENT",
            "Existing mapped content on these pages can be replaced in drafts; the bridge has no insertion mechanism, so new sections/pages cannot be added — publishing unlocks after ownership verification.",
            pagePaths.map((p) => p),
          ),
    );
  }

  if (videoBands.length > 0) {
    areas.push(
      classifyKeyBand(
        "READ_ONLY",
        "Embedded videos are hosted by third parties (YouTube/Vimeo/…); TAYA maps them but cannot re-host them.",
        videoBands,
      ),
    );
  }
  if (downloadBands.length > 0) {
    areas.push(
      classifyKeyBand(
        "READ_ONLY",
        "Downloadable files are served from the external site's asset host; TAYA maps them but cannot replace the files.",
        downloadBands,
      ),
    );
  }

  // Platform-locked routes: honest UNSUPPORTED, whatever the connection mode.
  for (const route of snapshot.routes) {
    const locked = PLATFORM_LOCKED_ROUTES.find((row) => row.pattern.test(route.path.toLowerCase()));
    if (locked) {
      areas.push({
        area: `route:${route.path}`,
        classification: "UNSUPPORTED",
        note: locked.note,
        keyPrefixes: [route.path],
      });
    }
  }

  const summary: Record<EditabilityLevel, number> = {
    FULL_EDIT: 0,
    REPLACE_CONTENT: 0,
    REORDER: 0,
    ADD_CONTENT: 0,
    READ_ONLY: 0,
    UNSUPPORTED: 0,
  };
  for (const area of areas) summary[area.classification] += 1;

  return { areas, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// The assembled site profile (persisted on siteContentMaps.siteProfile)
// ─────────────────────────────────────────────────────────────────────────────

export interface SiteProfile {
  /** Profile format version. */
  version: 1;
  generatedAt: number;
  /** Inferred business/site type + confidence + evidence (§2). */
  siteType: SiteTypeInference;
  /** Client-facing vocabulary (§2 — prefers discovered words). */
  terminology: BusinessTerminology;
  /** Capability recommendations (§2/§5 — suggest-only for non-conformable). */
  capabilities: CapabilityRecommendations;
  /** Content types the crawl discovered (§3). */
  contentTypes: {
    discovered: string[];
    editable: string[];
  };
  /** Editability map for discovered regions (§4). */
  editability: EditabilityClassification;
  /** Raw signal snapshot (evidence; small + deterministic). */
  signals: {
    platform: string | null;
    routeCount: number;
    pageCount: number;
    keyCount: number;
    priceKeyCount: number;
    videoCount: number;
    downloadCount: number;
    formCount: number;
    heroCtaLabel: string | null;
    topSectionRoles: Array<[string, number]>;
  };
}

/**
 * Build the full site profile from a completed snapshot. PURE and
 * deterministic: same snapshot + connection mode → identical profile
 * (pinned by tests). Applied by discovery.persistSnapshot atomically with
 * the snapshot; safe to re-run (idempotent upsert — no duplicates).
 */
export function buildSiteProfile(
  snapshot: DiscoverySnapshot,
  connectionMode: string | null,
): SiteProfile {
  const signals = extractSignals(snapshot);
  const features = deriveFeatures(signals);
  const siteType = inferSiteType(signals, features);
  const terminology = businessTerminology(signals, features);
  const capabilities = recommendCapabilities(features, siteType.type);
  const editability = classifyEditability(snapshot, connectionMode);

  const discoveredTypes = new Set<string>();
  for (const entry of Object.values(snapshot.contentMap)) {
    discoveredTypes.add(entry.type);
  }
  const editableTypes = [...discoveredTypes].filter(
    (type) => type !== "video" && type !== "download",
  );

  const topSectionRoles = Object.entries(signals.sectionRoles)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 6);

  return {
    version: 1,
    generatedAt: snapshot.crawlCompletedAt,
    siteType,
    terminology,
    capabilities,
    contentTypes: { discovered: [...discoveredTypes].sort(), editable: [...editableTypes].sort() },
    editability,
    signals: {
      platform: signals.platform,
      routeCount: snapshot.routes.length,
      pageCount: snapshot.pages.filter((p) => p.status === "fetched").length,
      keyCount: snapshot.keyCount,
      priceKeyCount: signals.priceKeyCount,
      videoCount: signals.videoCount,
      downloadCount: signals.downloadCount,
      formCount: signals.formCount,
      heroCtaLabel: signals.heroCtaLabel,
      topSectionRoles,
    },
  };
}
