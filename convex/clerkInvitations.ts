import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const CLERK_API = "https://api.clerk.com/v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function dashboardUrl(): string {
  const configured = (process.env.DASHBOARD_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return (configured || "https://fstsclientsystem.com").replace(/\/$/, "");
}

function clerkSecret(): string {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) throw new Error("CLERK_INVITATIONS_NOT_CONFIGURED");
  return secret;
}

async function clerkFetch(path: string, init?: RequestInit): Promise<Response> {
  const secret = clerkSecret();
  return await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export const invite = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const me = await ctx.runQuery(api.users.me, {});
    if (!me?.isActive || !me?.isSuperAdmin) throw new Error("Forbidden: superadmin only");

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes("@")) throw new Error("A valid email address is required");

    try {
      const lookup = await clerkFetch(`/users?email_address=${encodeURIComponent(normalizedEmail)}&limit=1`);
      if (!lookup.ok) throw new Error(`CLERK_USER_LOOKUP_FAILED_${lookup.status}`);

      const lookupData = await lookup.json() as unknown;
      const users = Array.isArray(lookupData) ? lookupData : ((lookupData as { data?: unknown[] } | null)?.data ?? []);

      if (users.length > 0) {
        await ctx.runMutation(api.invitationState.mark, { email: normalizedEmail, status: "existing_user" });
        return { status: "existing_user" as const, email: normalizedEmail, signInUrl: `${dashboardUrl()}/sign-in` };
      }

      const response = await clerkFetch("/invitations", {
        method: "POST",
        body: JSON.stringify({
          email_address: normalizedEmail,
          redirect_url: `${dashboardUrl()}/sign-up`,
          notify: true,
        }),
      });

      const body = await response.json().catch(() => ({})) as {
        id?: string;
        status?: string;
        errors?: Array<{ message?: string; long_message?: string }>;
      };

      if (!response.ok || !body.id) {
        const details = body.errors?.[0]?.long_message ?? body.errors?.[0]?.message ?? `HTTP ${response.status}`;
        throw new Error(`CLERK_INVITATION_FAILED: ${details}`);
      }

      await ctx.runMutation(api.invitationState.mark, {
        email: normalizedEmail,
        status: body.status ?? "pending",
        clerkInvitationId: body.id,
      });

      return {
        status: "invited" as const,
        email: normalizedEmail,
        invitationId: body.id,
        invitationStatus: body.status ?? "pending",
        signInUrl: `${dashboardUrl()}/sign-in`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await ctx.runMutation(api.invitationState.mark, { email: normalizedEmail, status: "failed", error: message.slice(0, 500) });
      } catch {
        // Preserve the original Clerk failure if the dashboard user has not been created yet.
      }
      throw error;
    }
  },
});
