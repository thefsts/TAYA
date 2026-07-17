/**
 * Corsair Tactical Solutions — Events data
 */

export type EventCategory =
  | 'Firearms Training'
  | 'LTC Certification'
  | "Women's Training"
  | 'Church Safety'
  | 'Security Training'
  | 'Community Safety'
  | 'Private Event';

interface CorsairEventBase {
  id: string;
  title: string;
  slug: string;
  date: string;
  dateDisplay: string;
  time: string;
  location: string;
  category: EventCategory;
  shortDescription: string;
  description: string;
  flyerImage?: string;
  heroImage: string;
  galleryImages?: string[];
  registrationUrl?: string;
  contactCta?: string;
  isPast?: boolean;
}

/**
 * Contact-only event — registration or inquiry is handled via contact form,
 * phone, or external link. No online Square payment.
 */
export interface CorsairEventContact extends CorsairEventBase {
  paymentMode: 'contact';
  courseSlug?: never;
}

/**
 * Online-payment event — wired to a payable catalog entry via courseSlug.
 * courseSlug MUST match a slug that exists in the catalog AND is payable
 * (not contact-only). A typo is caught at build/test time by
 * validatePaidEventCourseReferences() / validateEventCourseSlug().
 */
export interface CorsairEventOnline extends CorsairEventBase {
  paymentMode: 'online';
  courseSlug: string;
}

export type CorsairEvent = CorsairEventContact | CorsairEventOnline;

export const upcomingEvents: CorsairEvent[] = [
  {
    id: 'ltc-class-jun2026',
    paymentMode: 'contact',
    slug: 'texas-ltc-certification-class-jun2026',
    title: 'Texas LTC Certification Class',
    date: '2026-06-13',
    dateDisplay: 'June 13, 2026',
    time: '8:30 AM – 3:30 PM CT',
    location: 'Addison, TX (Classroom) · Farmers Branch, TX (Range)',
    category: 'LTC Certification',
    shortDescription:
      'Complete your Texas License to Carry in one day. Classroom at Hilton Garden Inn, Addison — shooting qualification at Eagle Gun Range, Farmers Branch.',
    description:
      'One-day Texas LTC certification. Classroom covers LTC laws, non-violent dispute resolution, handgun safety and use. Live-fire shooting proficiency at Eagle Gun Range. Bring your handgun, 50 rounds of ammo, eye and ear protection, and valid photo ID. Range fee paid separately at the range.',
    flyerImage: '/images/events/flyers/texas-ltc-jun2026.png',
    heroImage: '/images/corsair-real/classroom-training-group-01.jpg',
    registrationUrl: '/events/texas-ltc-certification-class-jun2026',
    contactCta: 'Register Now',
  },
  {
    id: 'ltc-class-jul-25-2026',
    paymentMode: 'contact',
    slug: 'texas-ltc-certification-class-jul2026',
    title: 'Texas LTC Certification Class',
    date: '2026-07-25',
    dateDisplay: 'July 25, 2026',
    time: '8:30 AM – 3:30 PM CT',
    location: 'Addison, TX (Classroom) · Farmers Branch, TX (Range)',
    category: 'LTC Certification',
    shortDescription:
      'Complete your Texas License to Carry in one day. Classroom at Hilton Garden Inn, Addison — shooting qualification at Eagle Gun Range, Farmers Branch. Optional: ammo and handgun rental available.',
    description:
      'One-day Texas LTC certification. Classroom covers LTC laws, non-violent dispute resolution, handgun safety and use. Live-fire shooting proficiency at Eagle Gun Range. Base registration: $100. Optional add-ons during checkout: 50 rounds of handgun ammo ($30) and handgun rental ($20).',
    flyerImage: '/images/events/flyers/texas-ltc-jul2026.png',
    heroImage: '/images/events/flyers/texas-ltc-jul2026.png',
    registrationUrl: '/events/texas-ltc-certification-class-jul2026',
    contactCta: 'Register Now',
  },
  {
    id: 'level-iii-iv-security-training-jul2026',
    paymentMode: 'contact',
    slug: 'level-iii-iv-security-training-jul2026',
    title: 'Level III & IV Security Officer Training',
    date: '2026-07-06',
    dateDisplay: 'July 6–10, 2026',
    time: 'Flexible Schedule · In-Person Training',
    location: 'Addison, TX (Classroom) · Farmers Branch, TX (Range)',
    category: 'Security Training',
    shortDescription:
      'Train to become a Texas Level III Security Officer and Level IV Personal Protection Officer. State-approved security officer training featuring firearms qualification, executive protection instruction, and certification.',
    description:
      'Complete Level III Security Officer Certification and Level IV Personal Protection Officer (PPO) training in one comprehensive program. State-approved curriculum includes firearms qualification, executive protection fundamentals, risk assessment, leadership development, scenario-based training, and shooting proficiency examination. Certification upon completion.',
    flyerImage: '/images/events/flyers/level-3-4-training-jul2026.png',
    heroImage: '/images/events/flyers/level-3-4-training-jul2026.png',
    registrationUrl: '/events/level-iii-iv-security-training-jul2026',
    contactCta: 'Register Now',
  },
];

export const pastEvents: CorsairEvent[] = [
  {
    id: 'non-lethal-faith-filled-2026',
    paymentMode: 'contact',
    slug: 'non-lethal-self-defense-faith-filled-church',
    title: 'Non-Lethal Self-Defense Training for Men & Women',
    date: '2026-05-07',
    dateDisplay: 'May 7, 2026',
    time: '6:30 PM',
    location: 'Kingdom Center Lewisville · 1010 S Edmonds Ln, Suite 108, Lewisville, TX 75067',
    category: 'Community Safety',
    shortDescription:
      'Are you prepared to protect yourself? Non-lethal self-defense training for men and women hosted at Faith Filled Church in Lewisville.',
    description:
      'Church members and the community are invited to learn practical self-defense techniques that could save your life or someone you love.',
    flyerImage: '/images/events/flyers/non-lethal-faith-filled-church-v2.png',
    heroImage: '/images/events/flyers/non-lethal-faith-filled-church-v2.png',
    isPast: true,
  },
  {
    id: 'ltc-aug-30-2025',
    paymentMode: 'contact',
    slug: 'ltc-class-aug-30-2025',
    title: 'Texas LTC Certification Class',
    date: '2025-08-30',
    dateDisplay: 'August 30, 2025',
    time: '9:00 AM – 3:00 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification. Classroom covers LTC laws, non-violent dispute resolution, handgun safety and use. Live-fire shooting proficiency at Eagle Gun Range.',
    flyerImage: '/images/events/flyers/ltc-aug-30-2025.png',
    heroImage: '/images/events/flyers/ltc-aug-30-2025.png',
    isPast: true,
  },
  {
    id: 'ltc-aug-30-2025-b',
    paymentMode: 'contact',
    slug: 'ltc-class-aug-30-2025-alliance',
    title: 'Texas LTC Certification Class',
    date: '2025-08-30',
    dateDisplay: 'August 30, 2025',
    time: '9:00 AM – 3:00 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification.',
    flyerImage: '/images/events/flyers/ltc-aug-30-2025-b.png',
    heroImage: '/images/events/flyers/ltc-aug-30-2025-b.png',
    isPast: true,
  },
  {
    id: 'ltc-sep-27-2025',
    paymentMode: 'contact',
    slug: 'ltc-class-sep-27-2025',
    title: 'Texas LTC Certification Class',
    date: '2025-09-27',
    dateDisplay: 'September 27, 2025',
    time: '9:00 AM – 3:00 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification.',
    flyerImage: '/images/events/flyers/ltc-sep-27-2025.png',
    heroImage: '/images/events/flyers/ltc-sep-27-2025.png',
    isPast: true,
  },
  {
    id: 'ltc-nov-8-2025',
    paymentMode: 'contact',
    slug: 'ltc-class-nov-8-2025',
    title: 'Texas LTC Certification Class',
    date: '2025-11-08',
    dateDisplay: 'November 8, 2025',
    time: '9:00 AM – 3:00 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification.',
    flyerImage: '/images/events/flyers/ltc-nov-8-2025.png',
    heroImage: '/images/events/flyers/ltc-nov-8-2025.png',
    isPast: true,
  },
  {
    id: 'ltc-dec-8-2025',
    paymentMode: 'contact',
    slug: 'ltc-class-dec-8-2025',
    title: 'Texas LTC Certification Class',
    date: '2025-12-08',
    dateDisplay: 'December 8, 2025',
    time: '9:00 AM – 3:30 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification.',
    flyerImage: '/images/events/flyers/ltc-dec-8-2025.png',
    heroImage: '/images/events/flyers/ltc-dec-8-2025.png',
    isPast: true,
  },
  {
    id: 'ltc-dec-6-2025',
    paymentMode: 'contact',
    slug: 'ltc-class-dec-6-2025',
    title: 'Texas LTC Certification Class',
    date: '2025-12-06',
    dateDisplay: 'December 6, 2025',
    time: '9:00 AM – 3:30 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification.',
    flyerImage: '/images/events/flyers/ltc-dec-6-2025.png',
    heroImage: '/images/events/flyers/ltc-dec-6-2025.png',
    isPast: true,
  },
  {
    id: 'ltc-feb-21-2026',
    paymentMode: 'contact',
    slug: 'ltc-class-feb-21-2026',
    title: 'Texas LTC Certification Class',
    date: '2026-02-21',
    dateDisplay: 'February 21, 2026',
    time: '9:00 AM – 3:30 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification.',
    flyerImage: '/images/events/flyers/ltc-feb-21-2026.png',
    heroImage: '/images/events/flyers/ltc-feb-21-2026.png',
    isPast: true,
  },
  {
    id: 'ltc-feb-21-2026-alliance',
    paymentMode: 'contact',
    slug: 'ltc-certification-feb-21-2026-alliance',
    title: 'Texas LTC Certification Class',
    date: '2026-02-21',
    dateDisplay: 'February 21, 2026',
    time: '8:30 AM – 3:00 PM CT',
    location: 'DFW Metroplex, TX',
    category: 'LTC Certification',
    shortDescription: 'Texas License to Carry certification class — classroom instruction covering LTC laws, handgun safety, and live-fire range qualification.',
    description: 'One-day Texas LTC certification.',
    flyerImage: '/images/events/flyers/ltc-feb-21-2026-alliance.png',
    heroImage: '/images/events/flyers/ltc-feb-21-2026-alliance.png',
    isPast: true,
  },
];

export const homepageEventsPreview = getUpcomingEvents().slice(0, 3);

export const eventCategories: EventCategory[] = [
  'Firearms Training',
  'LTC Certification',
  "Women's Training",
  'Church Safety',
  'Security Training',
  'Community Safety',
  'Private Event',
];

export interface EventPhoto {
  src: string;
  alt: string;
  caption?: string;
}

export const eventPhotos: EventPhoto[] = [
  { src: '/images/corsair-real/classroom-training-group-01.jpg', alt: 'Corsair classroom training session', caption: 'Classroom — LTC Certification Class' },
  { src: '/images/corsair-real/group-range-training-01.jpg', alt: 'Group range training', caption: 'Group Range Training' },
  { src: '/images/corsair-real/group-range-safety-briefing-01.jpg', alt: 'Range safety briefing', caption: 'Range Safety Briefing' },
  { src: '/images/corsair-real/range-lineup-01.jpg', alt: 'Live-fire training', caption: 'Live-Fire Practical' },
  { src: '/images/corsair-real/range-lineup-02.jpg', alt: 'Full firing line', caption: 'Firing Line — Defensive Clinic' },
  { src: '/images/corsair-real/instructors-hero-bg-01.png', alt: 'Corsair Alliance Training Team', caption: 'Alliance Training Team' },
  { src: '/images/corsair-real/security-team-church-01.jpg', alt: 'Church safety event', caption: 'Church Safety Team Workshop' },
  { src: '/images/corsair-real/woman-range-training-01.jpg', alt: "Women's training day", caption: "Women's Training Day" },
];

export interface EventFlyer {
  id: string;
  title: string;
  eventSlug?: string;
  image: string;
  downloadUrl?: string;
}

export const eventFlyers: EventFlyer[] = [
  {
    id: 'flyer-ltc-jun-2026',
    title: 'Texas LTC Certification Class — June 13, 2026',
    eventSlug: 'texas-ltc-certification-class-jun2026',
    image: '/images/events/flyers/texas-ltc-jun2026.png',
    downloadUrl: '/images/events/flyers/texas-ltc-jun2026.png',
  },
  {
    id: 'flyer-ltc-jul-2026',
    title: 'Texas LTC Certification Class — July 25, 2026',
    eventSlug: 'texas-ltc-certification-class-jul2026',
    image: '/images/events/flyers/texas-ltc-jul2026.png',
    downloadUrl: '/images/events/flyers/texas-ltc-jul2026.png',
  },
  {
    id: 'flyer-l3l4-jul-2026',
    title: 'Level III & IV Security Officer Training — July 6–10, 2026',
    eventSlug: 'level-iii-iv-security-training-jul2026',
    image: '/images/events/flyers/level-3-4-training-jul2026.png',
    downloadUrl: '/images/events/flyers/level-3-4-training-jul2026.png',
  },
];

export function getEventBySlug(slug: string): CorsairEvent | undefined {
  return [...upcomingEvents, ...pastEvents].find((e) => e.slug === slug);
}

export function getUpcomingEvents(): CorsairEvent[] {
  const today = new Date().toISOString().split('T')[0];
  return [...upcomingEvents, ...pastEvents]
    .filter((e) => e.date >= today && !e.isPast)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getPastEvents(): CorsairEvent[] {
  const today = new Date().toISOString().split('T')[0];
  return [...upcomingEvents, ...pastEvents]
    .filter((e) => e.date < today || e.isPast === true)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getUpcomingEventFlyers(): EventFlyer[] {
  const upcoming = new Set(getUpcomingEvents().map((e) => e.slug));
  return eventFlyers.filter((f) => !f.eventSlug || upcoming.has(f.eventSlug));
}
