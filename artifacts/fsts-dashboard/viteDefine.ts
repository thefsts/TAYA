/**
 * viteDefine.ts
 *
 * Builds the `define` map for the dashboard Vite config. It lives next to
 * vite.config.ts (outside src/) so the exact values Vite bakes into the client
 * bundle can be exercised in tests without importing the full Vite config
 * (which pulls in esbuild) and without putting the retired proxy variable back
 * into the active dashboard source that scripts/check-taya-system-audit.sh
 * scans.
 *
 * Two entries matter for Clerk auth:
 *   - VITE_CLERK_PROXY_URL is forced to `undefined` so a stale value left in
 *     Vercel can never re-enable the retired Clerk proxy flow.
 *   - VITE_TAYA_DEPLOY_ENV carries Vercel's deployment target (VERCEL_ENV) into
 *     the bundle so the runtime can tell a Preview deployment apart from
 *     Production (see src/lib/clerkDeployConfig.ts).
 */

export interface ViteDefineEnv {
  /** Vercel's build-time deployment target ("production" | "preview" | "development" | undefined). */
  VERCEL_ENV?: string;
}

export function buildViteDefine(env: ViteDefineEnv): Record<string, string> {
  return {
    "import.meta.env.VITE_CLERK_PROXY_URL": "undefined",
    "import.meta.env.VITE_TAYA_DEPLOY_ENV": JSON.stringify(env.VERCEL_ENV ?? ""),
  };
}
