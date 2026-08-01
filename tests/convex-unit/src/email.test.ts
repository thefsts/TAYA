/**
 * Unit tests: Email notification and welcome flows
 *
 * Covers:
 *  1. email.sendFormNotification — notifyOnNewLead/notifyOnBooking flags,
 *     no-fromEmail guard, correct subject/html/to passed to email.send
 *  2. email.sendPortalWelcome — approval vs active copy variant,
 *     no-fromEmail guard
 *  3. formSubmissions.submit — scheduler enqueues email.sendFormNotification
 *  4. portal.register — sendPortalWelcome is called for active and
 *     pending_approval paths; fire-and-forget (rejection does not block)
 *
 * All tests use plain mock objects for `ctx` — no live Convex backend.
 * Convex registration helpers are stubbed to expose `_handler` directly.
 *
 * We deliberately avoid function-reference equality checks (e.g.
 * `call.fn === internal.email.send`) because the Convex-generated `internal`
 * object resolves through a different module instance in vitest's module
 * system than the one the modules under test receive.  Instead we verify
 * behaviour by the unique argument shapes of each call.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock Convex infrastructure BEFORE importing modules under test ───────────

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
      sendFormNotification: "email.sendFormNotification",
      sendPortalWelcome: "email.sendPortalWelcome",
    },
    portal: {
      _getSiteBySlug: "portal._getSiteBySlug",
      _getPortalConfig: "portal._getPortalConfig",
      _getPortalUserByEmail: "portal._getPortalUserByEmail",
      _createPortalUser: "portal._createPortalUser",
      _createPortalSession: "portal._createPortalSession",
    },
    automation: {
      runAutomationRules: "automation.runAutomationRules",
    },
  },
}));

vi.mock("../../convex/lib/requireSiteAccess.js", () => ({
  checkSiteAccess: vi.fn(async () => true),
  checkModuleEnabled: vi.fn(async () => true),
  requireSiteAccessMutation: vi.fn(async () => {}),
  requireModuleEnabled: vi.fn(async () => {}),
  requireDesignCapability: vi.fn(async () => ({ name: "Test User" })),
}));

vi.mock("../../convex/lib/logActivity.js", () => ({
  logActivity: vi.fn(async () => {}),
}));

vi.mock("../../convex/lib/recordVersion.js", () => ({
  recordVersion: vi.fn(async () => {}),
}));

vi.mock("../../convex/lib/getCurrentUser.js", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

// ── Import modules under test ────────────────────────────────────────────────
import { send, sendFormNotification, sendPortalWelcome } from "../../convex/email.js";
import { submit } from "../../convex/formSubmissions.js";
import { register } from "../../convex/portal.js";

// ── Helper: unwrap handler from the registration stub ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = <T extends { _handler: (...args: any[]) => any }>(reg: T) =>
  reg._handler;

// ── Fake IDs ─────────────────────────────────────────────────────────────────
const SITE_ID = "site_test_001" as unknown as never;

// ── Shared email-settings factory ────────────────────────────────────────────
function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    siteId: SITE_ID,
    fromName: "My Agency",
    fromEmail: "owner@myagency.com",
    replyToEmail: "",
    notifyOnNewLead: true,
    notifyOnBooking: true,
    ...overrides,
  };
}

// ── Argument-shape helpers ────────────────────────────────────────────────────
// These predicates identify calls by the unique shape of their arguments,
// avoiding fragile function-reference comparisons across module instances.

/** Identify an email.send call (unique field: `to` + `subject` + `html`). */
const isEmailSendCall = (args: Record<string, unknown>) =>
  "to" in args && "subject" in args && "html" in args;

/** Identify a sendFormNotification scheduler call (has `formType` but not `triggerType`). */
const isFormNotificationCall = (args: Record<string, unknown>) =>
  "formType" in args && !("triggerType" in args);

/** Identify a runAutomationRules scheduler call (has `triggerType`). */
const isAutomationCall = (args: Record<string, unknown>) => "triggerType" in args;

/** Identify a sendPortalWelcome call (has `requiresApproval` field). */
const isPortalWelcomeCall = (args: Record<string, unknown>) =>
  "requiresApproval" in args && "firstName" in args;

// ═══════════════════════════════════════════════════════════════════════════
// 1. email.sendFormNotification
// ═══════════════════════════════════════════════════════════════════════════

describe("email.sendFormNotification", () => {
  type RunActionCall = { fn: unknown; args: Record<string, unknown> };

  function makeCtx(settingsOverrides: Record<string, unknown> = {}) {
    const settings = makeSettings(settingsOverrides);
    const runActionCalls: RunActionCall[] = [];

    return {
      runQuery: vi.fn(async () => settings),
      runAction: vi.fn(async (fn: unknown, args: Record<string, unknown>) => {
        runActionCalls.push({ fn, args });
        return { success: true };
      }),
      _runActionCalls: runActionCalls,
    };
  }

  it("falls back to fromEmail as recipient when notificationEmail is not set", async () => {
    // Default settings have no notificationEmail — recipient should be fromEmail
    const ctx = makeCtx();
    await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "contact_form",
      submitterName: "Jane Doe",
      submitterEmail: "jane@example.com",
      submitterPhone: "555-1234",
      message: "Hello there",
    });

    expect(ctx._runActionCalls).toHaveLength(1);
    const call = ctx._runActionCalls[0];
    expect(isEmailSendCall(call.args)).toBe(true);
    expect(call.args.to).toBe("owner@myagency.com");
    expect(String(call.args.subject)).toContain("Jane Doe");
    expect(String(call.args.subject)).toContain("contact form");
    expect(String(call.args.html)).toContain("Jane Doe");
    expect(String(call.args.html)).toContain("jane@example.com");
    expect(String(call.args.html)).toContain("Hello there");
    expect(call.args.replyTo).toBe("jane@example.com");
  });

  it("sends to notificationEmail (not fromEmail) when notificationEmail is set", async () => {
    const ctx = makeCtx({ notificationEmail: "alerts@myagency.com" });
    await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "contact_form",
      submitterName: "Jane Doe",
      submitterEmail: "jane@example.com",
    });

    expect(ctx._runActionCalls).toHaveLength(1);
    const call = ctx._runActionCalls[0];
    expect(isEmailSendCall(call.args)).toBe(true);
    // Recipient must be the dedicated notification address, not the sender address
    expect(call.args.to).toBe("alerts@myagency.com");
    expect(call.args.to).not.toBe("owner@myagency.com");
    // Sender identity (fromEmail) stays as the site's fromEmail regardless of recipient
    expect(call.args.fromEmail).toBe("owner@myagency.com");
  });

  it("uses the notifyOnNewLead flag — skips when false for a lead form", async () => {
    const ctx = makeCtx({ notifyOnNewLead: false });
    const result = await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "contact_form",
      submitterEmail: "bob@example.com",
    });

    expect(result).toMatchObject({ skipped: true });
    expect(ctx._runActionCalls).toHaveLength(0);
  });

  it("uses the notifyOnBooking flag — skips when false for a booking form", async () => {
    const ctx = makeCtx({ notifyOnBooking: false });
    const result = await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "booking_request",
      submitterEmail: "alice@example.com",
    });

    expect(result).toMatchObject({ skipped: true });
    expect(ctx._runActionCalls).toHaveLength(0);
  });

  it("routes event_ form types to the notifyOnBooking flag", async () => {
    const ctx = makeCtx({ notifyOnBooking: false });
    const result = await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "event_registration",
      submitterEmail: "alice@example.com",
    });

    expect(result).toMatchObject({ skipped: true });
    expect(ctx._runActionCalls).toHaveLength(0);
  });

  it("skips gracefully when neither notificationEmail nor fromEmail is set — returns skipped reason", async () => {
    // When both are absent there is no recipient — must bail out without sending
    const ctx = makeCtx({ fromEmail: undefined, notificationEmail: undefined });
    const result = await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "contact_form",
      submitterEmail: "someone@example.com",
    });

    expect(result).toMatchObject({ skipped: true, reason: "no notification email configured" });
    expect(ctx._runActionCalls).toHaveLength(0);
  });

  it("skips gracefully when emailSettings is null (no settings document)", async () => {
    const ctx = {
      runQuery: vi.fn(async () => null),
      runAction: vi.fn(async () => ({ success: true })),
      _runActionCalls: [] as RunActionCall[],
    };
    const result = await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "contact_form",
      submitterEmail: "someone@example.com",
    });

    expect(result).toMatchObject({ skipped: true });
    expect(ctx.runAction).not.toHaveBeenCalled();
  });

  it("sets fromName from settings on the send call", async () => {
    const ctx = makeCtx({ fromName: "Acme Corp" });
    await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "contact_form",
      submitterEmail: "x@x.com",
    });

    expect(ctx._runActionCalls[0].args.fromName).toBe("Acme Corp");
  });

  it("reads emailSettings for the correct siteId", async () => {
    const ctx = makeCtx();
    await handler(sendFormNotification)(ctx as never, {
      siteId: SITE_ID,
      formType: "contact_form",
    });

    // runQuery must have been called with { siteId: SITE_ID }
    const settingsCall = ctx.runQuery.mock.calls.find(
      ([_fn, args]: [unknown, Record<string, unknown>]) =>
        args && (args as Record<string, unknown>).siteId === SITE_ID,
    );
    expect(settingsCall).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. email.sendPortalWelcome
// ═══════════════════════════════════════════════════════════════════════════

describe("email.sendPortalWelcome", () => {
  type RunActionCall = { fn: unknown; args: Record<string, unknown> };

  const BASE_ARGS = {
    siteId: SITE_ID,
    siteName: "Cool Agency",
    firstName: "Alice",
    email: "alice@example.com",
    requiresApproval: false,
  };

  function makeCtx(settingsOverrides: Record<string, unknown> = {}) {
    const settings = makeSettings(settingsOverrides);
    const runActionCalls: RunActionCall[] = [];
    return {
      runQuery: vi.fn(async () => settings),
      runAction: vi.fn(async (fn: unknown, args: Record<string, unknown>) => {
        runActionCalls.push({ fn, args });
        return { success: true };
      }),
      _runActionCalls: runActionCalls,
    };
  }

  it("skips gracefully when fromEmail is absent", async () => {
    const ctx = makeCtx({ fromEmail: undefined });
    const result = await handler(sendPortalWelcome)(ctx as never, BASE_ARGS);

    expect(result).toMatchObject({ skipped: true, reason: "no fromEmail configured" });
    expect(ctx._runActionCalls).toHaveLength(0);
  });

  it("sends welcome email to the registrant's address when active", async () => {
    const ctx = makeCtx();
    await handler(sendPortalWelcome)(ctx as never, { ...BASE_ARGS, requiresApproval: false });

    expect(ctx._runActionCalls).toHaveLength(1);
    const call = ctx._runActionCalls[0];
    expect(isEmailSendCall(call.args)).toBe(true);
    expect(call.args.to).toBe("alice@example.com");
    expect(String(call.args.subject)).toContain("Cool Agency");
    expect(String(call.args.html)).toContain("Alice");
    // Active copy — should NOT mention pending/approval
    expect(String(call.args.html)).not.toContain("pending approval");
    expect(String(call.args.html)).toContain("log in");
  });

  it("uses approval-pending copy variant when requiresApproval = true", async () => {
    const ctx = makeCtx();
    await handler(sendPortalWelcome)(ctx as never, { ...BASE_ARGS, requiresApproval: true });

    const call = ctx._runActionCalls[0];
    expect(String(call.args.html)).toContain("pending approval");
    // Active-account phrase should NOT appear
    expect(String(call.args.html)).not.toContain("log in now");
  });

  it("falls back to siteName as fromName when settings.fromName is absent", async () => {
    const ctx = makeCtx({ fromName: undefined });
    await handler(sendPortalWelcome)(ctx as never, { ...BASE_ARGS, siteName: "My Studio" });

    expect(ctx._runActionCalls[0].args.fromName).toBe("My Studio");
  });

  it("uses configured fromName when present in settings", async () => {
    const ctx = makeCtx({ fromName: "Agency Brand Name" });
    await handler(sendPortalWelcome)(ctx as never, BASE_ARGS);

    expect(ctx._runActionCalls[0].args.fromName).toBe("Agency Brand Name");
  });

  it("reads emailSettings for the correct siteId", async () => {
    const ctx = makeCtx();
    await handler(sendPortalWelcome)(ctx as never, BASE_ARGS);

    const settingsCall = ctx.runQuery.mock.calls.find(
      ([_fn, args]: [unknown, Record<string, unknown>]) =>
        args && (args as Record<string, unknown>).siteId === SITE_ID,
    );
    expect(settingsCall).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. formSubmissions.submit — scheduler enqueues sendFormNotification
// ═══════════════════════════════════════════════════════════════════════════

describe("formSubmissions.submit — email scheduler", () => {
  const SITE_DOC = { _id: SITE_ID, slug: "test-site", name: "Test Site" };

  type SchedulerCall = { delay: number; fn: unknown; args: Record<string, unknown> };

  function makeCtx() {
    const schedulerCalls: SchedulerCall[] = [];
    return {
      db: {
        query: () => ({
          withIndex: () => ({ first: async () => SITE_DOC }),
        }),
        insert: vi.fn(async () => "sub_new_001"),
      },
      scheduler: {
        runAfter: vi.fn(
          async (delay: number, fn: unknown, args: Record<string, unknown>) => {
            schedulerCalls.push({ delay, fn, args });
          },
        ),
      },
      _schedulerCalls: schedulerCalls,
    };
  }

  it("enqueues sendFormNotification via scheduler.runAfter", async () => {
    const ctx = makeCtx();
    await handler(submit)(ctx as never, {
      siteSlug: "test-site",
      formType: "contact_form",
      submitterName: "Jane",
      submitterEmail: "jane@example.com",
      submitterPhone: "555-0000",
      message: "Hi!",
    });

    // Find by argument shape: form notification args have formType but not triggerType
    const emailCall = ctx._schedulerCalls.find((c) => isFormNotificationCall(c.args));
    expect(emailCall).toBeDefined();
    expect(emailCall!.delay).toBe(0);
    expect(emailCall!.args.siteId).toBe(SITE_ID);
    expect(emailCall!.args.formType).toBe("contact_form");
    expect(emailCall!.args.submitterName).toBe("Jane");
    expect(emailCall!.args.submitterEmail).toBe("jane@example.com");
    expect(emailCall!.args.submitterPhone).toBe("555-0000");
    expect(emailCall!.args.message).toBe("Hi!");
  });

  it("also enqueues the automation trigger in the same submit call", async () => {
    const ctx = makeCtx();
    await handler(submit)(ctx as never, {
      siteSlug: "test-site",
      formType: "booking_request",
      submitterEmail: "alice@example.com",
    });

    // Automation call args have triggerType
    const automationCall = ctx._schedulerCalls.find((c) => isAutomationCall(c.args));
    expect(automationCall).toBeDefined();
  });

  it("inserts a formSubmission record with status 'new' before scheduling", async () => {
    const ctx = makeCtx();
    await handler(submit)(ctx as never, { siteSlug: "test-site", formType: "contact_form" });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "formSubmissions",
      expect.objectContaining({ status: "new", siteId: SITE_ID }),
    );
  });

  it("throws when the site slug does not exist", async () => {
    const ctx = makeCtx();
    (ctx.db as unknown as { query: unknown }).query = () => ({
      withIndex: () => ({ first: async () => null }),
    });

    await expect(
      handler(submit)(ctx as never, { siteSlug: "unknown-slug", formType: "contact_form" }),
    ).rejects.toThrow("Site not found");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. portal.register — sendPortalWelcome is called
// ═══════════════════════════════════════════════════════════════════════════

describe("portal.register — sendPortalWelcome integration", () => {
  const SITE_DOC = { _id: SITE_ID, name: "Test Studio", slug: "test-studio" };

  const OPEN_CONFIG = { enabled: true, registrationOpen: true, requireApproval: false };
  const APPROVAL_CONFIG = { enabled: true, registrationOpen: true, requireApproval: true };

  type RunActionCall = { fn: unknown; args: Record<string, unknown> };

  function makeCtx(config = OPEN_CONFIG) {
    const runActionCalls: RunActionCall[] = [];

    // Distinguish queries by argument shape:
    //   _getSiteBySlug        → { slug }
    //   _getPortalUserByEmail → { siteId, email }
    //   _getPortalConfig      → { siteId }  (no email)
    const runQuery = vi.fn(async (_fn: unknown, args: Record<string, unknown>) => {
      if ("slug" in args) return SITE_DOC;
      if ("email" in args) return null; // no pre-existing portal user
      return config;
    });

    const runMutation = vi.fn(async (_fn: unknown) => "portal_user_001" as never);

    const runAction = vi.fn(async (fn: unknown, args: Record<string, unknown>) => {
      runActionCalls.push({ fn, args });
      return { success: true };
    });

    return { runQuery, runMutation, runAction, _runActionCalls: runActionCalls };
  }

  const VALID_ARGS = {
    siteSlug: "test-studio",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    password: "securepassword123",
  };

  it("calls sendPortalWelcome with requiresApproval=false for an active registration", async () => {
    const ctx = makeCtx(OPEN_CONFIG);
    const result = await handler(register)(ctx as never, VALID_ARGS);

    expect(result.success).toBe(true);
    // Welcome call args contain requiresApproval + firstName
    const welcomeCall = ctx._runActionCalls.find((c) => isPortalWelcomeCall(c.args));
    expect(welcomeCall).toBeDefined();
    expect(welcomeCall!.args.siteId).toBe(SITE_ID);
    expect(welcomeCall!.args.siteName).toBe("Test Studio");
    expect(welcomeCall!.args.firstName).toBe("Alice");
    expect(welcomeCall!.args.email).toBe("alice@example.com");
    expect(welcomeCall!.args.requiresApproval).toBe(false);
  });

  it("calls sendPortalWelcome with requiresApproval=true for a pending_approval registration", async () => {
    const ctx = makeCtx(APPROVAL_CONFIG);
    const result = await handler(register)(ctx as never, VALID_ARGS);

    expect(result.success).toBe(true);
    expect((result as { requiresApproval?: boolean }).requiresApproval).toBe(true);

    const welcomeCall = ctx._runActionCalls.find((c) => isPortalWelcomeCall(c.args));
    expect(welcomeCall).toBeDefined();
    expect(welcomeCall!.args.requiresApproval).toBe(true);
  });

  it("registration succeeds even when sendPortalWelcome rejects (fire-and-forget)", async () => {
    const ctx = makeCtx(OPEN_CONFIG);
    // Make the welcome email call throw — the .catch() in register must absorb it
    ctx.runAction = vi.fn(async (_fn: unknown, args: Record<string, unknown>) => {
      if (isPortalWelcomeCall(args)) throw new Error("SMTP timeout");
      ctx._runActionCalls.push({ fn: _fn, args });
      return { success: true };
    });

    const result = await handler(register)(ctx as never, VALID_ARGS);
    expect(result.success).toBe(true);
  });

  it("normalises email to lowercase before calling sendPortalWelcome", async () => {
    const ctx = makeCtx(OPEN_CONFIG);
    await handler(register)(ctx as never, { ...VALID_ARGS, email: "ALICE@Example.COM" });

    const welcomeCall = ctx._runActionCalls.find((c) => isPortalWelcomeCall(c.args));
    expect(welcomeCall).toBeDefined();
    expect(welcomeCall!.args.email).toBe("alice@example.com");
  });

  it("returns success:false when site is not found — no email sent", async () => {
    const ctx = makeCtx();
    ctx.runQuery = vi.fn(async () => null);

    const result = await handler(register)(ctx as never, VALID_ARGS);
    expect(result.success).toBe(false);
    expect(ctx._runActionCalls).toHaveLength(0);
  });

  it("returns success:false when registration is closed — no email sent", async () => {
    const ctx = makeCtx({ ...OPEN_CONFIG, registrationOpen: false });

    const result = await handler(register)(ctx as never, VALID_ARGS);
    expect(result.success).toBe(false);
    expect(ctx._runActionCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. email.send — Resend REST API wrapper
// ═══════════════════════════════════════════════════════════════════════════

describe("email.send", () => {
  const SEND_ARGS = {
    to: "recipient@example.com",
    subject: "Test subject",
    html: "<p>Hello</p>",
    fromName: "My Agency",
    fromEmail: "noreply@myagency.com",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns { success: false } without throwing when RESEND_API_KEY is absent", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Patch process.env directly too, since the handler reads process.env.RESEND_API_KEY
    const origKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      const result = await handler(send)({} as never, SEND_ARGS);
      expect(result).toMatchObject({ success: false });
      // fetch must NOT have been called — no real network request
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
    }
  });

  it("returns { success: false, error } without throwing when Resend returns non-200", async () => {
    process.env.RESEND_API_KEY = "test-api-key";
    const fetchMock = vi.fn(async () =>
      new Response("rate limit exceeded", { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await handler(send)({} as never, SEND_ARGS);

    expect(result).toMatchObject({ success: false });
    expect((result as { error?: string }).error).toBeTruthy();
  });

  it("calls fetch with correct Authorization header and body fields on success", async () => {
    process.env.RESEND_API_KEY = "re_test_secret";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await handler(send)({} as never, SEND_ARGS);

    expect(result).toMatchObject({ success: true });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer re_test_secret",
    );

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.to).toEqual(["recipient@example.com"]);
    expect(body.subject).toBe("Test subject");
    expect(body.html).toBe("<p>Hello</p>");
    expect(String(body.from)).toContain("noreply@myagency.com");
    expect(String(body.from)).toContain("My Agency");
  });
});
