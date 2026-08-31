import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";

/** TAYA marketing is deployed separately; the system root is an auth gate. */
export default function Landing() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    setLocation(isSignedIn ? "/app" : "/sign-in");
  }, [isLoaded, isSignedIn, setLocation]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-600">Opening TAYA…</p>
      </div>
    </div>
  );
}
