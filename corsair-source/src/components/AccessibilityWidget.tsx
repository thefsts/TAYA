'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type A11ySettings = {
  fontSize: number; // multiplier: 1 = normal, 1.2 = large, 1.4 = xlarge
  highContrast: boolean;
  grayscale: boolean;
  pauseAnimations: boolean;
};

const DEFAULT_SETTINGS: A11ySettings = {
  fontSize: 1,
  highContrast: false,
  grayscale: false,
  pauseAnimations: false,
};

const STORAGE_KEY = 'corsair_a11y';

export default function AccessibilityWidget() {
  const t = useTranslations('accessibility');
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_SETTINGS);

  // Load saved settings
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as A11ySettings;
        setSettings(parsed);
        applySettings(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const applySettings = (s: A11ySettings) => {
    const root = document.documentElement;
    // Font size via CSS variable
    root.style.setProperty('--a11y-font-scale', String(s.fontSize));
    // High contrast
    if (s.highContrast) {
      root.classList.add('a11y-high-contrast');
    } else {
      root.classList.remove('a11y-high-contrast');
    }
    // Grayscale
    if (s.grayscale) {
      root.classList.add('a11y-grayscale');
    } else {
      root.classList.remove('a11y-grayscale');
    }
    // Pause animations
    if (s.pauseAnimations) {
      root.classList.add('a11y-pause-animations');
    } else {
      root.classList.remove('a11y-pause-animations');
    }
  };

  const update = (next: Partial<A11ySettings>) => {
    const updated = { ...settings, ...next };
    setSettings(updated);
    applySettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const resetAll = () => {
    update(DEFAULT_SETTINGS);
  };

  const fontSizeLabel = () => {
    if (settings.fontSize <= 1) return '100%';
    if (settings.fontSize <= 1.15) return '115%';
    if (settings.fontSize <= 1.3) return '130%';
    return '150%';
  };

  const toggleItems = [
    {
      key: 'highContrast' as keyof A11ySettings,
      label: t('highContrast'),
      description: t('highContrastDescription'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      key: 'grayscale' as keyof A11ySettings,
      label: t('grayscale'),
      description: t('grayscaleDescription'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'pauseAnimations' as keyof A11ySettings,
      label: t('pauseAnimations'),
      description: t('pauseAnimationsDescription'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('widget')}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-[990] w-13 h-13 w-[52px] h-[52px] bg-corsair-blue-950 hover:bg-corsair-red-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:ring-offset-2 group"
        title={t('widget')}
      >
        {/* Universal accessibility icon */}
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 4.5l-5-.5v7l1.2 7.2a1 1 0 0 1-1.96.4L13 15h-2l-1.24 5.6a1 1 0 0 1-1.96-.4L9 13.5V6.5l-5 .5a1 1 0 0 1-.2-1.98l6-.6a1 1 0 0 1 .2 0h4a1 1 0 0 1 .2 0l6 .6A1 1 0 0 1 20 6.5z" />
        </svg>
        {/* Label badge */}
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-corsair-blue-950 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {t('widget')}
        </span>
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[989]" onClick={() => setOpen(false)} aria-hidden="true" />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('widget')}
            className="fixed bottom-24 right-4 sm:right-6 z-[991] w-[320px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-corsair-gray-100 overflow-hidden"
          >
            {/* Panel header */}
            <div className="bg-corsair-blue-950 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 text-corsair-red-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 4.5l-5-.5v7l1.2 7.2a1 1 0 0 1-1.96.4L13 15h-2l-1.24 5.6a1 1 0 0 1-1.96-.4L9 13.5V6.5l-5 .5a1 1 0 0 1-.2-1.98l6-.6a1 1 0 0 1 .2 0h4a1 1 0 0 1 .2 0l6 .6A1 1 0 0 1 20 6.5z" />
                </svg>
                <span className="text-white font-bold text-sm">{t('widget')}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Settings */}
            <div className="px-4 py-4 space-y-3">

              {/* Text Size */}
              <div className="bg-corsair-gray-50 rounded-xl p-3">
                <p className="text-corsair-blue-950 font-semibold text-xs uppercase tracking-wide mb-2">
                  {t('textSize')} — <span className="text-corsair-red-500">{fontSizeLabel()}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => update({ fontSize: Math.max(1, settings.fontSize - 0.15) })}
                    disabled={settings.fontSize <= 1}
                    className="flex-1 py-1.5 rounded-lg bg-corsair-blue-950 text-white text-sm font-bold hover:bg-corsair-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease text size"
                  >
                    A−
                  </button>
                  <button
                    onClick={() => update({ fontSize: 1 })}
                    className="flex-shrink-0 px-2 py-1.5 rounded-lg bg-corsair-gray-200 text-corsair-gray-600 text-xs hover:bg-corsair-gray-300 transition-colors"
                    aria-label={t('reset')}
                  >
                    {t('reset')}
                  </button>
                  <button
                    onClick={() => update({ fontSize: Math.min(1.5, settings.fontSize + 0.15) })}
                    disabled={settings.fontSize >= 1.5}
                    className="flex-1 py-1.5 rounded-lg bg-corsair-blue-950 text-white text-sm font-bold hover:bg-corsair-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase text size"
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* Toggles */}
              {toggleItems.map(({ key, label, description, icon }) => (
                <button
                  key={key}
                  onClick={() => update({ [key]: !settings[key] })}
                  role="switch"
                  aria-checked={!!settings[key]}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    settings[key]
                      ? 'border-corsair-red-500 bg-red-50'
                      : 'border-corsair-gray-100 bg-corsair-gray-50 hover:border-corsair-gray-300'
                  }`}
                >
                  <span className={`flex-shrink-0 ${settings[key] ? 'text-corsair-red-500' : 'text-corsair-gray-400'}`}>
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-corsair-blue-950 font-semibold text-xs">{label}</p>
                    <p className="text-corsair-gray-400 text-[10px] leading-relaxed">{description}</p>
                  </div>
                  <span className={`flex-shrink-0 w-8 h-4.5 h-[18px] rounded-full transition-colors relative ${settings[key] ? 'bg-corsair-red-500' : 'bg-corsair-gray-300'}`}>
                    <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${settings[key] ? 'left-[calc(100%-14px-2px)]' : 'left-0.5'}`} />
                  </span>
                </button>
              ))}

              {/* Keyboard nav info */}
              <div className="bg-corsair-blue-950/5 rounded-xl p-3">
                <p className="text-corsair-blue-950 font-semibold text-xs mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                  {t('keyboardNav')}
                </p>
                <p className="text-corsair-gray-500 text-[10px] leading-relaxed">
                  Use <kbd className="bg-corsair-gray-200 rounded px-1 text-[9px] font-mono">Tab</kbd> to navigate,{' '}
                  <kbd className="bg-corsair-gray-200 rounded px-1 text-[9px] font-mono">Enter</kbd> to activate,{' '}
                  <kbd className="bg-corsair-gray-200 rounded px-1 text-[9px] font-mono">Esc</kbd> to close menus.
                </p>
              </div>

              {/* Screen reader notice */}
              <div className="bg-corsair-blue-950/5 rounded-xl p-3">
                <p className="text-corsair-blue-950 font-semibold text-xs mb-1">{t('screenReader')}</p>
                <p className="text-corsair-gray-500 text-[10px] leading-relaxed">
                  This site uses semantic HTML and ARIA labels for screen reader compatibility. We support NVDA, JAWS, VoiceOver, and TalkBack.
                </p>
              </div>

              {/* Captions notice */}
              <div className="bg-corsair-blue-950/5 rounded-xl p-3">
                <p className="text-corsair-blue-950 font-semibold text-xs mb-1">{t('captions')}</p>
                <p className="text-corsair-gray-500 text-[10px] leading-relaxed">
                  Captions and transcripts are provided or available upon request for all video training content.
                </p>
              </div>

              {/* Deaf / HoH support */}
              <div className="bg-corsair-blue-950 rounded-xl p-3">
                <div className="flex items-start gap-2 mb-2">
                  <svg className="w-4 h-4 text-corsair-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M9 10a3 3 0 000 4" />
                  </svg>
                  <p className="text-white font-semibold text-xs">{t('deafSupportTitle')}</p>
                </div>
                <p className="text-corsair-gray-400 text-[10px] leading-relaxed mb-2.5">
                  {t('deafSupportMessage')}
                </p>
                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="block w-full text-center bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                >
                  {t('contactSupport')}
                </Link>
              </div>

              {/* Reset all */}
              <button
                onClick={resetAll}
                className="w-full text-xs text-corsair-gray-400 hover:text-corsair-gray-600 py-1.5 transition-colors"
              >
                {t('resetAll')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}