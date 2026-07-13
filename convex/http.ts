/**
 * Public HTTP API — no auth required.
 * Used by client websites to fetch CMS content from Convex.
 *
 * Base: https://<your-convex-deployment>.convex.cloud
 * Endpoints: /api/public/{resource}?slug=<site-slug>
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Square-Signature",
  "Content-Type": "application/json",
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: CORS });
}

function notFound(msg = "Not found") {
  return new Response(JSON.stringify({ error: msg }), { status: 404, headers: CORS });
}

const http = httpRouter();

/* ── OPTIONS preflight ──────────────────────────────────────────────────── */
const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS }));

const preflightPaths = [
  "/api/public/homepage", "/api/public/footer", "/api/public/contact",
  "/api/public/events", "/api/public/courses", "/api/public/articles",
  "/api/public/articles/by-slug", "/api/public/articles/operon",
  "/api/public/seo", "/api/public/site", "/api/public/media",
  "/api/public/faqs", "/api/public/testimonials", "/api/public/pricing",
  "/api/public/submit",
  // Phase 2
  "/api/public/navigation", "/api/public/announcement", "/api/public/cta",
  "/api/public/team", "/api/public/downloads", "/api/public/jobs",
  "/api/public/popup", "/api/public/policy",
  // Phase 3 — Form Builder
  "/api/public/form", "/api/public/form/submit",
  // Square webhook
  "/api/square/webhook",
  // Phase 10 — Agency Edition™
  "/api/agency/branding",
];
for (const path of preflightPaths) {
  http.route({ path, method: "OPTIONS", handler: preflight });
}

/* ── GET /api/public/homepage?slug= ──────────────────────────────────────── */
http.route({
  path: "/api/public/homepage",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getHomepageBySlug, { slug });
    if (!data) return notFound();
    return ok(data);
  }),
});

/* ── GET /api/public/footer?slug= ────────────────────────────────────────── */
http.route({
  path: "/api/public/footer",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getFooterBySlug, { slug });
    if (!data) return notFound();
    return ok(data);
  }),
});

/* ── GET /api/public/contact?slug= ──────────────────────────────────────── */
http.route({
  path: "/api/public/contact",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getContactBySlug, { slug });
    if (!data) return notFound();
    return ok(data);
  }),
});

/* ── GET /api/public/events?slug= ───────────────────────────────────────── */
http.route({
  path: "/api/public/events",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getEventsBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/courses?slug= ──────────────────────────────────────── */
http.route({
  path: "/api/public/courses",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getCoursesBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/articles?slug= ─────────────────────────────────────── */
http.route({
  path: "/api/public/articles",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getArticlesBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/articles/by-slug?site=&article= ────────────────────── */
http.route({
  path: "/api/public/articles/by-slug",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const params = new URL(request.url).searchParams;
    const siteSlug = params.get("site") ?? "";
    const articleSlug = params.get("article") ?? "";
    if (!siteSlug || !articleSlug) return notFound("site and article params required");
    const data = await ctx.runQuery(internal.public.getArticleByArticleSlug, { siteSlug, articleSlug });
    if (!data) return notFound("Article not found");
    return ok(data);
  }),
});

/* ── GET /api/public/articles/operon?slug= ───────────────────────────────── */
http.route({
  path: "/api/public/articles/operon",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getArticlesForOperon, { slug });
    return ok({ source: "FSTS Website Operating System", site: slug, count: (data as any[]).length, articles: data });
  }),
});

/* ── GET /api/public/seo?slug= ──────────────────────────────────────────── */
http.route({
  path: "/api/public/seo",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getSeoBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/site?slug= ─────────────────────────────────────────── */
http.route({
  path: "/api/public/site",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getSiteBySlug, { slug });
    if (!data) return notFound();
    return ok({ name: data.name, slug: data.slug, domain: data.domain, brandColorPrimary: data.brandColorPrimary, brandColorSecondary: data.brandColorSecondary });
  }),
});

/* ── GET /api/public/media?slug= ────────────────────────────────────────── */
http.route({
  path: "/api/public/media",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getMediaBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/faqs?slug= ─────────────────────────────────────────── */
http.route({
  path: "/api/public/faqs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getFaqsBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/testimonials?slug= ─────────────────────────────────── */
http.route({
  path: "/api/public/testimonials",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getTestimonialsBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/pricing?slug= ──────────────────────────────────────── */
http.route({
  path: "/api/public/pricing",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getPricingBySlug, { slug });
    return ok(data);
  }),
});

/* ── OPTIONS for paths not in preflightPaths ────────────────────────────── */
http.route({ path: "/api/public/policies", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/careers", method: "OPTIONS", handler: preflight });

/* ── GET /api/public/policies?slug= ─────────────────────────────────────── */
http.route({
  path: "/api/public/policies",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getPoliciesBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/navigation?slug= ───────────────────────────────────── */
http.route({
  path: "/api/public/navigation",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getNavigationBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/announcement?slug= ─────────────────────────────────── */
http.route({
  path: "/api/public/announcement",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getAnnouncementBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/cta?slug= ──────────────────────────────────────────── */
http.route({
  path: "/api/public/cta",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getCtaBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/downloads?slug= ────────────────────────────────────── */
http.route({
  path: "/api/public/downloads",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getDownloadsBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/team?slug= ─────────────────────────────────────────── */
http.route({
  path: "/api/public/team",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getTeamBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/careers?slug= ──────────────────────────────────────── */
http.route({
  path: "/api/public/careers",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getCareersBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/popup?slug= ─────────────────────────────────────────── */
http.route({
  path: "/api/public/popup",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getPopupBySlug, { slug });
    return ok(data);
  }),
});

/* ── POST /api/public/submit ─────────────────────────────────────────────── */
http.route({
  path: "/api/public/submit",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { slug, formType, name, email, phone, message, ...rest } = body as any;
      if (!slug || !formType) {
        return new Response(JSON.stringify({ error: "slug and formType required" }), { status: 400, headers: CORS });
      }
      const id = await ctx.runMutation(internal.formSubmissions.submitInternal, {
        siteSlug: slug,
        formType,
        submitterName: name,
        submitterEmail: email,
        submitterPhone: phone,
        message,
        data: rest,
      });
      return ok({ id });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }),
});

// ── Phase 3 — Form Builder public endpoints ───────────────────────────────────

/* ── GET /api/public/form?slug=&form= ───────────────────────────────────────── */
http.route({
  path: "/api/public/form",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const params = new URL(request.url).searchParams;
    const slug = params.get("slug") ?? "";
    const formSlug = params.get("form") ?? "";
    if (!slug || !formSlug) return notFound("slug and form params required");
    const site = await ctx.runQuery(internal.public.getSiteBySlug, { slug });
    if (!site) return notFound("site not found");
    const form = await ctx.runQuery(internal.forms.getBySlug, { siteId: site._id, slug: formSlug });
    if (!form || form.status !== "published") return notFound("form not found or not published");

    // Return only the public-safe subset — never expose notificationEmails,
    // crmRouting, or other internal operational settings to public callers
    const publicSettings = {
      submitLabel: form.settings?.submitLabel ?? "Submit",
      successMessage: form.settings?.successMessage ?? "",
      redirectUrl: form.settings?.redirectUrl ?? "",
      honeypot: form.settings?.honeypot ?? true,
    };
    const publicForm = {
      _id: form._id,
      name: form.name,
      slug: form.slug,
      fields: form.fields,
      settings: publicSettings,
    };
    return ok(publicForm);
  }),
});

/* ── POST /api/public/form/upload-url ───────────────────────────────────────── */
// Returns a Convex storage upload URL so public form file_upload fields can
// upload files directly. The returned storageId is then included in submit data.
http.route({
  path: "/api/public/form/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, _request) => {
    try {
      const uploadUrl = await ctx.storage.generateUploadUrl();
      return ok({ uploadUrl });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }),
});

/* ── OPTIONS /api/public/form/upload-url ────────────────────────────────────── */
http.route({
  path: "/api/public/form/upload-url",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) =>
    new Response(null, { status: 204, headers: CORS }),
  ),
});

/* ── POST /api/public/form/submit ────────────────────────────────────────────── */
http.route({
  path: "/api/public/form/submit",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json() as any;
      const { slug, formId, data, submitterName, submitterEmail, submitterPhone } = body;
      if (!slug || !formId) {
        return new Response(JSON.stringify({ error: "slug and formId required" }), { status: 400, headers: CORS });
      }

      // Honeypot: if the hidden trap field is non-empty, silently acknowledge
      if (data && data["_fsts_hp"] && String(data["_fsts_hp"]).trim() !== "") {
        return ok({ id: "hp" });
      }

      // Validate formId is a non-empty string before hitting the DB
      if (typeof formId !== "string" || formId.length < 10) {
        return new Response(JSON.stringify({ error: "invalid formId" }), { status: 400, headers: CORS });
      }

      const site = await ctx.runQuery(internal.public.getSiteBySlug, { slug });
      if (!site) return new Response(JSON.stringify({ error: "site not found" }), { status: 404, headers: CORS });

      const result = await ctx.runMutation(internal.forms.submitPublic, {
        siteId: site._id,
        formId,
        data: data ?? {},
        submitterName,
        submitterEmail,
        submitterPhone,
      });

      if (result.validationErrors) {
        return new Response(
          JSON.stringify({ error: "Validation failed", fields: result.validationErrors }),
          { status: 422, headers: CORS },
        );
      }

      return ok({ id: result.id });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }),
});

// ── WOS Phase 1: Provider-agnostic payment webhook ───────────────────────────

/* ── POST /api/payment/webhook?provider=&slug= ───────────────────────────── */
http.route({ path: "/api/payment/webhook", method: "OPTIONS", handler: preflight });

http.route({
  path: "/api/payment/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const searchParams = new URL(request.url).searchParams;
      const provider = searchParams.get("provider") ?? "";
      const slug = searchParams.get("slug") ?? "";

      if (!provider || !slug) {
        return new Response(JSON.stringify({ error: "provider and slug params required" }), { status: 400, headers: CORS });
      }

      const site = await ctx.runQuery(internal.square.getSiteBySlugInternal, { slug });
      if (!site) return new Response(JSON.stringify({ error: "Site not found" }), { status: 404, headers: CORS });

      const rawBody = await request.text();
      const connector = await ctx.runQuery(internal.paymentConnectors.getConnectorInternal, { siteId: site._id, provider });

      if (!connector?.hasWebhookKey) {
        // Dashboard warning — log the missing-key incident then reject
        await ctx.runMutation(internal.paymentConnectors.logPaymentEventInternal, {
          siteId: site._id,
          provider,
          eventType: "webhook.signature_key_missing",
          status: "error",
          metadata: { slug },
          errorMessage: `Webhook received but no signature key is configured for provider "${provider}". Configure the key in Payment Providers → Providers.`,
        });
        return new Response(JSON.stringify({ error: "Webhook signature key not configured for this provider. Add it in Payment Providers settings." }), { status: 401, headers: CORS });
      }

      const incomingSig = request.headers.get("X-Webhook-Signature") ?? request.headers.get("Square-Signature") ?? request.headers.get("Stripe-Signature") ?? "";
      if (!incomingSig) {
        return new Response(JSON.stringify({ error: "Missing webhook signature header" }), { status: 401, headers: CORS });
      }

      // Route to provider-specific verifier.
      // Credentials come exclusively from paymentConnectors (encrypted at rest).
      let verified = false;
      const decryptedCreds: any = await ctx.runAction(
        internal.paymentConnectors.getDecryptedCredentials, { siteId: site._id, provider }
      );

      if (provider === "square") {
        // Prefer webhookSignatureKey from paymentConnectors; fall back to legacy squareConfig.
        let storedKey: string = decryptedCreds?.webhookSignatureKey ?? "";
        if (!storedKey) {
          const squareCfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId: site._id });
          storedKey = squareCfg?.webhookSignatureKey ?? "";
        }
        if (storedKey) {
          const enc = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(storedKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
          const sigBuffer = await crypto.subtle.sign("HMAC", keyMaterial, enc.encode(request.url + rawBody));
          const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
          verified = expected === incomingSig;
        }
      } else {
        // Other providers — signature verification not yet implemented (stub)
        verified = false;
      }

      if (!verified) {
        await ctx.runMutation(internal.paymentConnectors.logPaymentEventInternal, {
          siteId: site._id,
          provider,
          eventType: "webhook.signature_invalid",
          status: "error",
          errorMessage: "Webhook signature verification failed",
        });
        return new Response(JSON.stringify({ error: "Invalid webhook signature" }), { status: 401, headers: CORS });
      }

      const event = JSON.parse(rawBody) as any;
      await ctx.runMutation(internal.paymentConnectors.logPaymentEventInternal, {
        siteId: site._id,
        provider,
        eventType: `webhook.${event.type ?? "unknown"}`,
        status: "success",
        metadata: { eventId: event.event_id ?? event.id },
      });

      return ok({ received: true });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }),
});

// ── Phase 5: Square webhook ───────────────────────────────────────────────────

/* ── POST /api/square/webhook?slug= ─────────────────────────────────────── */
http.route({
  path: "/api/square/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const slug = new URL(request.url).searchParams.get("slug") ?? "";
      if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400, headers: CORS });

      const rawBody = await request.text();
      const squareSig = request.headers.get("Square-Signature") ?? "";

      const site = await ctx.runQuery(internal.square.getSiteBySlugInternal, { slug });
      if (!site) return new Response(JSON.stringify({ error: "Site not found" }), { status: 404, headers: CORS });

      const cfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId: site._id });
      const storedKey = cfg?.webhookSignatureKey ?? "";

      if (!storedKey) {
        return new Response(JSON.stringify({ error: "Webhook signature key not configured" }), { status: 401, headers: CORS });
      }
      if (!squareSig) {
        return new Response(JSON.stringify({ error: "Missing Square-Signature header" }), { status: 401, headers: CORS });
      }

      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(storedKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sigBuffer = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(request.url + rawBody));
      const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
      if (expected !== squareSig) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: CORS });
      }

      const event = JSON.parse(rawBody) as any;
      const eventType = event.type as string;

      if (eventType === "payment.created" || eventType === "payment.updated") {
        const payment = event.data?.object?.payment;
        if (payment) {
          await ctx.runMutation(internal.square.webhookUpsertOrder, {
            siteId: site._id,
            squareOrderId: payment.order_id ?? payment.id,
            squarePaymentId: payment.id,
            amountCents: payment.amount_money?.amount ?? 0,
            status: payment.status ?? "COMPLETED",
            createdAt: new Date(payment.created_at ?? Date.now()).getTime(),
          });
        }
      }

      if (eventType === "refund.created" || eventType === "refund.updated") {
        const refund = event.data?.object?.refund;
        if (refund?.payment_id) {
          const siteId = site._id;
          await ctx.runMutation(internal.square.updateRefundStatus, {
            siteId,
            squarePaymentId: refund.payment_id,
            refundStatus: refund.status ?? "PENDING",
          });
        }
      }

      return ok({ received: true });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }),
});

// ── Phase 10 — Agency Edition™ ────────────────────────────────────────────────

/**
 * GET /api/agency/branding?slug=<agency-slug>
 *
 * Returns the Clerk appearance overrides and branding metadata for a given
 * agency subdomain slug. Called by the dashboard on load to dynamically theme
 * the login page for white-label agency deployments.
 *
 * Response (200):
 * {
 *   name: string,
 *   logoUrl: string | null,
 *   primaryColor: string,
 *   accentColor: string,
 *   supportEmail: string,
 *   helpCenterUrl: string | null,
 * }
 *
 * Response (404): { error: "not found" } when no agency matches the slug,
 * or the agency is inactive. Callers should fall back to FSTS defaults.
 */
http.route({
  path: "/api/agency/branding",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const agency = await ctx.runQuery(internal.agencies.getBySlug, { slug });
    if (!agency || !agency.isActive) return notFound("Agency not found or inactive");
    return ok({
      name: agency.name,
      logoUrl: agency.logoUrl ?? null,
      primaryColor: agency.primaryColor,
      accentColor: agency.accentColor,
      supportEmail: agency.supportEmail,
      helpCenterUrl: agency.helpCenterUrl ?? null,
    });
  }),
});

export default http;
