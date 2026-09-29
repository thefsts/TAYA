/**
 * clerkDeployConfig.ts
 *
 * Pure, dependency-free logic that decides whether the configured Clerk
 * publishable key can authenticate in the current deployment. It is extracted
 * from App.tsx so the preview/production key rules can be exercised directly
 * in tests (see src/test/clerk-preview-auth-config.test.ts) rather than being
 * asserted as loose strings.
 *
 * Rules:
 *  - A Vercel Preview deployment ("preview") may use a development key
 *    (pk_test_…). Clerk production keys are domain-locked to the production
 *    root domain and cannot authenticate from Vercel's own *.vercel.app
 *    preview domains.
 *  - Real production builds must use a live key (pk_live_…).
 *  - A live key on a *.vercel.app origin is a guaranteed dead-end (the sign-in
 *    form renders but never advances past the email step), so it is surfaced
 *    explicitly instead of being left to fail silently.
 *  - A proxy-encoded key — one whose decoded frontend-API host is a local path
 *    such as "/clerk" instead of a real domain — is rejected: the retired
 *    Clerk proxy flow is unsupported.
 */

export type ClerkKeyStatus =
  | { kind: "ok" }
  | { kind: "missing" }
  | { kind: "proxy-encoded"; host: string }
  | { kind: "live-key-on-vercel-preview"; hostname: string }
  | { kind: "test-key-in-production" };

export interface ClerkKeyContext {
  /** Raw value of VITE_CLERK_PUBLISHABLE_KEY (may be empty). */
  publishableKey: string;
  /** Vercel deployment target baked into the bundle ("" | "preview" | "production" | "development"). */
  deployEnv: string;
  /** import.meta.env.PROD — true for any `vite build` (including Vercel Preview). */
  isProdBuild: boolean;
  /** window.location.hostname (empty during SSR/tests without a window). */
  hostname: string;
}

export function isVercelPreviewDeploy(deployEnv: string): boolean {
  return deployEnv === "preview";
}

export function isProductionDeploy(
  deployEnv: string,
  isProdBuild: boolean,
): boolean {
  return isProdBuild && !isVercelPreviewDeploy(deployEnv);
}

export function isVercelProvidedDomain(hostname: string): boolean {
  return hostname.endsWith(".vercel.app");
}

/**
 * Decode the frontend-API host embedded in a Clerk publishable key. Clerk keys
 * are `pk_(test|live)_<base64>` where the base64 payload is `<host>$`.
 * Returns null for keys that are not Clerk publishable keys or cannot be
 * decoded.
 */
export function decodeClerkFrontendApiHost(key: string): string | null {
  if (!key.startsWith("pk_test_") && !key.startsWith("pk_live_")) return null;
  try {
    const b64 = key.replace(/^pk_(test|live)_/, "");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = atob(padded);
    return decoded.endsWith("$") ? decoded.slice(0, -1) : decoded;
  } catch {
    return null;
  }
}

export function evaluateClerkKey(ctx: ClerkKeyContext): ClerkKeyStatus {
  const { publishableKey, deployEnv, isProdBuild, hostname } = ctx;

  if (!publishableKey) return { kind: "missing" };

  const host = decodeClerkFrontendApiHost(publishableKey);
  if (host !== null && (host.startsWith("/") || !host.includes("."))) {
    return { kind: "proxy-encoded", host };
  }

  if (isVercelProvidedDomain(hostname) && publishableKey.startsWith("pk_live_")) {
    return { kind: "live-key-on-vercel-preview", hostname };
  }

  if (
    isProductionDeploy(deployEnv, isProdBuild) &&
    publishableKey.startsWith("pk_test_")
  ) {
    return { kind: "test-key-in-production" };
  }

  return { kind: "ok" };
}
