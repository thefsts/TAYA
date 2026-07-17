/**
 * Corsair Tactical Solutions — Catalog / Pricing source of truth
 * ------------------------------------------------------------------
 * SINGLE trusted source for every payable/listable item.
 *
 * - requiredFees are ALWAYS charged; the server adds them regardless
 *   of what the client sends — they cannot be removed by the frontend.
 * - optionalAddOns are validated; unknown ids are rejected.
 * - NEVER trust a price sent from the browser. totalCents is always
 *   recomputed from this file before Square is charged.
 */

import { getAllCourses, getCourseBySlug, type Course } from '@/lib/courses';
import { upcomingEvents } from '@/data/events';

export type CatalogItemType = 'course' | 'service' | 'event';

export interface PriceFee {
  id: string;
  label: string;
  amountCents: number;
  required: boolean;
  locked: boolean;
  description?: string;
}

export interface CatalogVariation {
  id: string;
  name: string;
  priceCents: number;
}

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  type: CatalogItemType;
  category: string;
  description: string;
  /** Lowest base price in cents (first payable variation), null for contact-only. */
  priceCents: number | null;
  /** Starting base price in cents (alias for priceCents, explicit for spec clarity). */
  basePriceCents: number | null;
  currency: 'USD';
  variations: CatalogVariation[];
  /** Fees always charged — locked, cannot be removed by the customer. */
  requiredFees: PriceFee[];
  /** Optional add-ons the customer may select. */
  optionalAddOns: PriceFee[];
  squareCatalogItemId?: string;
  squareVariationId?: string;
  active: boolean;
  contactOnly: boolean;
}

const USD = 'USD' as const;

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function courseToCatalogItem(course: Course): CatalogItem {
  const payableOptions = (course.pricingOptions ?? []).filter((o) => o.price > 0);
  const variations: CatalogVariation[] = course.contactOnly
    ? []
    : payableOptions.map((o) => ({
        id: o.id,
        name: o.name,
        priceCents: toCents(o.price),
      }));

  const basePriceCents = variations.length
    ? Math.min(...variations.map((v) => v.priceCents))
    : null;

  const requiredFees: PriceFee[] = (course.requiredFees ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    amountCents: toCents(f.price),
    required: true,
    locked: true,
    description: f.description,
  }));

  const optionalAddOns: PriceFee[] = (course.optionalAddOns ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    amountCents: toCents(a.price),
    required: false,
    locked: false,
    description: a.description,
  }));

  return {
    id: `course_${course.slug}`,
    slug: course.slug,
    name: course.title,
    type: 'course',
    category: course.category,
    description: course.description,
    priceCents: basePriceCents,
    basePriceCents,
    currency: USD,
    variations,
    requiredFees,
    optionalAddOns,
    active: true,
    contactOnly: Boolean(course.contactOnly) || variations.length === 0,
  };
}

function service(
  slug: string,
  name: string,
  category: string,
  description: string
): CatalogItem {
  return {
    id: `service_${slug}`,
    slug,
    name,
    type: 'service',
    category,
    description,
    priceCents: null,
    basePriceCents: null,
    currency: USD,
    variations: [],
    requiredFees: [],
    optionalAddOns: [],
    active: true,
    contactOnly: true,
  };
}

export const services: CatalogItem[] = [
  service('armed-security-services', 'Armed Security Services', 'Security Services',
    'Licensed, commissioned armed security officers for businesses, events, and property protection.'),
  service('unarmed-security-services', 'Unarmed Security Services', 'Security Services',
    'Professional unarmed security personnel for access control, patrol, and deterrence.'),
  service('patrol-operations', 'Patrol Operations', 'Security Services',
    'Mobile and on-foot patrol services tailored to your property and schedule.'),
  service('event-security', 'Event Security', 'Security Services',
    'Trained security staffing and planning for private, corporate, and community events.'),
  service('church-safety-assessment', 'Church Safety Assessment', 'Consulting & Assessment',
    'On-site safety and security assessment plus team training for places of worship.'),
  service('property-manager-security-services', 'Property Manager Security Services', 'Security Services',
    'Dedicated security solutions for apartment communities and managed properties.'),
  service('private-investigation-consultation', 'Private Investigation Consultation', 'Consulting & Assessment',
    'Confidential consultation on investigative needs and case planning.'),
  service('security-consulting', 'Security Consulting', 'Consulting & Assessment',
    'Risk assessment, security planning, and policy development for organizations.'),
];

function eventsToCatalog(): CatalogItem[] {
  return (upcomingEvents ?? []).map((e) => ({
    id: `event_${e.slug}`,
    slug: e.slug,
    name: e.title,
    type: 'event' as const,
    category: e.category,
    description: e.shortDescription,
    priceCents: null,
    basePriceCents: null,
    currency: USD,
    variations: [],
    requiredFees: [],
    optionalAddOns: [],
    active: e.isPast !== true,
    contactOnly: true,
  }));
}

export function getCatalog(): CatalogItem[] {
  const courseItems = getAllCourses().map(courseToCatalogItem);
  return [...courseItems, ...services, ...eventsToCatalog()];
}

export function getCatalogItemBySlug(slug: string): CatalogItem | undefined {
  return getCatalog().find((item) => item.slug === slug);
}

export function getCatalogByType(type: CatalogItemType): CatalogItem[] {
  return getCatalog().filter((item) => item.type === type);
}

export function isPayable(slug: string): boolean {
  const item = getCatalogItemBySlug(slug);
  return Boolean(item && item.active && !item.contactOnly && item.variations.length > 0);
}

/** kind: 'course' = base option, 'fee' = required locked fee, 'addon' = optional add-on. */
export interface PaymentLineItem {
  kind: 'course' | 'fee' | 'addon';
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface ResolvedCoursePayment {
  course: Course;
  optionId: string;
  optionName: string;
  baseCents: number;
  requiredFeesCents: number;
  optionalAddonsCents: number;
  totalCents: number;
  appliedOptionalAddonIds: string[];
  /** Itemized breakdown: base option + required fees + selected optional add-ons. */
  lineItems: PaymentLineItem[];
}

/**
 * Server-side trusted total calculation.
 *
 * - requiredFees are ALWAYS included regardless of addOnIds sent by client.
 * - Only valid optionalAddOns are applied; unknown ids are silently ignored
 *   (they were never valid — the client cannot invent new add-ons).
 * - Frontend prices are never trusted; all amounts come from this catalog.
 */
export function resolveCoursePayment(
  slug: string,
  pricingOptionId: string,
  addOnIds: unknown
): ResolvedCoursePayment | null {
  const course = getCourseBySlug(slug);
  if (!course || course.contactOnly) return null;

  const option = course.pricingOptions.find((o) => o.id === pricingOptionId);
  if (!option || option.price <= 0) return null;

  // ── Required fees — always included, server-side, locked ─────────────────
  const allRequiredFees = course.requiredFees ?? [];
  const requiredFeesCents = allRequiredFees.reduce((sum, f) => sum + toCents(f.price), 0);

  // ── Optional add-ons — strict: reject any unrecognised id ───────────────
  const safeIds: string[] = Array.isArray(addOnIds)
    ? addOnIds.filter((id): id is string => typeof id === 'string')
    : [];
  const validOptionalIds = new Set((course.optionalAddOns ?? []).map((a) => a.id));
  if (safeIds.some((id) => !validOptionalIds.has(id))) return null;
  const appliedOptionalAddons = (course.optionalAddOns ?? []).filter(
    (a) => safeIds.includes(a.id)
  );
  const optionalAddonsCents = appliedOptionalAddons.reduce((sum, a) => sum + toCents(a.price), 0);

  const baseCents = toCents(option.price);
  const totalCents = baseCents + requiredFeesCents + optionalAddonsCents;

  const lineItems: PaymentLineItem[] = [
    {
      kind: 'course',
      id: option.id,
      name: `${course.title} — ${option.name}`,
      priceCents: baseCents,
      quantity: 1,
    },
    ...allRequiredFees.map((f) => ({
      kind: 'fee' as const,
      id: f.id,
      name: f.label,
      priceCents: toCents(f.price),
      quantity: 1,
    })),
    ...appliedOptionalAddons.map((a) => ({
      kind: 'addon' as const,
      id: a.id,
      name: a.label,
      priceCents: toCents(a.price),
      quantity: 1,
    })),
  ];

  return {
    course,
    optionId: option.id,
    optionName: option.name,
    baseCents,
    requiredFeesCents,
    optionalAddonsCents,
    totalCents,
    appliedOptionalAddonIds: appliedOptionalAddons.map((a) => a.id),
    lineItems,
  };
}
