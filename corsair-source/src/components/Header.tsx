'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useTranslations } from 'next-intl';

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

const chevronDown = (rotated: boolean) => (
  <svg
    className={`w-3.5 h-3.5 transition-transform duration-200 ${rotated ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Delay before closing dropdown after mouse leaves (ms)
const CLOSE_DELAY = 200;

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isTrainingOpen, setIsTrainingOpen] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [mobileTrainingOpen, setMobileTrainingOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [mobileContactOpen, setMobileContactOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations();

  // Refs for close timers
  const aboutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const servicesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trainingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delayed close helpers — cancel on re-enter
  const scheduleClose = useCallback((
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    timerRef.current = setTimeout(() => {
      setter(false);
      timerRef.current = null;
    }, CLOSE_DELAY);
  }, []);

  const cancelClose = useCallback((
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Nav: Corsair · About▾ · Security Services▾ · Training▾ · Events · Articles · Contact · Careers
  const corsairLink = { href: '/', label: t('nav.corsair') };
  const eventsLink = { href: '/events', label: t('nav.events') };

  const aboutLinks = [
    { href: '/about', label: 'About Corsair' },
    { href: '/instructors', label: t('nav.meetTheTeam') },
    { href: '/security-services', label: t('nav.fourDModel') },
    { href: '/faq', label: t('nav.faq') },
  ];

  const serviceLinks = [
    { href: '/security-services', label: t('nav.securityServicesOverview') },
    { href: '/church-safety', label: t('nav.churchSafety') },
    { href: '/property-manager-services', label: t('nav.propertyManagerServices') },
    { href: '/event-security', label: t('nav.eventSecurity') },
    { href: '/private-investigations', label: t('nav.privateInvestigations') },
    { href: '/security-training', label: t('nav.securityTraining') },
  ];

  const trainingCategories = [
    {
      heading: t('nav.securityOfficerTraining'),
      items: [
        { href: '/courses/level-2-security-officer', label: t('nav.level2Security') },
        { href: '/courses/level-3-armed-security-officer', label: t('nav.level3Security') },
        { href: '/courses/level-4-bodyguard', label: t('nav.level4Security') },
        { href: '/security-training', label: t('nav.continuingEducation') },
      ],
    },
    {
      heading: t('nav.firearmsTraining'),
      items: [
        { href: '/courses/texas-ltc-certification-basic-handgun', label: t('nav.texasLtc') },
        { href: '/courses/basic-handgun-skills-training', label: t('nav.basicHandgun') },
        { href: '/courses/defensive-shooting-skills', label: t('nav.defensiveShooting') },
        { href: '/courses/concealed-carry-home-defense', label: t('nav.concealedCarry') },
        { href: '/courses/ar-15-rifle-course', label: t('nav.ar15Course') },
        { href: '/courses/shotgun-course', label: t('nav.shotgunCourse') },
      ],
    },
    {
      heading: t('nav.additionalTraining'),
      items: [
        { href: '/courses/stop-the-bleed-training', label: t('nav.stopTheBleed') },
        { href: '/courses/first-aid-training', label: t('nav.firstAid') },
        { href: '/courses/non-lethal-defense-training', label: t('nav.privateInstruction') },
      ],
    },
  ];

  const isActive = (href: string) => {
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
    const normalizedPath = pathWithoutLocale || '/';
    if (href === '/') return normalizedPath === '/';
    return normalizedPath === href || normalizedPath.startsWith(href + '/');
  };

  const isAboutActive = ['/about', '/instructors', '/faq'].some((h) => isActive(h));
  const isServicesActive = serviceLinks.some((l) => isActive(l.href));
  const isTrainingActive = isActive('/courses') || isActive('/security-training');
  const isContactActive = ['/contact', '/careers'].some((h) => isActive(h));

  const closeMobileMenu = () => {
    setIsMenuOpen(false);
    setMobileAboutOpen(false);
    setMobileServicesOpen(false);
    setMobileTrainingOpen(false);
    setMobileContactOpen(false);
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-[rgba(7,20,38,0.08)] sticky top-0 z-50 shadow-[0_8px_24px_rgba(7,20,38,0.08)]">
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between h-20 lg:h-24 gap-6">

          {/* ── Logo (transparent, image-only, no text) — large, top-left ── */}
          <Link href="/" className="flex items-center shrink-0 group" aria-label="Corsair Tactical Solutions — Home">
            <div className="relative w-[92px] h-[92px] lg:w-[150px] lg:h-[150px] flex-shrink-0 lg:-mb-6">
              <Image
                src="/images/corsair-real/logo-transparent.png"
                alt="Corsair Tactical Solutions"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 92px, 150px"
                priority
              />
            </div>
          </Link>

          {/* ── Desktop Nav — order: Corsair, About▾, Courses, Services▾, Events, Contact▾ ── */}
          <nav className="hidden lg:flex items-center gap-4 flex-1 justify-center" aria-label="Main navigation">
            {/* Corsair (Home) */}
            <Link
              key={corsairLink.href}
              href={corsairLink.href}
              className={`text-[0.95rem] font-extrabold transition-colors relative pb-1 group whitespace-nowrap tracking-tight ${
                isActive(corsairLink.href) ? 'text-corsair-red-500' : 'text-[#111827] hover:text-corsair-blue-900'
              }`}
            >
              {corsairLink.label}
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-corsair-red-500 transition-all duration-300 ${
                  isActive(corsairLink.href) ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </Link>

            {/* About Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => {
                cancelClose(aboutTimer);
                setIsAboutOpen(true);
              }}
              onMouseLeave={() => {
                scheduleClose(aboutTimer, setIsAboutOpen);
              }}
            >
              <button
                className={`text-[0.95rem] font-extrabold transition-colors relative pb-1 flex items-center gap-1 whitespace-nowrap pt-1 tracking-tight ${
                  isAboutActive ? 'text-corsair-red-500' : 'text-[#111827] hover:text-corsair-blue-900'
                }`}
                aria-haspopup="menu"
                aria-expanded={isAboutOpen}
              >
                {t('nav.about')}
                {chevronDown(isAboutOpen)}
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-corsair-red-500 transition-all duration-300 ${
                    isAboutActive ? 'w-full' : 'w-0'
                  }`}
                />
              </button>

              {isAboutOpen && (
                <div
                  role="menu"
                  className="absolute top-full -mt-1 pt-1 left-0 w-48 z-50"
                >
                  {/* Invisible hover bridge to prevent gap */}
                  <div className="bg-white border border-corsair-gray-200 rounded-xl shadow-xl py-2">
                    {aboutLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        className={`block px-4 py-2.5 text-sm font-semibold transition-colors ${
                          isActive(link.href)
                            ? 'text-corsair-red-500 bg-corsair-red-50'
                            : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Services Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => {
                cancelClose(servicesTimer);
                setIsServicesOpen(true);
              }}
              onMouseLeave={() => {
                scheduleClose(servicesTimer, setIsServicesOpen);
              }}
            >
              <button
                className={`text-[0.95rem] font-extrabold transition-colors relative pb-1 flex items-center gap-1 whitespace-nowrap pt-1 tracking-tight ${
                  isServicesActive ? 'text-corsair-red-500' : 'text-[#111827] hover:text-corsair-blue-900'
                }`}
                aria-haspopup="menu"
                aria-expanded={isServicesOpen}
              >
                {t('nav.services')}
                {chevronDown(isServicesOpen)}
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-corsair-red-500 transition-all duration-300 ${
                    isServicesActive ? 'w-full' : 'w-0'
                  }`}
                />
              </button>

              {isServicesOpen && (
                <div
                  role="menu"
                  className="absolute top-full -mt-1 pt-1 left-0 w-60 z-50"
                >
                  <div className="bg-white border border-corsair-gray-200 rounded-xl shadow-xl py-2">
                    {serviceLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        className={`block px-4 py-2.5 text-sm font-semibold transition-colors ${
                          isActive(link.href)
                            ? 'text-corsair-red-500 bg-corsair-red-50'
                            : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <div className="border-t border-corsair-gray-100 mt-1 pt-1">
                      <Link href="/contact" role="menuitem"
                        className="block px-4 py-2.5 text-sm font-bold text-corsair-red-500 hover:text-white hover:bg-corsair-red-500 transition-colors"
                      >
                        {t('nav.requestConsultation')}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Training Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => { cancelClose(trainingTimer); setIsTrainingOpen(true); }}
              onMouseLeave={() => { scheduleClose(trainingTimer, setIsTrainingOpen); }}
            >
              <button
                className={`text-[0.95rem] font-extrabold transition-colors relative pb-1 flex items-center gap-1 whitespace-nowrap pt-1 tracking-tight ${
                  isTrainingActive ? 'text-corsair-red-500' : 'text-[#111827] hover:text-corsair-blue-900'
                }`}
                aria-haspopup="menu"
                aria-expanded={isTrainingOpen}
              >
                {t('nav.training')}
                {chevronDown(isTrainingOpen)}
                <span className={`absolute bottom-0 left-0 h-0.5 bg-corsair-red-500 transition-all duration-300 ${isTrainingActive ? 'w-full' : 'w-0'}`} />
              </button>

              {isTrainingOpen && (
                <div role="menu" className="absolute top-full -mt-1 pt-1 left-0 w-[500px] z-50">
                  <div className="bg-white border border-corsair-gray-200 rounded-xl shadow-xl p-4">
                    <div className="grid grid-cols-2 gap-x-5">
                      <div>
                        {trainingCategories.slice(0, 1).map((cat) => (
                          <div key={cat.heading} className="mb-3">
                            <p className="text-[10px] font-black text-corsair-red-500 uppercase tracking-widest mb-1.5 px-1">{cat.heading}</p>
                            {cat.items.map((item) => (
                              <Link key={item.href} href={item.href} role="menuitem"
                                className={`block px-2 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                                  isActive(item.href) ? 'text-corsair-red-500 bg-corsair-red-50' : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                                }`}
                              >{item.label}</Link>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div>
                        {trainingCategories.slice(1).map((cat) => (
                          <div key={cat.heading} className="mb-3">
                            <p className="text-[10px] font-black text-corsair-red-500 uppercase tracking-widest mb-1.5 px-1">{cat.heading}</p>
                            {cat.items.map((item) => (
                              <Link key={item.href} href={item.href} role="menuitem"
                                className={`block px-2 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                                  isActive(item.href) ? 'text-corsair-red-500 bg-corsair-red-50' : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                                }`}
                              >{item.label}</Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-corsair-gray-100 pt-2 mt-1">
                      <Link href="/courses" role="menuitem"
                        className="flex items-center justify-between px-2 py-2 text-sm font-bold text-corsair-red-500 hover:text-corsair-red-600 hover:bg-corsair-red-50 rounded-lg transition-colors"
                      >
                        {t('nav.viewAllCourses')}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Events (direct link) */}
            <Link
              key={eventsLink.href}
              href={eventsLink.href}
              className={`text-[0.95rem] font-extrabold transition-colors relative pb-1 group whitespace-nowrap tracking-tight ${
                isActive(eventsLink.href) ? 'text-corsair-red-500' : 'text-[#111827] hover:text-corsair-blue-900'
              }`}
            >
              {eventsLink.label}
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-corsair-red-500 transition-all duration-300 ${
                  isActive(eventsLink.href) ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </Link>

            {/* Training & Knowledge Center (direct link) */}
            <Link
              href="/blog"
              className={`text-[0.95rem] font-extrabold transition-colors relative pb-1 group whitespace-nowrap tracking-tight ${
                isActive('/blog') ? 'text-corsair-red-500' : 'text-[#111827] hover:text-corsair-blue-900'
              }`}
            >
              {t('nav.blog')}
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-corsair-red-500 transition-all duration-300 ${
                  isActive('/blog') ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </Link>

            {/* Contact Dropdown (Contact Us + Careers) */}
            <div
              className="relative"
              onMouseEnter={() => { cancelClose(contactTimer); setIsContactOpen(true); }}
              onMouseLeave={() => { scheduleClose(contactTimer, setIsContactOpen); }}
            >
              <button
                className={`text-[0.95rem] font-extrabold transition-colors relative pb-1 flex items-center gap-1 whitespace-nowrap pt-1 tracking-tight ${
                  isContactActive ? 'text-corsair-red-500' : 'text-[#111827] hover:text-corsair-blue-900'
                }`}
                aria-haspopup="menu"
                aria-expanded={isContactOpen}
              >
                {t('nav.contact')}
                {chevronDown(isContactOpen)}
                <span className={`absolute bottom-0 left-0 h-0.5 bg-corsair-red-500 transition-all duration-300 ${isContactActive ? 'w-full' : 'w-0'}`} />
              </button>

              {isContactOpen && (
                <div role="menu" className="absolute top-full -mt-1 pt-1 left-0 w-44 z-50">
                  <div className="bg-white border border-corsair-gray-200 rounded-xl shadow-xl py-2">
                    <Link href="/contact" role="menuitem"
                      className={`block px-4 py-2.5 text-sm font-semibold transition-colors ${
                        isActive('/contact') ? 'text-corsair-red-500 bg-corsair-red-50' : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                      }`}
                    >
                      {t('nav.contactUs')}
                    </Link>
                    <Link href="/careers" role="menuitem"
                      className={`block px-4 py-2.5 text-sm font-semibold transition-colors ${
                        isActive('/careers') ? 'text-corsair-red-500 bg-corsair-red-50' : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                      }`}
                    >
                      {t('nav.careers')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* ── Right: Social + Language + Phone + CTA ── */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {/* Social icons */}
            <div className="flex items-center gap-1.5 border-r border-corsair-gray-200 pr-3">
              {socialLinks.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-8 h-8 rounded-lg bg-corsair-gray-50 hover:bg-corsair-blue-900 flex items-center justify-center text-corsair-gray-500 hover:text-white transition-all duration-200"
                >
                  {social.icon}
                </a>
              ))}
            </div>

            {/* Language selector */}
            <div className="border-r border-corsair-gray-200 pr-3">
              <LanguageSelector variant="header" />
            </div>

            <a
              href="tel:+12143356652"
              className="flex items-center gap-2 text-corsair-blue-900 hover:text-corsair-red-500 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-corsair-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-corsair-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div className="leading-tight">
                <p className="text-[10px] text-corsair-gray-500 font-medium uppercase tracking-wider">Call Us</p>
                <p className="text-sm font-bold text-corsair-blue-900">214-335-6652</p>
              </div>
            </a>
            <Link
              href="/contact"
              className="btn-red-approved whitespace-nowrap"
            >
              Schedule Consultation
            </Link>
          </div>

          {/* ── Mobile: Phone icon + hamburger ── */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href="tel:+12143356652"
              className="p-2 rounded-lg text-corsair-blue-900 hover:bg-corsair-blue-50 transition-colors"
              aria-label="Call us"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
            <button
              className="p-2 rounded-lg text-corsair-gray-700 hover:bg-corsair-gray-100 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* ── Mobile Menu ── */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-corsair-gray-100 bg-white">
            <nav className="flex flex-col space-y-1 mb-4" aria-label="Mobile navigation">
              {/* Corsair (Home) */}
              <Link
                key={corsairLink.href}
                href={corsairLink.href}
                className={`font-semibold px-4 py-3 rounded-lg transition-colors text-sm ${
                  isActive(corsairLink.href)
                    ? 'text-corsair-red-500 bg-corsair-red-50'
                    : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                }`}
                onClick={closeMobileMenu}
              >
                {corsairLink.label}
              </Link>

              {/* Mobile About (collapsible) */}
              <div>
                <button
                  onClick={() => setMobileAboutOpen((v) => !v)}
                  className={`w-full flex items-center justify-between font-semibold px-4 py-3 rounded-lg transition-colors text-sm ${
                    isAboutActive
                      ? 'text-corsair-red-500 bg-corsair-red-50'
                      : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                  }`}
                  aria-expanded={mobileAboutOpen}
                >
                  <span>{t('nav.about')}</span>
                  {chevronDown(mobileAboutOpen)}
                </button>
                {mobileAboutOpen && (
                  <div className="pl-4 py-1 space-y-0.5">
                    {aboutLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block font-medium px-4 py-2.5 rounded-lg transition-colors text-sm ${
                          isActive(link.href)
                            ? 'text-corsair-red-500 bg-corsair-red-50'
                            : 'text-corsair-gray-600 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                        }`}
                        onClick={closeMobileMenu}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Services (collapsible) */}
              <div>
                <button
                  onClick={() => setMobileServicesOpen((v) => !v)}
                  className={`w-full flex items-center justify-between font-semibold px-4 py-3 rounded-lg transition-colors text-sm ${
                    isServicesActive
                      ? 'text-corsair-red-500 bg-corsair-red-50'
                      : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                  }`}
                  aria-expanded={mobileServicesOpen}
                >
                  <span>{t('nav.services')}</span>
                  {chevronDown(mobileServicesOpen)}
                </button>
                {mobileServicesOpen && (
                  <div className="pl-4 py-1 space-y-0.5">
                    {serviceLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block font-medium px-4 py-2.5 rounded-lg transition-colors text-sm ${
                          isActive(link.href)
                            ? 'text-corsair-red-500 bg-corsair-red-50'
                            : 'text-corsair-gray-600 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                        }`}
                        onClick={closeMobileMenu}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link href="/contact"
                      className="block font-bold px-4 py-2.5 rounded-lg text-sm text-corsair-red-500 hover:bg-corsair-red-50 transition-colors"
                      onClick={closeMobileMenu}
                    >{t('nav.requestConsultation')}</Link>
                  </div>
                )}
              </div>

              {/* Mobile Training (collapsible with categories) */}
              <div>
                <button
                  onClick={() => setMobileTrainingOpen((v) => !v)}
                  className={`w-full flex items-center justify-between font-semibold px-4 py-3 rounded-lg transition-colors text-sm ${
                    isTrainingActive
                      ? 'text-corsair-red-500 bg-corsair-red-50'
                      : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                  }`}
                  aria-expanded={mobileTrainingOpen}
                >
                  <span>{t('nav.training')}</span>
                  {chevronDown(mobileTrainingOpen)}
                </button>
                {mobileTrainingOpen && (
                  <div className="pl-4 py-1 space-y-0.5">
                    {trainingCategories.map((cat) => (
                      <div key={cat.heading}>
                        <p className="text-[10px] font-black text-corsair-red-500 uppercase tracking-widest px-4 pt-3 pb-1">{cat.heading}</p>
                        {cat.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`block font-medium px-4 py-2 rounded-lg transition-colors text-sm ${
                              isActive(item.href) ? 'text-corsair-red-500 bg-corsair-red-50' : 'text-corsair-gray-600 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                            }`}
                            onClick={closeMobileMenu}
                          >{item.label}</Link>
                        ))}
                      </div>
                    ))}
                    <Link href="/courses"
                      className="block font-bold px-4 py-2.5 rounded-lg text-sm text-corsair-red-500 hover:bg-corsair-red-50 mt-1 transition-colors"
                      onClick={closeMobileMenu}
                    >{t('nav.viewAllCourses')} →</Link>
                  </div>
                )}
              </div>

              {/* Mobile Events (direct link) */}
              <Link
                key={eventsLink.href}
                href={eventsLink.href}
                className={`font-semibold px-4 py-3 rounded-lg transition-colors text-sm ${
                  isActive(eventsLink.href)
                    ? 'text-corsair-red-500 bg-corsair-red-50'
                    : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                }`}
                onClick={closeMobileMenu}
              >
                {eventsLink.label}
              </Link>

              {/* Mobile Training & Knowledge Center */}
              <Link
                href="/blog"
                className={`font-semibold px-4 py-3 rounded-lg transition-colors text-sm ${
                  isActive('/blog')
                    ? 'text-corsair-red-500 bg-corsair-red-50'
                    : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                }`}
                onClick={closeMobileMenu}
              >
                {t('nav.blog')}
              </Link>

              {/* Mobile Contact (collapsible — Contact Us + Careers) */}
              <div>
                <button
                  onClick={() => setMobileContactOpen((v) => !v)}
                  className={`w-full flex items-center justify-between font-semibold px-4 py-3 rounded-lg transition-colors text-sm ${
                    isContactActive
                      ? 'text-corsair-red-500 bg-corsair-red-50'
                      : 'text-corsair-gray-700 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                  }`}
                  aria-expanded={mobileContactOpen}
                >
                  <span>{t('nav.contact')}</span>
                  {chevronDown(mobileContactOpen)}
                </button>
                {mobileContactOpen && (
                  <div className="pl-4 py-1 space-y-0.5">
                    <Link
                      href="/contact"
                      className={`block font-medium px-4 py-2.5 rounded-lg transition-colors text-sm ${
                        isActive('/contact') ? 'text-corsair-red-500 bg-corsair-red-50' : 'text-corsair-gray-600 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                      }`}
                      onClick={closeMobileMenu}
                    >
                      {t('nav.contactUs')}
                    </Link>
                    <Link
                      href="/careers"
                      className={`block font-medium px-4 py-2.5 rounded-lg transition-colors text-sm ${
                        isActive('/careers') ? 'text-corsair-red-500 bg-corsair-red-50' : 'text-corsair-gray-600 hover:text-corsair-blue-900 hover:bg-corsair-gray-50'
                      }`}
                      onClick={closeMobileMenu}
                    >
                      {t('nav.careers')}
                    </Link>
                  </div>
                )}
              </div>
            </nav>

            <div className="flex flex-col gap-2 pt-3 border-t border-corsair-gray-100">
              <Link
                href="/contact"
                className="btn-red-glow bg-corsair-red-500 text-white px-5 py-3 rounded-lg text-sm font-bold text-center"
                onClick={closeMobileMenu}
              >
                Schedule Consultation
              </Link>
              <Link
                href="/courses"
                className="border-2 border-corsair-blue-900 text-corsair-blue-900 px-5 py-2.5 rounded-lg text-sm font-bold text-center hover:bg-corsair-blue-900 hover:text-white transition-colors"
                onClick={closeMobileMenu}
              >
                {t('nav.viewAllCourses')}
              </Link>
              <a
                href="tel:+12143356652"
                className="text-center text-sm font-semibold text-corsair-gray-600 py-2"
              >
                📞 214-335-6652
              </a>

              {/* Social icons in mobile menu */}
              <div className="flex items-center justify-center gap-3 pt-2 border-t border-corsair-gray-100 mt-1">
                <span className="text-xs text-corsair-gray-400 font-medium">Follow Us:</span>
                {socialLinks.map((social) => (
                  <a
                    key={social.href}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-9 h-9 rounded-lg bg-corsair-blue-900 hover:bg-corsair-red-500 flex items-center justify-center text-white transition-all duration-200"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>

              {/* Language selector in mobile menu */}
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-corsair-gray-100 mt-1">
                <span className="text-xs text-corsair-gray-400 font-medium">Language:</span>
                <LanguageSelector variant="mobile" />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}