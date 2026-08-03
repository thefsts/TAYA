/**
 * Corsair Owner Provisioning — Task #126
 *
 * Creates a pending user record for corsairtacticalsolutions@gmail.com with
 * the "owner" role on the Corsair Tactical Solutions site.
 *
 * Security invariant: isSuperAdmin is explicitly false — this email receives
 * site-scoped access ONLY. The provisioning flow must never elevate a client
 * user to platform-wide superadmin.
 *
 * Usage:
 *   VITE_CONVEX_URL=https://uncommon-cobra-336.convex.cloud \
 *   CLERK_SECRET_KEY=sk_live_... \
 *   node scripts/provision-corsair-owner.mjs
 */

import { chromium } from "playwright";

const CORSAIR_SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc";
const OWNER_EMAIL    = "corsairtacticalsolutions@gmail.com";
const OWNER_NAME     = "Corsair Tactical Solutions";
const OWNER_ROLE     = "owner";

const SUPERADMIN_EMAIL = "amorebey@gmail.com";

const CLERK_API  = "https://api.clerk.com/v1";
const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("ERROR: VITE_CONVEX_URL is required.");
  process.exit(1);
}
if (!process.env.CLERK_SECRET_KEY) {
  console.error("ERROR: CLERK_SECRET_KEY is required.");
  process.exit(1);
}

const DASHBOARD_PORT = process.env.DASHBOARD_PORT ?? "19489";
const DASHBOARD_URL  = `http://localhost:${DASHBOARD_PORT}`;

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ??
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

function log(msg) {
  console.log(`[provision-owner] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

// ── Clerk API ────────────────────────────────────────────────────────────────

async function clerkApi(path, opts = {}) {
  const sk = process.env.CLERK_SECRET_KEY;
  const resp = await fetch(`${CLERK_API}${path}`, {
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
    ...opts,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Clerk ${path} → ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function lookupClerkUser(email) {
  const data = await clerkApi(`/users?email_address=${encodeURIComponent(email)}&limit=1`);
  const list = Array.isArray(data) ? data : (data.data ?? []);
  return list[0] ?? null;
}

async function createSignInToken(userId) {
  const t = await clerkApi("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });
  if (!t.token) throw new Error(`sign_in_token failed: ${JSON.stringify(t)}`);
  return t.token;
}

// ── Convex HTTP ──────────────────────────────────────────────────────────────

async function convexQuery(path, args, jwt) {
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  const resp = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await resp.json();
  if (data.status !== "success") {
    throw new Error(`Convex query ${path} failed: ${data.errorMessage ?? JSON.stringify(data)}`);
  }
  return data.value;
}

async function convexMutation(path, args, jwt) {
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  const resp = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await resp.json();
  if (data.status !== "success") {
    throw new Error(`Convex mutation ${path} failed: ${data.errorMessage ?? JSON.stringify(data)}`);
  }
  return data.value;
}

// ── Playwright: sign in as superadmin and extract JWT ────────────────────────

async function getSuperadminJwt() {
  log(`Looking up superadmin Clerk account: ${SUPERADMIN_EMAIL}`);
  const superAdmin = await lookupClerkUser(SUPERADMIN_EMAIL);
  if (!superAdmin) {
    throw new Error(
      `Superadmin Clerk account not found for ${SUPERADMIN_EMAIL}. ` +
      "Ensure the account exists in Clerk before running this script."
    );
  }
  log(`Found superadmin Clerk user: ${superAdmin.id}`);

  const signInToken = await createSignInToken(superAdmin.id);
  log("Created sign-in token for superadmin");

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const context = await browser.newContext();
  const page    = await context.newPage();

  let jwt = null;
  try {
    const signInUrl = `${DASHBOARD_URL}/sign-in?__clerk_ticket=${signInToken}`;
    log("Navigating to sign-in URL…");
    await page.goto(signInUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForURL((url) => url.pathname.startsWith("/app"), { timeout: 60_000 });
    log("Signed in — landed on /app");

    // Allow Clerk to finish loading and provisionMe to run
    await page.waitForTimeout(4000);

    log("Extracting Convex JWT…");
    jwt = await page.evaluate(async () => {
      for (let i = 0; i < 30; i++) {
        if (window.Clerk?.session) {
          try {
            const t = await window.Clerk.session.getToken({ template: "convex" });
            if (t) return t;
          } catch (_) {}
          try {
            const t = await window.Clerk.session.getToken();
            if (t) return t;
          } catch (_) {}
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      return null;
    });
  } finally {
    await browser.close();
  }

  if (!jwt) throw new Error("Could not extract Convex JWT from browser session");
  log(`JWT obtained (${jwt.length} chars)`);
  return jwt;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("=== Corsair Owner Provisioning ===");
  log(`Convex URL : ${CONVEX_URL}`);
  log(`Owner email: ${OWNER_EMAIL}`);
  log(`Site ID    : ${CORSAIR_SITE_ID}`);
  log(`Role       : ${OWNER_ROLE}`);
  log(`isSuperAdmin → false  (site-scoped access only — platform superadmin is NOT granted)`);

  const jwt = await getSuperadminJwt();

  // ── Check if the owner user already exists ───────────────────────────────
  log("Checking existing users…");
  const allUsers = await convexQuery("users:list", {}, jwt);
  const existing = (allUsers ?? []).find(
    (u) => u.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
  );

  let userId;

  if (existing) {
    log(`User already exists: ${existing._id} (${existing.name})`);

    // Ensure they have the owner role on the Corsair site
    const alreadyHasRole = (existing.roleAssignments ?? []).some(
      (r) => r.siteId === CORSAIR_SITE_ID
    );

    if (alreadyHasRole) {
      log(`✅ User already has a role on siteId ${CORSAIR_SITE_ID} — no changes needed.`);
      userId = existing._id;
    } else {
      log(`Adding ${OWNER_ROLE} role on Corsair site…`);
      // Collect existing roles + new one
      const existingRoles = (existing.roleAssignments ?? []).map((r) => ({
        siteId: r.siteId,
        role:   r.role,
      }));
      await convexMutation("users:update", {
        userId: existing._id,
        // SECURITY: never promote a client user to superadmin
        isSuperAdmin: false,
        roleAssignments: [
          ...existingRoles,
          { siteId: CORSAIR_SITE_ID, role: OWNER_ROLE },
        ],
      }, jwt);
      log(`✅ Role assigned: ${OWNER_ROLE} on ${CORSAIR_SITE_ID}`);
      userId = existing._id;
    }
  } else {
    log("User not found — creating pending record…");
    // SECURITY: isSuperAdmin is explicitly false.
    // A client site-admin must never hold platform-wide superadmin access.
    const result = await convexMutation("users:create", {
      name:  OWNER_NAME,
      email: OWNER_EMAIL,
      isSuperAdmin: false,
      roleAssignments: [{ siteId: CORSAIR_SITE_ID, role: OWNER_ROLE }],
    }, jwt);
    userId = result?._id ?? result?.id ?? result;
    log(`✅ User created: ${userId}`);
  }

  log("=== PROVISIONING COMPLETE ===");
  const result = {
    success: true,
    userId,
    email:  OWNER_EMAIL,
    siteId: CORSAIR_SITE_ID,
    role:   OWNER_ROLE,
    isSuperAdmin: false,
    timestamp: new Date().toISOString(),
  };
  log(JSON.stringify(result, null, 2));
  return result;
}

main()
  .then((r) => {
    process.stdout.write("\nOWNER_PROVISIONING_RESULT=" + JSON.stringify(r) + "\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nPROVISIONING_FAILED:", err.message);
    process.exit(1);
  });
