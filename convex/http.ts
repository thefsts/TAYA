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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: CORS });
}

function notFound(msg = "Not found") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 404,
    headers: CORS,
  });
}

const http = httpRouter();

/* ── OPTIONS preflight ──────────────────────────────────────────────────── */
const preflight = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS });
});
http.route({ path: "/api/public/homepage", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/footer", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/contact", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/events", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/courses", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/articles", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/seo", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/site", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/media", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/faqs", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/testimonials", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/pricing", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/public/submit", method: "OPTIONS", handler: preflight });

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

export default http;
