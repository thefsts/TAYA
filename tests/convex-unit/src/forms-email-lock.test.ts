/**
 * Unit tests: Form Builder email notification — website-owned delivery lock
 *
 * Covers forms.sendSubmissionNotification (convex/forms.ts):
 *  1. ARCHITECTURE LOCK: with NO per-site Resend key there is NO network
 *     send at all — the handler must never fall back to the platform
 *     RESEND_API_KEY env var for form-submission notifications.
 *  2. With the site's own resendApiKey configured, sends route through the
 *     site's own key and the site's own sender identity (fromEmail/fromName
 *     from emailSettings — never a hardcoded platform sender).
 *  3. Requires the site's emailSettings before any send (fail-closed skip).
 *
 * EMAIL ARCHITECTURE (locked): client websites own their transactional email
 * delivery. The client website sends its own notification from its own Resend
 * configuration; TAYA stores the submission in the site Inbox. TAYA-side
 * sends fire ONLY through emailSettings.resendApiKey.
 *
 * All tests use plain mock objects for `ctx` — no live Convex backend, and
 * global fetch is stubbed so a lock regression fails with zero network calls.
 */

import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

// ── Mock Convex infrastructure BEFORE importing the module under test ──────

vi.mock("../../convex/_generated/server.js", () => {
  const reg = (opts: { handler: unknown }) => ({ _handler: opts.handler });
  return {
    query: reg,
    mutation: reg,
    internalMutation: reg,
    internalAction: reg,
    internalQuery: reg,
    action: reg,
  };
});

vi.mock("../../convex/_generated/api.js", () => ({
  internal: {
    email: {
      _getEmailSettings: "email._getEmailSettings",
      send: "email.send",
    },
    forms: {
      sendSubmissionNotification: "forms.sendSubmissionNotification",
    },
    crm: {
      syncToCrm: "crm.syncToCrm",
    },
    public: {
      getSiteBySlug: "public.getSiteBySlug",
    },
  },
}));

vi.mock("../../convex/lib/requireSiteAccess.js", () => ({
  checkSiteAccess: vi.fn(async () => true),
  checkModuleEnabled: vi.fn(async () => true),
  requireModuleEnabled: vi.fn(async () => {}),
}));

vi.mock("../../convex/lib/requirePermission.js", () => ({
  requirePermission: vi.fn(async () => ({ name: "Test User" })),
}));

vi.mock("../../convex/lib/permissions.js", () => ({
  PERMISSIONS: { CONTENT_CREATE: "content.create", CONTENT_UPDATE: "content.update", CONTENT_DELETE: "content.delete" },
}));

// ── Import module under test ───────────────────────────────────────────────
import { sendSubmissionNotification } from "../../convex/forms.js";

// ── Helper: unwrap handler from the registration stub ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = <T extends { _handler: (...args: any[]) => any }>(reg: T) =>
  reg._handler;

// ── Fake IDs ───────────────────────────────────────────────────────────────
const SITE_ID = "site_test_001" as unknown as never;

const BASE_ARGS = {
  siteId: SITE_ID,
  formName: "Contact Form",
  formSlug: "contact",
  submissionId: "sub_001",
  submitterName: "Jane Doe",
  submitterEmail: "jane@example.com",
  notificationEmails: ["owner@myagency.com"],
  fieldCount: 3,
};

/**
 * Table-aware runQuery mock: routes email._getEmailSettings to the settings
 * doc (or null), mirroring the real internalQuery wiring.
 */
function makeCtx(settings: Record<string, unknown> | null) {
  const fetchMock = vi.fn();
  return {
    runQuery: vi.fn(async () => settings),
    _fetchMock: fetchMock,
  };
}

const ORIG_RESEND_KEY = process.env.RESEND_API_KEY;

beforeAll(() => {
  // Start from a clean slate — each lock test sets the platform key
  // deliberately to prove the handler never uses it.
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (ORIG_RESEND_KEY !== undefined) process.env.RESEND_API_KEY = ORIG_RESEND_KEY;
  else delete process.env.RESEND_API_KEY;
});

describe("forms.sendSubmissionNotification — ARCHITECTURE LOCK (website-owned delivery)", () => {
  it("skips with NO fetch call when the site has no per-site Resend key (no platform fallback)", async () => {
    // Platform key deliberately PRESENT — proves the handler never uses it.
    process.env.RESEND_API_KEY = "re_platform_key_should_not_be_used";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const settings = { fromName: "My Agency", fromEmail: "owner@myagency.com" };
    const ctx = makeCtx(settings); // no resendApiKey in settings

    await handler(sendSubmissionNotification)(ctx as never, { ...BASE_ARGS });

    // No per-site key → no send at all, even though the platform key exists.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips with NO fetch call when emailSettings is null (fail-closed)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ctx = makeCtx(null);
    await handler(sendSubmissionNotification)(ctx as never, { ...BASE_ARGS });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when the site has a key but no fromEmail (no sender identity → no send)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const settings = { resendApiKey: "re_site_key_abc" }; // no fromEmail
    const ctx = makeCtx(settings);

    await handler(sendSubmissionNotification)(ctx as never, { ...BASE_ARGS });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the site's emailSettings via _getEmailSettings with the siteId", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const settings = {
      fromName: "My Agency",
      fromEmail: "owner@myagency.com",
      resendApiKey: "re_site_key_abc",
    };
    const ctx = makeCtx(settings);

    await handler(sendSubmissionNotification)(ctx as never, { ...BASE_ARGS });

    const settingsCall = ctx.runQuery.mock.calls.find(
      ([_fn, args]: [unknown, Record<string, unknown>]) =>
        args && args.siteId === SITE_ID,
    );
    expect(settingsCall).toBeDefined();
  });

  it("sends through the SITE'S key (not the platform key) using the site's sender identity", async () => {
    process.env.RESEND_API_KEY = "re_platform_key_should_not_be_used";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const settings = {
      fromName: "My Agency",
      fromEmail: "owner@myagency.com",
      resendApiKey: "re_site_key_abc",
    };
    const ctx = makeCtx(settings);

    await handler(sendSubmissionNotification)(ctx as never, { ...BASE_ARGS });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    // Site key, NOT the platform key
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_site_key_abc",
    );

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // Site's own sender identity — never a hardcoded platform sender
    expect(String(body.from)).toContain("owner@myagency.com");
    expect(String(body.from)).toContain("My Agency");
    expect(body.to).toBe("owner@myagency.com");
    expect(body.subject).toBe("New submission: Contact Form");
  });

  it("falls back to formName as the sender display name when settings.fromName is absent", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const settings = {
      fromEmail: "owner@myagency.com",
      resendApiKey: "re_site_key_abc",
    };
    const ctx = makeCtx(settings);

    await handler(sendSubmissionNotification)(ctx as never, { ...BASE_ARGS });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(String(body.from)).toContain("Contact Form");
    expect(String(body.from)).toContain("owner@myagency.com");
  });

  it("sends one fetch per notification email and swallows per-recipient errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }))
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const settings = {
      fromName: "My Agency",
      fromEmail: "owner@myagency.com",
      resendApiKey: "re_site_key_abc",
    };
    const ctx = makeCtx(settings);

    await handler(sendSubmissionNotification)(ctx as never, {
      ...BASE_ARGS,
      notificationEmails: ["a@example.com", "b@example.com", "c@example.com"],
    });

    // All three attempted; failures logged but never thrown.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("makes no fetch calls when notificationEmails is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const settings = {
      fromName: "My Agency",
      fromEmail: "owner@myagency.com",
      resendApiKey: "re_site_key_abc",
    };
    const ctx = makeCtx(settings);

    await handler(sendSubmissionNotification)(ctx as never, {
      ...BASE_ARGS,
      notificationEmails: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
