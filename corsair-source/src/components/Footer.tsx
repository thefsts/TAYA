'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { type CmsContact, type CmsFooter } from '@/lib/cms';


const socialLinks = [
  {
    label: 'Corsair Tactical Solutions on Instagram',
    href: 'https://www.instagram.com/corsairtacticalsolution?igsh=MTd1MmhkZzZtaWh2MQ==',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Corsair Tactical Solutions on Facebook',
    href: 'https://www.facebook.com/share/17iPFcVg7j/',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Corsair Tactical Solutions on TikTok',
    href: 'https://www.tiktok.com/@stevehopwood0?_r=1&_t=ZT-96ERuVVLCKU',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43V13.2a8.19 8.19 0 005.58 2.18v-3.45a4.85 4.85 0 01-3.59-1.39V6.69h3.59z" />
      </svg>
    ),
  },
];

export default function Footer({
  cmsContact = null,
  cmsFooter = null,
}: {
  cmsContact?: CmsContact | null;
  cmsFooter?: CmsFooter | null;
}) {
  const currentYear = new Date().getFullYear();
  const t = useTranslations();
  const tc = useTranslations('common');
  const tf = useTranslations('footer');
  const tl = useTranslations('legal');

  const legalLinks = [
    { href: '/privacy-policy', label: tl('privacyPolicy') },
    { href: '/terms-and-conditions', label: tl('termsConditions') },
    { href: '/cookie-policy', label: tl('cookiePolicy') },
    { href: '/accessibility-statement', label: tl('accessibilityStatement') },
    { href: '/refund-cancellation-policy', label: tl('refundCancellation') },
    { href: '/training-waiver', label: tl('trainingWaiver') },
    { href: '/safety-disclaimer', label: tl('safetyDisclaimer') },
    { href: '/media-release-policy', label: tl('mediaRelease') },
    { href: '/sms-email-consent-policy', label: tl('smsEmailConsent') },
  ];

  return (
    <footer className="bg-corsair-blue-950 text-white relative overflow-hidden">
      {/* Floating glow orbs in footer background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-40 h-40 bg-corsair-red-500/5 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-corsair-blue-400/5 rounded-full blur-3xl animate-float-medium" />
      </div>

      {/* Top accent bar with glow */}
      <div className="h-1 bg-corsair-red-500 relative">
        <div className="absolute inset-0 bg-corsair-red-500 blur-sm opacity-60" />
      </div>

      {/* Main footer content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-18">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">

          {/* ── Col 1: Brand + Contact + Social ── */}
          <div>
            <Link href="/" className="flex items-center gap-3 mb-5 group">
              <div className="relative w-16 h-16 flex-shrink-0">
                <Image
                  src="/corsair-logo.png"
                  alt="Corsair Tactical Solutions"
                  fill
                  className="object-contain"
                  sizes="64px"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-black text-white tracking-tight uppercase">Corsair</span>
                <span className="text-xs font-bold text-corsair-red-400 tracking-widest uppercase">Tactical Solutions</span>
                <span className="text-[10px] text-corsair-gray-400 tracking-wider uppercase">{tc('tagline')}</span>
              </div>
            </Link>

            <p className="text-corsair-gray-400 text-sm leading-relaxed mb-5">
              {tf('description')}
            </p>

            {/* Contact info */}
            <div className="space-y-2.5 mb-6">
              <a
                href={cmsContact?.phone ? `tel:${cmsContact.phone.replace(/\s/g, '')}` : 'tel:+12143356652'}
                className="flex items-center gap-2.5 text-sm text-corsair-gray-400 hover:text-white transition-colors group"
              >
                <div className="w-7 h-7 rounded bg-corsair-blue-900 flex items-center justify-center flex-shrink-0 group-hover:bg-corsair-red-500 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                {cmsContact?.phone ?? tc('phone')}
              </a>
              <a
                href={cmsContact?.email ? `mailto:${cmsContact.email}` : 'mailto:corsairtacticalsolutions@gmail.com'}
                className="flex items-center gap-2.5 text-sm text-corsair-gray-400 hover:text-white transition-colors group"
              >
                <div className="w-7 h-7 rounded bg-corsair-blue-900 flex items-center justify-center flex-shrink-0 group-hover:bg-corsair-red-500 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="truncate">{cmsContact?.email ?? tc('email')}</span>
              </a>
              <div className="flex items-center gap-2.5 text-sm text-corsair-gray-400">
                <div className="w-7 h-7 rounded bg-corsair-blue-900 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                {cmsContact?.address ?? tc('location')}
              </div>
            </div>

            {/* Social icons with glow */}
            <div className="flex items-center gap-2">
              {cmsFooter && Array.isArray(cmsFooter.socialLinks) && cmsFooter.socialLinks.length > 0
                ? cmsFooter.socialLinks.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.platform}
                      className="w-9 h-9 rounded-lg bg-corsair-blue-900 hover:bg-corsair-red-500 flex items-center justify-center text-corsair-gray-300 hover:text-white transition-all duration-200 glow-border text-xs font-bold"
                    >
                      {s.platform.charAt(0).toUpperCase()}
                    </a>
                  ))
                : socialLinks.map((social) => (
                    <a
                      key={social.href}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="w-9 h-9 rounded-lg bg-corsair-blue-900 hover:bg-corsair-red-500 flex items-center justify-center text-corsair-gray-300 hover:text-white transition-all duration-200 glow-border"
                    >
                      {social.icon}
                    </a>
                  ))
              }
            </div>
          </div>

          {/* ── Cols 2–5: CMS columns when available, static JSX as fallback ── */}
          {cmsFooter && Array.isArray(cmsFooter.columns) && cmsFooter.columns.length > 0
            ? cmsFooter.columns.map((col, i) => (
                <div key={i}>
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
                    {col.heading}
                  </h3>
                  <ul className="space-y-2.5">
                    {Array.isArray(col.links) && col.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="text-sm text-corsair-gray-400 hover:text-corsair-red-400 transition-colors flex items-center gap-2 group">
                          <svg className="w-3 h-3 text-corsair-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            : (<>
          {/* ── Col 2: Quick Links + Services (static fallback) ── */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
              <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
              {tf('quickLinks')}
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/', label: tf('home') },
                { href: '/about', label: tf('about') },
                { href: '/instructors', label: t('nav.instructors') },
                { href: '/courses', label: tf('allCourses') },
                { href: '/events', label: tf('events') },
                { href: '/faq', label: t('nav.faq') },
                { href: '/contact', label: tf('contact') },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-corsair-gray-400 hover:text-corsair-red-400 transition-colors flex items-center gap-2 group">
                    <svg className="w-3 h-3 text-corsair-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h3 className="text-sm font-bold text-white uppercase tracking-widest mt-7 mb-4 flex items-center gap-2">
              <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
              {t('nav.services')}
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/security-services', label: t('nav.securityServices') },
                { href: '/property-manager-services', label: t('nav.propertyManagerServices') },
                { href: '/church-safety', label: t('nav.churchSafety') },
                { href: '/private-investigations', label: t('nav.privateInvestigations') },
                { href: '/security-training', label: t('nav.securityTraining') },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-corsair-gray-400 hover:text-corsair-red-400 transition-colors flex items-center gap-2 group">
                    <svg className="w-3 h-3 text-corsair-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Col 3: Courses ── */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
              <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
              {tf('ourCourses')}
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/courses/texas-ltc-certification-basic-handgun', label: 'Texas LTC / Basic Handgun' },
                { href: '/courses/first-shots-basic-firearm-training', label: 'First Shots Training' },
                { href: '/courses/defensive-shooting-skills', label: 'Defensive Shooting Skills' },
                { href: '/courses/basic-handgun-skills-training', label: 'Basic Handgun Skills (1:1)' },
                { href: '/courses/level-3-armed-security-officer', label: 'Level 3 Armed Security' },
                { href: '/courses/texas-license-to-carry', label: 'Texas License to Carry Certification' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-corsair-gray-400 hover:text-corsair-red-400 transition-colors flex items-center gap-2 group">
                    <svg className="w-3 h-3 text-corsair-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Col 4: Why Corsair ── */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
              <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
              {tf('whyCorsair')}
            </h3>
            <ul className="space-y-2.5">
              {[
                '✓ NRA Certified Instructor',
                '✓ USCCA Certified',
                '✓ Texas LTC Certified',
                '✓ Navy Veteran',
                '✓ Level II–IV Security Instructor',
                '✓ Licensed & Insured',
                '✓ 12+ Years Instructing',
                '✓ 5.0 ★ Avg Rating',
              ].map((item, i) => (
                <li key={i} className="text-sm text-corsair-gray-400">{item}</li>
              ))}
            </ul>
          </div>

          {/* ── Col 4: Legal & Compliance ── */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
              <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
              {tf('legalCompliance')}
            </h3>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-corsair-gray-400 hover:text-corsair-red-400 transition-colors flex items-center gap-2 group">
                    <svg className="w-3 h-3 text-corsair-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          </>)}

          </div>

        {/* ── Texas State Licensing & Compliance ── */}
        <div className="mt-14 pt-10 border-t border-corsair-blue-900">

          {/* Centered header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-corsair-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest">
                State of Texas · Licensed &amp; Regulated
              </span>
            </div>
            <p className="text-sm font-bold text-white">Texas Licensed Security &amp; Training Provider</p>
            <a
              href="https://www.dps.texas.gov/rsd/contact/psb.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-corsair-gray-400 hover:text-corsair-red-400 transition-colors underline underline-offset-2"
            >
              Direct complaints to the TXDPS Regulatory Services Division
            </a>
          </div>

          {/* Statement */}
          <p className="text-xs text-corsair-gray-400 leading-relaxed text-center max-w-3xl mx-auto mb-8">
            Corsair Tactical Solutions is licensed by the State of Texas to provide security services, private
            investigations, security training, continuing education, and firearms instruction. We are committed
            to maintaining the highest standards of professionalism, compliance, and public safety.
          </p>

          {/* License boxes — 3 per row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              ['Instructor License',    '#161402002'],
              ['Training School',       '#F30797601'],
              ['Continuing Education',  '#Y30987101'],
              ['Business License',      '#B29791901'],
              ['Private Investigation', '#C31074401'],
            ] as [string, string][]).map(([name, num]) => (
              <div
                key={num}
                className="bg-corsair-blue-900 border border-corsair-blue-800 rounded-xl px-4 py-3 flex flex-col gap-1"
              >
                <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest leading-none">
                  {name}
                </span>
                <span className="text-sm font-black text-white font-mono tracking-wide">
                  {num}
                </span>
              </div>
            ))}
            {/* Empty placeholder to keep the grid balanced (5 items in 3-col = 2 on last row) */}
            <div className="hidden sm:block" aria-hidden="true" />
          </div>
        </div>

        {/* ── CTA band under the columns ── */}
        <div className="mt-10">
          <div className="bg-corsair-blue-900 rounded-xl p-5 border border-corsair-blue-800 flex flex-col sm:flex-row items-center justify-between gap-4 animate-glow-pulse-blue relative overflow-hidden">
            {/* Shimmer overlay */}
            <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-xl" />
            <div className="relative">
              <p className="text-white font-bold text-base">{t('cta.readyToTrain')}</p>
              <p className="text-corsair-gray-400 text-xs">{t('cta.contactToStart')}</p>
            </div>
            <Link
              href="/courses"
              className="relative inline-block text-center bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap btn-red-glow"
            >
              {t('cta.viewAllCourses')}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-corsair-blue-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
              <p className="text-xs text-corsair-gray-500 text-center sm:text-left">
                {cmsFooter?.copyrightText ?? `\u00A9 ${currentYear} Corsair Tactical Solutions, LLC. ${tc('allRightsReserved')} ${tc('location')}`}
              </p>
              <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-end">
                <Link href="/privacy-policy" className="text-xs text-corsair-gray-500 hover:text-corsair-gray-300 transition-colors">{tf('privacy')}</Link>
                <span className="text-corsair-gray-700 text-xs">&middot;</span>
                <Link href="/terms-and-conditions" className="text-xs text-corsair-gray-500 hover:text-corsair-gray-300 transition-colors">{tf('terms')}</Link>
                <span className="text-corsair-gray-700 text-xs">&middot;</span>
                <Link href="/cookie-policy" className="text-xs text-corsair-gray-500 hover:text-corsair-gray-300 transition-colors">{tf('cookies')}</Link>
                <span className="text-corsair-gray-700 text-xs">&middot;</span>
                <Link href="/accessibility-statement" className="text-xs text-corsair-gray-500 hover:text-corsair-gray-300 transition-colors">{tf('accessibility')}</Link>
                <span className="text-corsair-gray-700 text-xs">&middot;</span>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('corsair:open-cookie-settings'))}
                  className="text-xs text-corsair-gray-500 hover:text-corsair-gray-300 transition-colors"
                >
                  Cookie Settings
                </button>
                <span className="text-corsair-gray-700 text-xs">&middot;</span>
                <a
                  href="https://fstsclientsystem.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-corsair-red-400 hover:text-corsair-red-300 transition-colors inline-flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Admin Login
                </a>
                <span className="text-corsair-gray-700 text-xs">&middot;</span>
                <span className="text-xs text-corsair-gray-600">{tc('trustLine')}</span>
              </div>
            </div>

            {/* Designed by credit */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-corsair-gray-500">{tf('designedBy').replace('Full Stack Tech & Solutions', '')}</span>
              <a
                href="https://www.fstacktsolutions.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-corsair-red-400 hover:text-corsair-red-300 transition-colors hover:underline underline-offset-2"
              >
                Full Stack Tech & Solutions
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
