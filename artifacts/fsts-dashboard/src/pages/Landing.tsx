import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * TAYA marketing is deployed separately; the system root is an auth gate.
 * Route immediately instead of waiting on Clerk initialization so a frontend
 * API problem cannot trap users forever on the opening spinner.
 */
export default function Landing() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/sign-in", { replace: true });
  }, [setLocation]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-600">Opening TAYA…</p>
      </div>
    </div>
  );
}
