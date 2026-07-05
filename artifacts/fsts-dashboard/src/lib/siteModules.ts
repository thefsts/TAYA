import { WebsiteType, type EnabledModules } from "@workspace/api-client-react";

export const WEBSITE_TYPE_LABELS: Record<string, string> = {
  business_website: "Business Website",
  ecommerce: "E-Commerce",
  security_company: "Security Company",
  training_academy: "Training Academy",
  church: "Church",
  property_management: "Property Management",
  medical: "Medical",
  legal: "Legal",
  restaurant: "Restaurant",
  membership: "Membership",
  professional_services: "Professional Services",
  construction: "Construction",
  real_estate: "Real Estate",
  manufacturing: "Manufacturing",
  custom_enterprise: "Custom Enterprise",
};

export const WEBSITE_TYPE_OPTIONS = Object.values(WebsiteType).map((value) => ({
  value,
  label: WEBSITE_TYPE_LABELS[value] ?? value,
}));

export const MODULE_KEYS = [
  "homepage",
  "courses",
  "events",
  "articles",
  "media",
  "contact",
  "footer",
  "seo",
  "payments",
  "email",
  "crm",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  homepage: "Homepage",
  courses: "Course Manager",
  events: "Event Manager",
  articles: "Articles",
  media: "Media Library",
  contact: "Contact Info",
  footer: "Footer",
  seo: "SEO Settings",
  payments: "Square Payments",
  email: "Email Config",
  crm: "Marketing & CRM",
};

const ALL_ON: EnabledModules = {
  homepage: true,
  courses: true,
  events: true,
  articles: true,
  media: true,
  contact: true,
  footer: true,
  seo: true,
  payments: true,
  email: true,
  crm: true,
};

function modules(overrides: Partial<EnabledModules>): EnabledModules {
  return { ...ALL_ON, ...overrides };
}

export const DEFAULT_MODULES_BY_WEBSITE_TYPE: Record<string, EnabledModules> = {
  business_website: modules({ courses: false, events: false }),
  ecommerce: modules({ courses: false, events: false }),
  security_company: modules({}),
  training_academy: modules({}),
  church: modules({ courses: false }),
  property_management: modules({ courses: false, events: false }),
  medical: modules({ courses: false, events: false }),
  legal: modules({ courses: false, events: false }),
  restaurant: modules({ courses: false, articles: false }),
  membership: modules({}),
  professional_services: modules({ courses: false, events: false }),
  construction: modules({ courses: false, events: false }),
  real_estate: modules({ courses: false, events: false }),
  manufacturing: modules({ courses: false, events: false }),
  custom_enterprise: modules({}),
};

export function defaultModulesForWebsiteType(type: string): EnabledModules {
  return { ...(DEFAULT_MODULES_BY_WEBSITE_TYPE[type] ?? ALL_ON) };
}
