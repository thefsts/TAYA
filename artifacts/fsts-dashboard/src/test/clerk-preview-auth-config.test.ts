/**
 * clerk-preview-auth-config.test.ts
 *
 * Regression coverage for the PR #63 Vercel Preview Clerk auth blocker.
 *
 * Root cause: TAYA's production Clerk key (pk_live_…) is domain-locked to the
 * production root domain, so a Vercel Preview served from *.vercel.app can
 * never authenticate — the sign-in form renders but never advances past the
 * email step. The supported preview path is a Preview-scoped development key
 * (pk_test_…). This suite exercises the *real* configuration paths that decide
 * that behaviour instead of asserting loose strings:
 *
 *   1. src/lib/clerkDeployConfig.ts  — the runtime decision used by App.tsx.
 *   2. artifacts/fsts-dashboard/vite.config.ts — the actual build config that
 *      bakes VERCEL_ENV into the bundle and neutralizes the retired proxy var.
 *   3. vercel.json                   — the actual deployment routing config.
 *   4. scripts/src/check-clerk-key.ts — the real build-time gate (spawned).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  evaluateClerkKey,
  decodeClerkFrontendApiHost,
} from "@/lib/clerkDeployConfig";
import { buildViteDefine } from "../../viteDefine";

const DASHBOARD_DIR = path.resolve(import.meta.dirname, "..", ".."); // artifacts/fsts-dashboard
const REPO_ROOT = path.resolve(DASHBOARD_DIR, "..", "..");

const TSX_BIN = path.resolve(REPO_ROOT, "scripts", "node_modules", ".bin", "tsx");
const CHECK_SCRIPT = path.resolve(
  REPO_ROOT,
  "scripts",
  "src",
  "check-clerk-key.ts",
);

/** Build a well-formed Clerk publishable key for a given frontend-API host. */
function makeClerkKey(prefix: "pk_test_" | "pk_live_", host: string): string {
  const b64 = Buffer.from(`${host}$`).toString("base64").replace(/=+$/, "");
  return `${prefix}${b64}`;
}

const PREVIEW_HOSTNAME = "taya-system-ia9dv1d8p-fullstacksolutions.vercel.app";
const PROD_HOSTNAME = "app.fstsclientsystem.com";

// ---------------------------------------------------------------------------
// 1. Runtime decision used by App.tsx
// ---------------------------------------------------------------------------
describe("clerkDeployConfig — runtime decision used by App.tsx", () => {
  it("accepts a development key on a Vercel Preview deployment", () => {
    expect(
      evaluateClerkKey({
        publishableKey: makeClerkKey("pk_test_", "clerk.preview.example"),
        deployEnv: "preview",
        isProdBuild: true,
        hostname: PREVIEW_HOSTNAME,
      }),
    ).toEqual({ kind: "ok" });
  });

  it("rejects a development key on a real production build", () => {
    expect(
      evaluateClerkKey({
        publishableKey: makeClerkKey("pk_test_", "clerk.preview.example"),
        deployEnv: "production",
        isProdBuild: true,
        hostname: PROD_HOSTNAME,
      }),
    ).toEqual({ kind: "test-key-in-production" });
  });

  it("rejects a development key on a local production build (no Vercel env)", () => {
    expect(
      evaluateClerkKey({
        publishableKey: makeClerkKey("pk_test_", "clerk.preview.example"),
        deployEnv: "",
        isProdBuild: true,
        hostname: "localhost",
      }),
    ).toEqual({ kind: "test-key-in-production" });
  });

  it("rejects a live key on a *.vercel.app origin (the reported dead-end)", () => {
    expect(
      evaluateClerkKey({
        publishableKey: makeClerkKey("pk_live_", "clerk.app.fstsclientsystem.com"),
        deployEnv: "preview",
        isProdBuild: true,
        hostname: PREVIEW_HOSTNAME,
      }),
    ).toEqual({ kind: "live-key-on-vercel-preview", hostname: PREVIEW_HOSTNAME });
  });

  it("accepts a live key on the production domain", () => {
    expect(
      evaluateClerkKey({
        publishableKey: makeClerkKey("pk_live_", "clerk.app.fstsclientsystem.com"),
        deployEnv: "production",
        isProdBuild: true,
        hostname: PROD_HOSTNAME,
      }),
    ).toEqual({ kind: "ok" });
  });

  it("accepts a live key on a custom preview subdomain of the production root", () => {
    // Vercel "Preview Deployment Suffix" keeps previews on the production root
    // domain, where a live key is still valid.
    expect(
      evaluateClerkKey({
        publishableKey: makeClerkKey("pk_live_", "clerk.app.fstsclientsystem.com"),
        deployEnv: "preview",
        isProdBuild: true,
        hostname: "pr-63.app.fstsclientsystem.com",
      }),
    ).toEqual({ kind: "ok" });
  });

  it("reports a missing key so the app fails clearly instead of dead-ending", () => {
    expect(
      evaluateClerkKey({
        publishableKey: "",
        deployEnv: "preview",
        isProdBuild: true,
        hostname: PREVIEW_HOSTNAME,
      }),
    ).toEqual({ kind: "missing" });
  });

  it("rejects a proxy-encoded key whose frontend-API host is a local path", () => {
    const proxyKey = `pk_test_${Buffer.from("/clerk$")
      .toString("base64")
      .replace(/=+$/, "")}`;
    expect(
      evaluateClerkKey({
        publishableKey: proxyKey,
        deployEnv: "preview",
        isProdBuild: true,
        hostname: PREVIEW_HOSTNAME,
      }),
    ).toEqual({ kind: "proxy-encoded", host: "/clerk" });
  });

  it("decodes the frontend-API host from a well-formed key", () => {
    expect(
      decodeClerkFrontendApiHost(
        makeClerkKey("pk_live_", "clerk.app.fstsclientsystem.com"),
      ),
    ).toBe("clerk.app.fstsclientsystem.com");
  });
});

// ---------------------------------------------------------------------------
// 2. Actual build config (vite.config.ts -> buildViteDefine)
// ---------------------------------------------------------------------------
describe("vite.config.ts — actual build configuration", () => {
  it("bakes the Vercel deployment target into the bundle", () => {
    expect(
      buildViteDefine({ VERCEL_ENV: "preview" })[
        "import.meta.env.VITE_TAYA_DEPLOY_ENV"
      ],
    ).toBe(JSON.stringify("preview"));
  });

  it("bakes an empty deploy env when VERCEL_ENV is unset", () => {
    expect(
      buildViteDefine({})["import.meta.env.VITE_TAYA_DEPLOY_ENV"],
    ).toBe('""');
  });

  it("neutralizes the retired Clerk proxy variable in the bundle", () => {
    expect(
      buildViteDefine({ VERCEL_ENV: "preview" })[
        "import.meta.env.VITE_CLERK_PROXY_URL"
      ],
    ).toBe("undefined");
  });

  it("is wired into the real vite.config.ts", () => {
    const source = readFileSync(
      path.resolve(DASHBOARD_DIR, "vite.config.ts"),
      "utf8",
    );
    expect(source).toContain("buildViteDefine(");
    expect(source).toContain("define: buildViteDefine(");
  });
});

// ---------------------------------------------------------------------------
// 3. Actual deployment routing config (vercel.json)
// ---------------------------------------------------------------------------
describe("vercel.json — actual deployment routing", () => {
  const vercelConfig = JSON.parse(
    readFileSync(path.resolve(REPO_ROOT, "vercel.json"), "utf8"),
  ) as { routes: Array<Record<string, string>> };

  it("does not route any request through the retired Clerk proxy", () => {
    const serialized = JSON.stringify(vercelConfig.routes);
    expect(serialized).not.toContain("clerk-proxy");
    expect(serialized).not.toContain("frontend-api.clerk.dev");
  });

  it("still serves the SPA via filesystem + catch-all", () => {
    expect(vercelConfig.routes).toContainEqual({ handle: "filesystem" });
    expect(vercelConfig.routes).toContainEqual({
      src: "/(.*)",
      dest: "/index.html",
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Real build-time gate (scripts/src/check-clerk-key.ts, spawned)
// ---------------------------------------------------------------------------
function runClerkKeyGate(env: Record<string, string | undefined>) {
  const merged: NodeJS.ProcessEnv = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  return spawnSync(TSX_BIN, [CHECK_SCRIPT], {
    cwd: REPO_ROOT,
    env: merged,
    encoding: "utf8",
  });
}

describe("check-clerk-key.ts — real build-time gate", () => {
  it("passes a development key on a Vercel Preview build", () => {
    const result = runClerkKeyGate({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VITE_CLERK_PUBLISHABLE_KEY: makeClerkKey("pk_test_", "clerk.preview.example"),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Preview");
  });

  it("fails a development key on a production build", () => {
    const result = runClerkKeyGate({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VITE_CLERK_PUBLISHABLE_KEY: makeClerkKey("pk_test_", "clerk.preview.example"),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("development key");
  });

  it("passes a live key on a production build", () => {
    const result = runClerkKeyGate({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VITE_CLERK_PUBLISHABLE_KEY: makeClerkKey(
        "pk_live_",
        "clerk.app.fstsclientsystem.com",
      ),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("valid production Clerk key");
  });

  it("fails when the key is missing on a production build", () => {
    const result = runClerkKeyGate({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VITE_CLERK_PUBLISHABLE_KEY: undefined,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("VITE_CLERK_PUBLISHABLE_KEY is not set");
  });
});
