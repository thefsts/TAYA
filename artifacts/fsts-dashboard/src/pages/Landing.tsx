import { useEffect } from "react";

/**
 * TAYA marketing is deployed separately; the system root is an auth gate.
 *
 * All normal owner/admin sign-ins stay inside the TAYA application so every
 * client sees the same branded Clerk experience. Tenant separation still
 * happens after authentication from the authenticated user's server-side
 * TAYA roles; this redirect does not choose or grant a site.
 */
export default function Landing() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const site = params.get("site");
    const signInUrl = site
      ? `/sign-in?site=${encodeURIComponent(site)}`
      : "/sign-in";
    window.location.replace(signInUrl);
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-600">Opening secure TAYA sign-in…</p>
      </div>
    </div>
  );
}
