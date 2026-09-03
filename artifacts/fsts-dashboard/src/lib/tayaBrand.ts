/**
 * TAYA brand helpers — single source of truth for TAYA product identity used
 * across the dashboard shell, auth screens, and Clerk appearance.
 *
 * FSTS (Full Stack Tech & Solutions LLC) remains the legal owner / company /
 * administrator and may appear in those contexts. The interactive product UI
 * presents TAYA branding instead of the retired WOS/FSTS product chrome.
 *
 * Logo palette (must stay in sync with `src/index.css` --taya-* tokens):
 *   hot pink -> magenta -> violet -> electric blue -> cyan -> orange -> yellow
 */

/** Absolute (base-path-aware) URL to the TAYA logo SVG in /public. */
export const tayaLogoUrl: string = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/taya-logo.svg`;

/** TAYA short tagline. */
export const TAYA_TAGLINE = "Tools. Automation. Your Advantage.";

/** TAYA product name. */
export const TAYA_PRODUCT_NAME = "TAYA";

/** Legal owner shown in admin/footer/legal contexts only. */
export const TAYA_OWNER_NAME = "Full Stack Tech & Solutions LLC";
