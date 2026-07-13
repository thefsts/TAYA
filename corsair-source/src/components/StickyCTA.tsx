'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCmsCta, type CmsCta } from '@/lib/cms';

export default function StickyCTA() {
  const t = useTranslations('stickyCta');
  const tc = useTranslations('common');
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [cmsCta, setCmsCta] = useState<CmsCta | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 700);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    getCmsCta().then((data) => {
      if (data) setCmsCta(data);
    }).catch(() => {});
  }, []);

  if (!isVisible || isDismissed) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out"
      style={{ transform: isVisible ? 'translateY(0)' : 'translateY(100%)' }}
    >
      {/* Red urgency strip */}
      <div className="bg-corsair-red-500 py-1.5 px-4 text-center hidden sm:block">
        <p className="text-white text-xs font-bold tracking-wide">
          🔥 {t('urgencyMessage')}
        </p>
      </div>

      {/* Main CTA bar */}
      <div className="bg-white/98 backdrop-blur-md border-t border-corsair-gray-200 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">

            {/* Left: Branding + trust (desktop only) */}
            <div className="hidden md:flex items-center gap-4 min-w-0">
              <div className="flex-shrink-0">
                <p className="text-sm font-black text-corsair-blue-900 leading-tight">
                  {tc('companyName')}
                </p>
                <p className="text-xs text-corsair-gray-500 leading-tight">
                  {t('subtitle')}
                </p>
              </div>
              {/* Trust mini badges */}
              <div className="flex items-center gap-2 pl-4 border-l border-corsair-gray-200">
                <div className="flex items-center gap-1 text-xs text-corsair-gray-500 font-medium">
                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {t('rating')}
                </div>
                <span className="text-corsair-gray-300">·</span>
                <span className="text-xs text-corsair-gray-500 font-medium">{t('students')}</span>
                <span className="text-corsair-gray-300">·</span>
                <span className="text-xs text-corsair-gray-500 font-medium">{t('passRate')}</span>
              </div>
            </div>

            {/* Mobile: compact message */}
            <div className="flex md:hidden items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-corsair-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-corsair-blue-900 leading-tight truncate">{t('mobileTitle')}</p>
                <p className="text-xs text-corsair-gray-400 leading-tight">{t('mobileSubtitle')}</p>
              </div>
            </div>

            {/* Right: CTA Buttons */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Link
                href={cmsCta?.primaryUrl ?? '/courses'}
                className="bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {cmsCta?.primaryLabel ?? t('viewCourses')}
              </Link>
              <Link
                href={cmsCta?.secondaryUrl ?? '/contact'}
                className="hidden sm:flex border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 items-center gap-1.5 whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {cmsCta?.secondaryLabel ?? t('contactUs')}
              </Link>

              {/* Dismiss button */}
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 rounded-lg text-corsair-gray-400 hover:text-corsair-gray-600 hover:bg-corsair-gray-100 transition-colors ml-1"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}