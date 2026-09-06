import { useEffect } from "react";
import { useUser } from "@clerk/react";

/**
 * TAYA marketing is deployed separately; the system root is an auth gate.
 *
 * Signed-out visitors are sent to the single branded TAYA sign-in page.
 * Signed-in visitors are sent straight to /app. This distinction is critical:
 * the previous root component always redirected to /sign-in while HomeRedirect
 * simultaneously sent authenticated users to /app, creating a redirect race
 * that could leave users stuck in a sign-in/loading loop after successful auth.
 *
 * Tenant selection is still resolved after authentication from server-side
 * TAYA roles; this route never chooses or grants a site.
 */
export default function Landing() {
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      window.location.replace("/app");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const site = params.get("site");
    const signInUrl = site
      ? `/sign-in?site=${encodeURIComponent(site)}`
      : "/sign-in";
    window.location.replace(signInUrl);
  }, [isLoaded, isSignedIn]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-600">
          {isLoaded && isSignedIn ? "Opening your TAYA workspace…" : "Opening secure TAYA sign-in…"}
        </p>
      </div>
    </div>
  );
}
