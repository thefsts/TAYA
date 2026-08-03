/**
 * adminConfig.ts — Production configuration-status handler.
 *
 * Exports:
 *  - isSuperAdminByClerkId  — internalQuery used by the HTTP handler to verify
 *                             the caller is an active superadmin.
 *  - configStatusHandler    — plain async function (ctx, request) => Response.
 *                             Registered as an httpAction in convex/http.ts and
 *                             also directly imported by unit tests.
 *
 * Security contract:
 *  - Returns 401 when the request carries no valid Clerk JWT.
 *  - Returns 403 when the authenticated user is not an active superadmin.
 *  - Never logs or returns secret values — only "configured" | "missing".
 */
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ── Internal: superadmin lookup ─────────────────────────────────────────── */

export const isSuperAdminByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
    return user?.isSuperAdmin === true && user?.isActive === true;
  },
});

/* ── HTTP handler (tested independently of the HTTP router) ──────────────── */

// Admin endpoint CORS — must allow `Authorization` so browser dashboard clients
// can send the Clerk Bearer token in a cross-origin preflight.
// Auth is enforced by JWT verification; the wildcard origin is safe here.
const ADMIN_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function adminOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: ADMIN_CORS });
}

function adminError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: ADMIN_CORS });
}

export async function configStatusHandler(
  ctx: {
    auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
    runQuery: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
  },
  request: Request,
): Promise<Response> {
  // ── 1. Require a valid Clerk JWT ─────────────────────────────────────────
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return adminError(401, "Unauthorized");
  }

  // ── 2. Require superadmin role ───────────────────────────────────────────
  const isAdmin = await ctx.runQuery(internal.adminConfig.isSuperAdminByClerkId, {
    clerkUserId: identity.subject,
  });
  if (!isAdmin) {
    return adminError(403, "Forbidden");
  }

  // ── 3. Read env vars — NEVER log or return values ────────────────────────
  const siteSlug = new URL(request.url).searchParams.get("siteSlug") ?? "";

  const squareWebhookKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const convexEnv = process.env.CONVEX_DEPLOYMENT_ENVIRONMENT;

  const convexEnvironment: "production" | "sandbox" | "unknown" =
    convexEnv === "production"
      ? "production"
      : convexEnv === "sandbox"
        ? "sandbox"
        : "unknown";

  return adminOk({
    squareWebhookVerification: squareWebhookKey ? "configured" : "missing",
    resendApiKey: resendApiKey ? "configured" : "missing",
    convexEnvironment,
    emailDelivery: resendApiKey ? "configured" : "missing",
    siteSlug: siteSlug || null,
    checkedAt: new Date().toISOString(),
  });
}
