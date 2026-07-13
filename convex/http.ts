/**
 * Public HTTP API — no auth required.
 * Used by the Corsair Tactical Solutions Next.js website to fetch
 * CMS content from Convex.
 *
 * Base: https://clean-marlin-94.convex.cloud
 * Endpoints: /api/public/{resource}?slug=corsair-tactical
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
  // Square webhook
  "/api/square/webhook",
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

// ── Phase 2 public endpoints ──────────────────────────────────────────────────

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

/* ── GET /api/public/jobs?slug= ─────────────────────────────────────────── */
http.route({
  path: "/api/public/jobs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getJobsBySlug, { slug });
    return ok(data);
  }),
});

/* ── GET /api/public/popup?slug= ────────────────────────────────────────── */
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

/* ── GET /api/public/policy?slug=&type= ─────────────────────────────────── */
http.route({
  path: "/api/public/policy",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const params = new URL(request.url).searchParams;
    const slug = params.get("slug") ?? "";
    const type = params.get("type") ?? undefined;
    if (!slug) return notFound("slug required");
    const data = await ctx.runQuery(internal.public.getPolicyBySlug, { slug, type });
    if (type && !data) return notFound(`Policy type '${type}' not found`);
    return ok(data);
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

      const site = await ctx.runQuery(internal.public.getSiteBySlug, { slug });
      if (!site) return new Response(JSON.stringify({ error: "site not found" }), { status: 404, headers: CORS });

      const config = await ctx.runQuery(internal.square.getConfigInternal, { siteId: site._id });
      if (!config) return new Response(JSON.stringify({ error: "square not configured" }), { status: 400, headers: CORS });

      // Signature validation (HMAC-SHA256 with webhook signature key — use accessToken as fallback for now)
      if (squareSig && config.webhookSignatureKey) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(config.webhookSignatureKey),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(request.url + rawBody));
        const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
        if (squareSig !== expected) {
          return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401, headers: CORS });
        }
      }

      const event = JSON.parse(rawBody) as any;
      const eventType = event.type as string;

      if (eventType === "payment.created" || eventType === "payment.updated") {
        const payment = event.data?.object?.payment;
        if (payment) {
          await ctx.runMutation(internal.squareOrders.upsertOrderFromWebhook, {
            siteId: site._id,
            squareOrderId: payment.order_id ?? payment.id,
            squarePaymentId: payment.id,
            amountCents: payment.amount_money?.amount ?? 0,
            currency: payment.amount_money?.currency,
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

export default http;
