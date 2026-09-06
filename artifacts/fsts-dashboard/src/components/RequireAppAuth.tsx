import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";

export function PageSpinner() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

/**
 * Auth gate for every /app/* dashboard route.
 *
 * Before this gate existed, deep links such as /app/sites/<siteId> rendered
 * the full dashboard shell for signed-out visitors — sidebar, page chrome,
 * marketing copy like "Website Health Command Center™", and even the
 * auto-opening product-tour modal — with zero data behind it. The public
 * production audit classed this as a ghost dashboard: it looks like access,
 * misleads the visitor, and leaks product UI to unauthenticated traffic.
 *
 * The gate is deliberately minimal so it cannot regress any locked visual
 * scope: while auth state is loading it shows the standard page spinner;
 * once loaded, any /app/* path visited without a signed-in Clerk session
 * redirects to the platform sign-in page. Non-/app paths (/, /sign-in,
 * /sign-up, /forms/*, /portal/*) pass through untouched, and signed-in
 * users never see the gate at all.
 *
 * Rendered inside App.tsx's ClerkProvider + ConvexProviderWithClerk tree,
 * immediately around the dashboard <Switch>.
 */
export default function RequireAppAuth({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useUser();

  const isAppRoute = location.startsWith("/app");
  const shouldRedirect = isAppRoute && isLoaded && !isSignedIn;

  useEffect(() => {
    if (shouldRedirect) setLocation("/sign-in");
  }, [shouldRedirect, setLocation]);

  if (isAppRoute && !isLoaded) return <PageSpinner />;
  if (shouldRedirect) return <PageSpinner />;
  return <>{children}</>;
}
