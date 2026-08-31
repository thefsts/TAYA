import { useEffect } from "react";

/**
 * TAYA marketing is deployed separately; the system root is an auth gate.
 * Clerk's hosted Account Portal is the production-safe login gateway while
 * the embedded Clerk widget is being repaired. The redirect_url returns the
 * authenticated user directly to the TAYA dashboard.
 */
export default function Landing() {
  useEffect(() => {
    const appUrl = `${window.location.origin}/app`;
    const signInUrl = `https://accounts.app.fstsclientsystem.com/sign-in?redirect_url=${encodeURIComponent(appUrl)}`;
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
