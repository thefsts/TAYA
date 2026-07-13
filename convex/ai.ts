import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const SYSTEM_PROMPT = `You are the FSTS AI Dashboard Assistant™ — an expert website management coach embedded inside the FSTS Website Operating System™ (FSTS-WOS™) client dashboard.

Your role is to help website owners manage their content confidently, improve their site's quality, and solve problems without needing technical expertise.

You can help with:
- Content editing guidance (what to write, how to structure it)
- SEO best practices (titles, descriptions, keywords, meta tags)
- Accessibility tips (alt text, contrast, headings, keyboard navigation)
- Image advice (sizing, optimization, WebP benefits, alt text writing)
- Form troubleshooting and configuration
- Square Payments integration guidance
- Email delivery setup
- FAQ and testimonial management
- Analytics and performance interpretation

STRICT GUARDRAILS — you must NEVER:
- Provide code, HTML, CSS, or any developer instructions
- Suggest changes to site layouts, templates, themes, or design systems
- Recommend accessing server settings, hosting configuration, or DNS
- Expose any internal system architecture or developer-level settings
- Discuss pricing, billing, or account management

TONE: Friendly, clear, encouraging. Non-technical. Use plain language. Be concise but thorough.

When you don't know something specific about the client's site, offer general best-practice advice and remind them they can contact their FSTS support team for site-specific technical questions.`;

export const chat = action({
  args: {
    siteId: v.id("sites"),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    section: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, messages, section }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");

    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error("AI service not configured");
    }

    const sectionContext = section
      ? `\n\nThe user is currently viewing the "${section}" section of their dashboard.`
      : "";

    const systemMessage = {
      role: "system",
      content: SYSTEM_PROMPT + sectionContext,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        max_completion_tokens: 1024,
        messages: [systemMessage, ...messages],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI API error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response. Please try again.";
    return { content };
  },
});

export const generateAltText = action({
  args: {
    siteId: v.id("sites"),
    imageUrl: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, imageUrl, context }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");

    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error("AI service not configured");
    }

    const contextHint = context ? ` The image is used for: ${context}.` : "";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        max_completion_tokens: 150,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Write a concise, descriptive alt text for this image (max 125 characters, no quotes, no "image of" prefix).${contextHint}`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI API error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    const altText = (data.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    return { altText };
  },
});

export const generateMetaDescription = action({
  args: {
    siteId: v.id("sites"),
    pageTitle: v.string(),
    pageContent: v.string(),
  },
  handler: async (ctx, { siteId, pageTitle, pageContent }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");

    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error("AI service not configured");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        max_completion_tokens: 200,
        messages: [
          {
            role: "system",
            content: "You write SEO meta descriptions. Output only the description — no quotes, no labels. Keep it between 140-160 characters.",
          },
          {
            role: "user",
            content: `Page title: "${pageTitle}"\n\nPage content excerpt: "${pageContent.slice(0, 500)}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI API error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    const description = (data.choices?.[0]?.message?.content ?? "").trim();
    return { description };
  },
});
