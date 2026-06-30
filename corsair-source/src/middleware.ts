import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Always include locale in URL
  localePrefix: 'as-needed',

  // Disable auto-detection so the URL (not a cookie or Accept-Language header)
  // is always the source of truth. Without this, picking Arabic sets a
  // NEXT_LOCALE cookie that bounces the user back even after selecting English.
  localeDetection: false,
});

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  //
  // This ensures unprefixed paths like `/courses`, `/about`, `/contact`
  // are intercepted by next-intl and redirected to `/{locale}/...`,
  // instead of falling through to Next.js routing and returning 404.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
