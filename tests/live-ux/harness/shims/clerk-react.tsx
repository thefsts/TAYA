/**
 * @clerk/react shim for the live-UX parent bundle.
 *
 * Production wraps the app in ClerkProvider and the dashboard pages use
 * useClerk/useAuth/useUser from @clerk/react. The harness has no Clerk
 * credentials \u2014 the acting-user control endpoint (/harness/acting-user) IS
 * the login layer. This shim satisfies the SAME hook signatures those
 * components call so the REAL page components (SiteDashboard,
 * WebsiteSettings, VisualEditor/AppLayout) run unmodified in the driver.
 *
 *   useClerk()  -> { signOut: async () => location.assign("/") }
 *   useAuth()   -> { sessionId: "harness-session", isSignedIn: true, userId: actingUser }
 *   useUser()   -> { isLoaded: true, isSignedIn: true, user: { id, fullName, imageUrl: null } }
 *   ClerkProvider / SignedIn / SignedOut / Show \u2014 pass-through providers.
 */
import React from "react";

export function useClerk() {
  return {
    signOut: async (_opts?: unknown) => {
      window.location.assign("/");
    },
    openSignIn: () => {},
    openUserProfile: () => {},
  };
}

export function useAuth() {
  return {
    sessionId: "harness-session",
    isSignedIn: true,
    userId: null,
    getToken: async () => "harness-token",
  };
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "acting",
      fullName: "Acting User",
      imageUrl: null,
    },
  };
}

export const ClerkProvider = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const SignedIn = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const SignedOut = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export function Show(_props: { when?: unknown; children?: React.ReactNode }) {
  return _props.when ? React.createElement(React.Fragment, null, _props.children) : null;
}
