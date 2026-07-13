/**
 * Convex HTTP API helpers for E2E test data setup.
 */

const CONVEX_URL =
  process.env.VITE_CONVEX_URL ?? "https://clean-marlin-94.convex.cloud";

function getConvexDeployKey(): string {
  const key = process.env.CONVEX_DEPLOY_KEY;
  if (!key) throw new Error("CONVEX_DEPLOY_KEY env var is required for E2E tests");
  return key;
}

async function convexMutation(path: string, args: Record<string, unknown>): Promise<unknown> {
  const resp = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${getConvexDeployKey()}`,
    },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await resp.json() as { status: string; value?: unknown; errorMessage?: string };
  if (data.status !== "success") {
    throw new Error(`Convex mutation ${path} failed: ${data.errorMessage ?? JSON.stringify(data)}`);
  }
  return data.value;
}

/**
 * Promotes a Convex user to super-admin using their Clerk user ID.
 * The user must already exist in the Convex DB (i.e. provisionMe has run).
 * This relies on the `by_clerk_user_id` index — reliable regardless of
 * whether the email claim is present in the Convex JWT.
 */
export async function promoteToSuperAdmin(clerkUserId: string): Promise<void> {
  await convexMutation("users:promoteToSuperAdminByClerkId", {
    targetClerkUserId: clerkUserId,
  });
}
