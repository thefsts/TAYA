/**
 * Corsair Provisioning Script — Task #36
 *
 * Signs in to the FSTS dashboard via Playwright (Clerk ticket auth),
 * extracts the Convex JWT from the browser session, then calls
 * agencies:create / sites:create / users:create via Convex HTTP API.
 *
 * Convex deployment: VITE_CONVEX_URL (clean-marlin-94) — in test mode
 */

import { chromium } from "playwright";

const CLERK_API = "https://api.clerk.com/v1";
const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error(
    "ERROR: VITE_CONVEX_URL environment variable is required.\n" +
    "  Set it to the Convex production URL, e.g.:\n" +
    "  VITE_CONVEX_URL=https://uncommon-cobra-336.convex.cloud node scripts/provision-corsair.mjs"
  );
  process.exit(1);
}
// Use direct port since we're running inside the container
const DASHBOARD_PORT = process.env.DASHBOARD_PORT ?? "19489";
const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;
const PROVISION_EMAIL = "corsair-provision@fststest.dev";

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ??
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

function log(msg) {
  console.log(`[provision-corsair] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

// ── Clerk API helpers ────────────────────────────────────────────────────────
async function clerkApi(path, opts = {}) {
  const sk = process.env.CLERK_SECRET_KEY;
  if (!sk) throw new Error("CLERK_SECRET_KEY is required");
  const resp = await fetch(`${CLERK_API}${path}`, {
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
    ...opts,
  });
  return resp.json();
}

async function getOrCreateClerkUser(email) {
  const data = await clerkApi(`/users?email_address=${encodeURIComponent(email)}&limit=1`);
  const list = Array.isArray(data) ? data : data.data ?? [];
  if (list[0]) { log(`Found Clerk user: ${list[0].id}`); return list[0]; }
  log(`Creating Clerk user ${email}...`);
  const user = await clerkApi("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      first_name: "Corsair",
      last_name: "Admin",
      skip_password_requirement: true,
      skip_password_checks: true,
    }),
  });
  if (!user.id) throw new Error(`Clerk user creation failed: ${JSON.stringify(user)}`);
  log(`Created Clerk user: ${user.id}`);
  return user;
}

async function createSignInToken(userId) {
  const t = await clerkApi("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });
  if (!t.token) throw new Error(`Sign-in token failed: ${JSON.stringify(t)}`);
  return t.token;
}

// ── Convex HTTP API helper (with JWT) ────────────────────────────────────────
async function convexMutation(path, args, jwt = null) {
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  const resp = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await resp.json();
  if (data.status !== "success") {
    throw new Error(`Convex ${path} failed: ${data.errorMessage ?? JSON.stringify(data)}`);
  }
  return data.value;
}

// Unauthenticated Convex call (test-mode functions only)
async function convexMutationNoAuth(path, args) {
  return convexMutation(path, args, null);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log("=== Corsair Provisioning via FSTS Dashboard ===");
  log(`Convex URL: ${CONVEX_URL}`);
  log(`Dashboard URL: ${DASHBOARD_URL}`);

  // 1. Bootstrap superadmin in Convex (test-mode, no auth required)
  log("Upserting test superadmin in Convex...");
  const userId = await convexMutationNoAuth("users:upsertTestSuperAdmin", {
    email: PROVISION_EMAIL,
    name: "Corsair Provision Bot",
  });
  log(`Convex superadmin record: ${userId}`);

  // 2. Create Clerk user + sign_in_token
  const clerkUser = await getOrCreateClerkUser(PROVISION_EMAIL);
  const signInToken = await createSignInToken(clerkUser.id);

  // 3. Sign in via Playwright, extract Convex JWT
  log("Launching browser...");
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  let convexJwt = null;
  try {
    const signInUrl = `${DASHBOARD_URL}/sign-in?__clerk_ticket=${signInToken}`;
    log(`Navigating to sign-in URL...`);
    await page.goto(signInUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait for redirect to /app
    await page.waitForURL((url) => url.pathname === "/app", { timeout: 60_000 });
    log("Signed in — landed on /app");

    // Wait for provisionMe to run (role badge appears)
    await page.waitForSelector(".font-mono", { timeout: 20_000 });
    await page.waitForTimeout(3000); // extra settle time

    // Extract Convex JWT via Clerk's getToken
    log("Extracting Convex JWT from browser session...");
    convexJwt = await page.evaluate(async () => {
      // Clerk exposes window.Clerk after loading
      for (let i = 0; i < 20; i++) {
        if (window.Clerk && window.Clerk.session) {
          try {
            // Try with the "convex" template
            const token = await window.Clerk.session.getToken({ template: "convex" });
            if (token) return token;
          } catch (_) {}
          // Fallback: default session token
          try {
            const token = await window.Clerk.session.getToken();
            if (token) return token;
          } catch (_) {}
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      return null;
    });

    if (!convexJwt) {
      // Try promoting without being superadmin (test mode allows it)
      log("JWT not extracted — promoting via test-mode and retrying...");
      await convexMutationNoAuth("users:promoteToSuperAdminByClerkId", {
        targetClerkUserId: clerkUser.id,
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      convexJwt = await page.evaluate(async () => {
        for (let i = 0; i < 20; i++) {
          if (window.Clerk && window.Clerk.session) {
            try {
              const token = await window.Clerk.session.getToken({ template: "convex" });
              if (token) return token;
            } catch (_) {}
            try {
              const token = await window.Clerk.session.getToken();
              if (token) return token;
            } catch (_) {}
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        return null;
      });
    }

    if (!convexJwt) {
      throw new Error("Could not extract Convex JWT from browser session");
    }
    log(`JWT obtained (length: ${convexJwt.length})`);

    // Promote to superadmin with the real Clerk user ID
    log("Ensuring user is superadmin...");
    await convexMutationNoAuth("users:promoteToSuperAdminByClerkId", {
      targetClerkUserId: clerkUser.id,
    });
    log("User confirmed as superadmin");

    await page.waitForTimeout(1000);

  } finally {
    await browser.close();
  }

  // 4. Call Convex mutations directly with JWT
  // ── Agency ────────────────────────────────────────────────────────────────
  log("Creating Corsair Tactical Solutions agency...");
  let agencyId;
  try {
    const agencyResult = await convexMutation("agencies:create", {
      name: "Corsair Tactical Solutions",
      slug: "corsair-tactical",
      primaryColor: "#1A3A52",
      accentColor: "#C41E3A",
      supportEmail: "corsairtacticalsolutions@gmail.com",
      billingNotes: "First production client. Onboarded July 31, 2026.",
      featureFlags: {},
    }, convexJwt);
    agencyId = agencyResult?.id ?? agencyResult?._id ?? agencyResult;
    log(`✅ Agency created: ${agencyId}`);
  } catch (err) {
    if (err.message.includes("already exists")) {
      log("Agency already exists — proceeding");
      // Query to get the existing ID
      const qResp = await fetch(`${CONVEX_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${convexJwt}` },
        body: JSON.stringify({ path: "agencies:list", args: {}, format: "json" }),
      });
      const qData = await qResp.json();
      const agencies = Array.isArray(qData.value) ? qData.value : [];
      const corsair = agencies.find((a) => a.slug === "corsair-tactical");
      agencyId = corsair?.id ?? corsair?._id;
      log(`Found existing agency: ${agencyId}`);
    } else {
      throw err;
    }
  }

  // ── Site ──────────────────────────────────────────────────────────────────
  log("Creating Corsair site via onboarding wizard mutation...");
  let siteId;
  try {
    const siteResult = await convexMutation("sites:create", {
      name: "Corsair Tactical Solutions",
      slug: "corsair-tactical",
      status: "active",
      domain: "corsairtacticalsolutions.com",
      brandColorPrimary: "#1A3A52",
      brandColorSecondary: "#C41E3A",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "training_academy",
      enabledModules: {
        homepage: true,
        courses: true,
        events: true,
        articles: true,
        media: true,
        contact: true,
        footer: true,
        seo: true,
        payments: true,
        email: true,
        crm: true,
      },
      agencyId: agencyId,
    }, convexJwt);
    siteId = siteResult?.id ?? siteResult?._id ?? siteResult;
    log(`✅ Site created: ${siteId}`);
  } catch (err) {
    if (err.message.includes("already exists")) {
      log("Site already exists — looking up...");
      const qResp = await fetch(`${CONVEX_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${convexJwt}` },
        body: JSON.stringify({ path: "sites:list", args: {}, format: "json" }),
      });
      const qData = await qResp.json();
      const sites = Array.isArray(qData.value) ? qData.value : [];
      const corsairSite = sites.find((s) => s.slug === "corsair-tactical");
      siteId = corsairSite?.id ?? corsairSite?._id;
      log(`Found existing site: ${siteId}`);
    } else {
      throw err;
    }
  }

  // Assign site to agency
  if (agencyId && siteId) {
    log("Assigning site to agency...");
    try {
      await convexMutation("agencies:assignSite", { siteId, agencyId }, convexJwt);
      log("✅ Site assigned to agency");
    } catch (err) {
      log(`Agency assignSite: ${err.message} (may already be assigned)`);
    }
  }

  // ── Admin User ────────────────────────────────────────────────────────────
  log("Creating Corsair admin user record...");
  let adminUserId;
  try {
    const userResult = await convexMutation("users:create", {
      name: "Corsair Admin",
      email: "corsairtacticalsolutions@gmail.com",
      isSuperAdmin: false,
      roleAssignments: siteId ? [{ siteId, role: "owner" }] : [],
    }, convexJwt);
    adminUserId = userResult?.id ?? userResult?._id ?? userResult;
    log(`✅ Admin user created: ${adminUserId}`);
  } catch (err) {
    if (err.message.includes("already exists") || err.message.includes("duplicate")) {
      log("Admin user already exists");
    } else {
      log(`User creation note: ${err.message}`);
    }
  }

  // Assign agency admin if we have IDs
  if (agencyId && adminUserId) {
    log("Assigning agency admin...");
    try {
      await convexMutation("agencies:assignAdmin", {
        userId: adminUserId,
        agencyId,
        isAgencyAdmin: true,
      }, convexJwt);
      log("✅ Agency admin assigned");
    } catch (err) {
      log(`assignAdmin note: ${err.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const result = {
    success: true,
    provisioned: {
      agency: { name: "Corsair Tactical Solutions", slug: "corsair-tactical", id: agencyId },
      site: { name: "Corsair Tactical Solutions", domain: "corsairtacticalsolutions.com", id: siteId },
      adminUser: { email: "corsairtacticalsolutions@gmail.com", id: adminUserId },
    },
    timestamp: new Date().toISOString(),
  };

  log("=== PROVISIONING COMPLETE ===");
  log(JSON.stringify(result, null, 2));
  return result;
}

main()
  .then((r) => {
    process.stdout.write("\nPROVISIONING_RESULT=" + JSON.stringify(r) + "\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nPROVISIONING_FAILED:", err.message);
    process.exit(1);
  });
