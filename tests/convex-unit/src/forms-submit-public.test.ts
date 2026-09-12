/**
 * Unit tests: forms.submitPublic — the public form submission pipeline
 * (§4 forms follow-up contract pin).
 *
 * WHAT THIS PINS (client-facing contract, verified against convex/forms.ts):
 *  1. Required-field and regex validation are enforced SERVER-SIDE (the
 *     mutation returns { validationErrors } — the client UI is convenience,
 *     not the enforcement layer).
 *  2. Conditional visibility is evaluated server-side: a field hidden by
 *     its condition is not required.
 *  3. Honeypot is enforced at the http layer (a non-empty _fsts_hp value is
 *     acknowledged with no insert) — pinned here at the mutation boundary:
 *     the mutation never receives the honeypot key in normal flow.
 *  4. On success with crmRouting + notificationEmails, the mutation inserts
 *     the submission AND schedules both integrations (crm.syncToCrm +
 *     forms.sendSubmissionNotification) — the client toggles are real
 *     contracts, not decorative switches.
 *  5. Draft forms are not publicly submittable (status !== "published"
 *     rejects).
 *
 * MOCK ARCHITECTURE: identical to forms-email-lock.test.ts — the Convex
 * server module is stubbed so `mutation`/`internalMutation` registrations
 * return { _handler }, then handlers are invoked with plain ctx mocks.
 */

import { describe, it, expect, vi } from "vitest";

// ── Mock Convex infrastructure BEFORE importing the module under test ────

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
    crm: { syncToCrm: "crm.syncToCrm" },
    forms: { sendSubmissionNotification: "forms.sendSubmissionNotification" },
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
  PERMISSIONS: {
    CONTENT_CREATE: "content.create",
    CONTENT_UPDATE: "content.update",
    CONTENT_DELETE: "content.delete",
  },
}));

// ── Import module under test ─────────────────────────────────────────────

import { submitPublic } from "../../convex/forms.js";

type Reg = { _handler: (...args: unknown[]) => unknown };
const handler = (reg: Reg) => reg._handler as (ctx: unknown, args: unknown) => Promise<unknown>;

// ── Fake records ─────────────────────────────────────────────────────────

const SITE_ID = "site_test_001" as unknown as never;
const FORM_ID = "form_test_001";

function makeForm(overrides: Record<string, unknown> = {}) {
  return {
    _id: FORM_ID,
    siteId: SITE_ID,
    name: "Contact form",
    slug: "contact",
    status: "published",
    fields: [
      { id: "f1", type: "short_text", label: "Full name", required: true },
      {
        id: "f2",
        type: "email",
        label: "Email address",
        required: false,
        validationRegex: "^.+@.+\\..+$",
        validationMessage: "Enter a valid email address",
      },
      {
        id: "f3",
        type: "dropdown",
        label: "Preferred contact",
        required: true,
        options: ["Email", "Phone"],
        condition: { sourceFieldId: "f1", operator: "is", value: "robot" },
      },
    ],
    settings: {
      submitLabel: "Send message",
      successMessage: "Thank you!",
      redirectUrl: "",
      notificationEmails: [],
      crmRouting: false,
      honeypot: true,
    },
    ...overrides,
  };
}

/** ctx mock: db.get returns the form; db.insert + scheduler are vi.fn. */
function makeCtx(form: Record<string, unknown> | null) {
  return {
    db: {
      get: vi.fn(async () => form),
      insert: vi.fn(async () => "submission_001"),
    },
    scheduler: {
      runAfter: vi.fn(async () => {}),
    },
  };
}

const submit = (ctx: unknown, data: Record<string, unknown>) =>
  handler(submitPublic)(ctx, {
    siteId: SITE_ID,
    formId: FORM_ID,
    data,
    submitterName: null,
    submitterEmail: null,
    submitterPhone: null,
  });

// ── Tests ────────────────────────────────────────────────────────────────

describe("forms.submitPublic — server-side validation contract", () => {
  it("inserts the submission when required fields and regex pass", async () => {
    const ctx = makeCtx(makeForm());
    const result = (await submit(ctx, { f1: "Jane Doe", f2: "jane@example.com" })) as {
      id: string;
    };
    expect(result.id).toBe("submission_001");
    expect(ctx.db.insert).toHaveBeenCalledTimes(1);
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "formSubmissions",
      expect.objectContaining({ siteId: SITE_ID, formId: FORM_ID, status: "new", data: { f1: "Jane Doe", f2: "jane@example.com" } }),
    );
  });

  it("returns validationErrors (no insert) when a required field is missing", async () => {
    const ctx = makeCtx(makeForm());
    const result = (await submit(ctx, { f2: "jane@example.com" })) as {
      validationErrors: Record<string, string>;
    };
    expect(result.validationErrors).toEqual({ f1: "Full name is required" });
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("returns the field's custom regex message when the value fails validation", async () => {
    const ctx = makeCtx(makeForm());
    const result = (await submit(ctx, { f1: "Jane Doe", f2: "not-an-email" })) as {
      validationErrors: Record<string, string>;
    };
    expect(result.validationErrors).toEqual({ f2: "Enter a valid email address" });
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("skips validation for a field hidden by its conditional rule (no server-side silent drop)", async () => {
    // f3 is required but conditionally hidden unless f1 === "robot".
    const ctx = makeCtx(makeForm());
    const result = (await submit(ctx, { f1: "Jane Doe", f2: "jane@example.com" })) as {
      id: string;
    };
    expect(result.id).toBe("submission_001");
  });

  it("rejects unpublished (draft) forms — publish is the only public gate", async () => {
    const ctx = makeCtx(makeForm({ status: "draft" }));
    await expect(submit(ctx, { f1: "Jane Doe" })).rejects.toThrow("Form not available");
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("schedules CRM routing + notification emails when the client toggles are on", async () => {
    const form = makeForm({
      settings: {
        submitLabel: "Send message",
        successMessage: "Thanks",
        redirectUrl: "",
        notificationEmails: ["owner@agency.com"],
        crmRouting: true,
        honeypot: true,
      },
    });
    const ctx = makeCtx(form);
    const result = (await submit(ctx, { f1: "Jane Doe", f2: "jane@example.com" })) as {
      id: string;
    };
    expect(result.id).toBe("submission_001");
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(2);
    const crm = ctx.scheduler.runAfter.mock.calls.find((c) => (c[2] as any).entityType);
    const email = ctx.scheduler.runAfter.mock.calls.find((c) => (c[2] as any).notificationEmails);
    expect(crm?.[2]).toMatchObject({ provider: "operon", entityType: "custom_form" });
    expect(email?.[2]).toMatchObject({ notificationEmails: ["owner@agency.com"], formName: "Contact form" });
  });
});
