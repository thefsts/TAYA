'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, subtitle, lastUpdated, children }: LegalPageLayoutProps) {
  const t = useTranslations('legalLayout');

  return (
    <>
      {/* Hero */}
      <section className="bg-corsair-blue-950 py-14 md:py-18 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px'
          }} />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4">
            <Link href="/" className="text-corsair-gray-400 hover:text-white text-sm transition-colors">{t('home')}</Link>
            <span className="text-corsair-gray-600">/</span>
            <span className="text-corsair-red-400 text-sm font-medium">{title}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">{title}</h1>
          {subtitle && <p className="text-corsair-gray-300 text-base">{subtitle}</p>}
          <p className="text-corsair-gray-500 text-xs mt-3">{t('lastUpdated')}: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 bg-corsair-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          {/* Disclaimer banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-amber-800 text-sm leading-relaxed">
              <strong>{t('disclaimerLabel')}</strong> {t('disclaimerText')}
            </p>
          </div>

          {/* Main content card */}
          <div className="bg-white rounded-2xl shadow-sm border border-corsair-gray-200 p-8 md:p-10 prose prose-corsair max-w-none">
            {children}
          </div>

          {/* Contact card */}
          <div className="bg-corsair-blue-950 rounded-2xl p-7 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-11 h-11 bg-corsair-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-base mb-0.5">{t('contactTitle')}</p>
                <p className="text-corsair-gray-400 text-sm">{t('contactSubtitle')}</p>
                <div className="flex flex-wrap gap-4 mt-2">
                  <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-400 hover:text-corsair-red-300 text-sm transition-colors">
                    corsairtacticalsolutions@gmail.com
                  </a>
                  <a href="tel:+12143356652" className="text-corsair-red-400 hover:text-corsair-red-300 text-sm transition-colors">
                    214-335-6652
                  </a>
                </div>
              </div>
              <Link
                href="/contact"
                className="bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex-shrink-0"
              >
                {t('contactUs')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
