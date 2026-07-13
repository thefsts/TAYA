/**
 * Clerk Backend API helpers for E2E test authentication.
 *
 * Uses sign_in_tokens to authenticate test users without touching the sign-in UI.
 * The Clerk frontend SDK intercepts the `__clerk_ticket` query parameter on the
 * sign-in page and automatically completes the authentication flow.
 */

const CLERK_API = "https://api.clerk.com/v1";

function getClerkSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY env var is required for E2E tests");
  return key;
}

export interface ClerkUser {
  id: string;
  email_addresses: Array<{ email_address: string }>;
}

export async function findClerkUserByEmail(email: string): Promise<ClerkUser | null> {
  const sk = getClerkSecretKey();
  const resp = await fetch(
    `${CLERK_API}/users?email_address=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${sk}` } }
  );
  const data = await resp.json() as ClerkUser[] | { data: ClerkUser[] };
  const users = Array.isArray(data) ? data : data.data ?? [];
  return users[0] ?? null;
}

async function createClerkUser(
  email: string,
  firstName: string,
  lastName: string
): Promise<ClerkUser> {
  const sk = getClerkSecretKey();
  const resp = await fetch(`${CLERK_API}/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      first_name: firstName,
      last_name: lastName,
      skip_password_requirement: true,
      skip_password_checks: true,
    }),
  });
  const data = await resp.json() as ClerkUser & { errors?: unknown[] };
  if (!data.id) throw new Error(`Failed to create Clerk user: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Returns the app-relative sign-in path that includes a Clerk sign-in ticket.
 * Navigating to this path will sign the user in automatically — no UI interaction.
 */
export async function getClerkTicketSignInPath(
  email: string,
  firstName: string,
  lastName: string
): Promise<string> {
  const sk = getClerkSecretKey();

  let user = await findClerkUserByEmail(email);
  if (!user) {
    user = await createClerkUser(email, firstName, lastName);
  }

  const tokenResp = await fetch(`${CLERK_API}/sign_in_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 300 }),
  });
  const tokenData = await tokenResp.json() as { token: string; errors?: unknown[] };
  if (!tokenData.token) {
    throw new Error(`Failed to create sign-in token: ${JSON.stringify(tokenData)}`);
  }

  return `/sign-in?__clerk_ticket=${tokenData.token}`;
}
