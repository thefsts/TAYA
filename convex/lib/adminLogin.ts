/**
 * adminLogin.ts — single source of truth for the Admin Login link.
 *
 * The locked client journey is:
 *   Public Website → "Admin Login" link → app.fstsclientsystem.com/sign-in
 *   → Clerk sign-in → auto-identify assigned website → open that site's CMS.
 *
 * The dashboard origin is config-driven: the DASHBOARD_URL Convex env var
 * (with NEXT_PUBLIC_SITE_URL as a legacy fallback) overrides the default
 * application origin. The default is intentionally the APPLICATION origin —
 * never the marketing website.
 *
 * This module is shared by:
 *   - convex/clerkInvitations.ts (Clerk invitation redirect + signInUrl)
 *   - convex/footer.ts (per-site Admin Login link shown on public websites)
 *   - convex/public.ts (resolved link served to external public sites)
 * so the URL is never hardcoded in more than one place.
 */

/** The dashboard application origin (no trailing slash). */
export function dashboardBaseUrl(): string {
  const configured = (process.env.DASHBOARD_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return (configured || "https://app.fstsclientsystem.com").replace(/\/$/, "");
}

/** The Admin Login (sign-in) URL, optionally carrying the site slug for the branded login context. */
export function adminLoginUrlForSlug(slug?: string | null): string {
  const signIn = `${dashboardBaseUrl()}/sign-in`;
  if (!slug) return signIn;
  return `${signIn}?site=${encodeURIComponent(slug)}`;
}

export interface AdminLoginSource {
  adminLoginEnabled?: boolean;
  adminLoginLabel?: string;
  adminLoginUrl?: string;
}

export interface AdminLoginLink {
  enabled: boolean;
  label: string;
  url: string;
}

/**
 * Resolve the stored per-site Admin Login configuration into a stable
 * {enabled, label, url} object. Empty/absent label and URL fall back to the
 * platform defaults ("Admin Login" / config-driven sign-in URL with the
 * site slug for branded login context).
 */
export function resolveAdminLogin(
  doc: AdminLoginSource | null | undefined,
  slug?: string | null,
): AdminLoginLink {
  const enabled = doc?.adminLoginEnabled === true;
  const label = (doc?.adminLoginLabel ?? "").trim() || "Admin Login";
  const url = (doc?.adminLoginUrl ?? "").trim() || adminLoginUrlForSlug(slug ?? null);
  return { enabled, label, url };
}
