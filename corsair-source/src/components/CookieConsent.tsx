'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type ConsentState = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
};

const DEFAULT_CONSENT: ConsentState = {
  essential: true,
  analytics: false,
  marketing: false,
  functional: false,
};

const STORAGE_KEY = 'corsair_cookie_consent';

export default function CookieConsent() {
  const t = useTranslations('cookies');
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // First visit — show banner after short delay
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  // Allow any part of the site to re-open the preferences panel by dispatching
  // a 'corsair:open-cookie-settings' event (e.g. the footer "Cookie Settings" button).
  useEffect(() => {
    const handler = () => {
      setVisible(true);
      setShowPreferences(true);
    };
    window.addEventListener('corsair:open-cookie-settings', handler);
    return () => window.removeEventListener('corsair:open-cookie-settings', handler);
  }, []);

  const saveConsent = (state: ConsentState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
      // Notify listeners (e.g. Analytics loader) without needing a page reload.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('corsair:consent-updated', { detail: state })
        );
      }
    } catch {
      // ignore
    }
    setVisible(false);
    setShowPreferences(false);
  };

  const handleAcceptAll = () => {
    saveConsent({ essential: true, analytics: true, marketing: true, functional: true });
  };

  const handleRejectNonEssential = () => {
    saveConsent({ essential: true, analytics: false, marketing: false, functional: false });
  };

  const handleSavePreferences = () => {
    saveConsent(consent);
  };

  const toggle = (key: keyof ConsentState) => {
    if (key === 'essential') return; // always on
    setConsent((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!visible) return null;

  const cookieCategories = [
    {
      key: 'essential' as keyof ConsentState,
      label: t('essential'),
      description: t('essentialDescription'),
      locked: true,
    },
    {
      key: 'analytics' as keyof ConsentState,
      label: t('analytics'),
      description: t('analyticsDescription'),
      locked: false,
    },
    {
      key: 'marketing' as keyof ConsentState,
      label: t('marketing'),
      description: t('marketingDescription'),
      locked: false,
    },
    {
      key: 'functional' as keyof ConsentState,
      label: t('functional'),
      description: t('functionalDescription'),
      locked: false,
    },
  ];

  return (
    <>
      {/* Backdrop for preferences panel */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black/50 z-[998]" onClick={() => setShowPreferences(false)} />
      )}

      {/* Main banner */}
      {!showPreferences && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          className="fixed bottom-0 left-0 right-0 z-[999] bg-white border-t-4 border-corsair-red-500 shadow-2xl animate-slide-up"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Icon + text */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-corsair-blue-950 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-corsair-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-corsair-blue-950 font-bold text-sm mb-0.5">{t('title')}</p>
                  <p className="text-corsair-gray-500 text-xs leading-relaxed">
                    {t('description')}{' '}
                    <Link href="/cookie-policy" className="text-corsair-red-500 hover:underline font-medium">
                      {t('cookiePolicy')}
                    </Link>
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full lg:w-auto">
                <button
                  onClick={() => setShowPreferences(true)}
                  className="text-xs font-medium text-corsair-gray-500 hover:text-corsair-blue-950 border border-corsair-gray-200 hover:border-corsair-gray-400 px-4 py-2 rounded-lg transition-colors"
                >
                  {t('managePreferences')}
                </button>
                <button
                  onClick={handleRejectNonEssential}
                  className="text-xs font-medium text-corsair-gray-600 hover:text-corsair-blue-950 border border-corsair-gray-300 hover:border-corsair-blue-900 px-4 py-2 rounded-lg transition-colors"
                >
                  {t('rejectNonEssential')}
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="text-xs font-bold text-white bg-corsair-red-500 hover:bg-corsair-red-600 px-5 py-2 rounded-lg transition-colors"
                >
                  {t('acceptAll')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences panel */}
      {showPreferences && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('preferencesTitle')}
          className="fixed bottom-0 left-0 right-0 z-[999] bg-white border-t-4 border-corsair-red-500 shadow-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
        >
          <div className="max-w-2xl mx-auto px-5 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-corsair-blue-950 font-black text-lg">{t('preferencesTitle')}</h2>
                <p className="text-corsair-gray-500 text-xs mt-0.5">{t('preferencesDescription')}</p>
              </div>
              <button
                onClick={() => setShowPreferences(false)}
                className="w-8 h-8 rounded-lg bg-corsair-gray-100 hover:bg-corsair-gray-200 flex items-center justify-center text-corsair-gray-500 transition-colors"
                aria-label="Close preferences"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cookie categories */}
            <div className="space-y-3 mb-6">
              {cookieCategories.map(({ key, label, description, locked }) => (
                <div
                  key={key}
                  className="flex items-start gap-4 p-4 rounded-xl border border-corsair-gray-100 bg-corsair-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-corsair-blue-950 font-semibold text-sm">{label}</p>
                    <p className="text-corsair-gray-500 text-xs mt-0.5 leading-relaxed">{description}</p>
                  </div>
                  {/* Toggle */}
                  <button
                    role="switch"
                    aria-checked={consent[key]}
                    aria-label={`Toggle ${label}`}
                    disabled={locked}
                    onClick={() => toggle(key)}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:ring-offset-1 ${
                      consent[key]
                        ? 'bg-corsair-red-500'
                        : 'bg-corsair-gray-300'
                    } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        consent[key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleRejectNonEssential}
                className="flex-1 text-sm font-medium text-corsair-gray-600 border border-corsair-gray-300 hover:border-corsair-blue-900 hover:text-corsair-blue-950 py-2.5 rounded-xl transition-colors"
              >
                {t('rejectNonEssential')}
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 text-sm font-bold text-white bg-corsair-blue-950 hover:bg-corsair-blue-900 py-2.5 rounded-xl transition-colors"
              >
                {t('savePreferences')}
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 text-sm font-bold text-white bg-corsair-red-500 hover:bg-corsair-red-600 py-2.5 rounded-xl transition-colors"
              >
                {t('acceptAll')}
              </button>
            </div>

            <p className="text-corsair-gray-400 text-xs text-center mt-3">
              See our{' '}
              <Link href="/cookie-policy" className="text-corsair-red-500 hover:underline" onClick={() => setVisible(false)}>
                {t('cookiePolicy')}
              </Link>{' '}
              for more information.
            </p>
          </div>
        </div>
      )}
    </>
  );
}