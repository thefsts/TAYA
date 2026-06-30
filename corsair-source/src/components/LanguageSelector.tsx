'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

interface LanguageSelectorProps {
  variant?: 'header' | 'footer' | 'mobile';
}

export default function LanguageSelector({ variant = 'header' }: LanguageSelectorProps) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const switchLanguage = (newLocale: Locale) => {
    startTransition(() => {
      const segments = pathname.split('/').filter(Boolean);
      const hasLocalePrefix = locales.includes(segments[0] as Locale);

      if (newLocale === 'en') {
        // English is the default locale — strip any locale prefix so the URL
        // becomes /courses, /about, etc. (no /en/ round-trip through the 301).
        if (hasLocalePrefix) segments.shift();
      } else {
        // Non-English: set or replace the locale prefix.
        if (hasLocalePrefix) {
          segments[0] = newLocale;
        } else {
          segments.unshift(newLocale);
        }
      }

      const newPath = segments.length ? '/' + segments.join('/') : '/';
      router.push(newPath);
      setOpen(false);
    });
  };

  const currentName = localeNames[locale];
  const currentFlag = localeFlags[locale];

  // ─── Footer variant ─── full-width buttons
  if (variant === 'footer') {
    return (
      <div className="flex flex-col gap-2">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => switchLanguage(loc)}
            disabled={isPending}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors w-full text-left ${
              locale === loc
                ? 'text-white bg-corsair-blue-900'
                : 'text-corsair-gray-400 hover:text-white bg-corsair-blue-900/50 hover:bg-corsair-red-500'
            }`}
            aria-label={`Switch to ${localeNames[loc]}`}
            aria-pressed={locale === loc}
          >
            <span className="text-base">{localeFlags[loc]}</span>
            <span>{localeNames[loc]}</span>
            {locale === loc && (
              <span className="ml-auto text-corsair-red-400 text-xs font-bold">Active</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // ─── Mobile variant ─── horizontal pill buttons
  if (variant === 'mobile') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => switchLanguage(loc)}
            disabled={isPending}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              locale === loc
                ? 'bg-corsair-blue-950 text-white border-corsair-blue-950'
                : 'text-corsair-gray-600 border-corsair-gray-200 hover:border-corsair-blue-950 hover:text-corsair-blue-950'
            }`}
            aria-label={`Switch to ${localeNames[loc]}`}
            aria-pressed={locale === loc}
          >
            <span>{localeFlags[loc]}</span>
            <span className="font-medium">{localeNames[loc]}</span>
          </button>
        ))}
      </div>
    );
  }

  // ─── Header variant ─── compact dropdown
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Language: ${currentName}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 text-xs font-medium text-corsair-gray-600 hover:text-corsair-blue-950 border border-corsair-gray-200 hover:border-corsair-gray-400 px-2.5 py-1.5 rounded-lg transition-colors bg-white"
      >
        <span className="text-sm leading-none">{currentFlag}</span>
        <span className="hidden sm:inline">{currentName}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Language"
          className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-corsair-gray-100 overflow-hidden z-50 min-w-[140px]"
        >
          {locales.map((loc) => (
            <button
              key={loc}
              role="option"
              aria-selected={locale === loc}
              onClick={() => switchLanguage(loc)}
              disabled={isPending}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                locale === loc
                  ? 'bg-corsair-blue-950 text-white'
                  : 'text-corsair-gray-700 hover:bg-corsair-gray-50'
              }`}
            >
              <span>{localeFlags[loc]}</span>
              <span className="font-medium">{localeNames[loc]}</span>
              {locale === loc && (
                <svg
                  className="w-3.5 h-3.5 ml-auto text-corsair-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
