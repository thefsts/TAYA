"use node";

/**
 * mediaDerivatives.ts — Node.js Convex action for server-side image derivative
 * generation.  Kept in a separate file so the `"use node"` directive does not
 * force the main media.ts queries/mutations into the Node.js runtime.
 *
 * Uses `jimp` (pure JavaScript, no native binaries) so this action runs on
 * any platform including Convex's linux-arm64 runtime.
 *
 * Derivative sizes produced (all JPEG, quality 85):
 *   thumb   150 px wide  — UI grids and thumbnails
 *   small   400 px wide  — small display contexts
 *   medium  800 px wide  — standard content areas
 *   large  1400 px wide  — large display contexts
 *   hero   2400 px wide  — hero / full-bleed slots
 *
 * Note: derivatives are JPEG (not WebP) because jimp's pure-JS runtime does
 * not include a WebP encoder. The original upload is already a WebP blob
 * produced by the browser canvas; derivatives trade a small size premium for
 * broad runtime compatibility.
 *
 * `withoutEnlargement` behaviour: images narrower than a target width are
 * stored at their natural resolution rather than being upscaled.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Jimp, ResizeStrategy } from "jimp";

const DERIVATIVE_SIZES = [
  { field: "thumbStorageId",  width: 150  },
  { field: "smallStorageId",  width: 400  },
  { field: "mediumStorageId", width: 800  },
  { field: "largeStorageId",  width: 1400 },
  { field: "heroStorageId",   width: 2400 },
] as const;

const JPEG_QUALITY = 85;

export const generateDerivatives = internalAction({
  args: { mediaAssetId: v.id("mediaAssets") },
  handler: async (ctx, { mediaAssetId }) => {
    // Fetch the asset record
    const doc = await ctx.runQuery(internal.media.getById, { mediaAssetId });
    if (!doc || !doc.storageId) {
      console.warn(`generateDerivatives: no storageId for ${mediaAssetId} — skipping`);
      return;
    }

    // Fetch the original blob from Convex File Storage
    const originalUrl = await ctx.storage.getUrl(doc.storageId as any);
    if (!originalUrl) {
      console.warn(`generateDerivatives: could not resolve URL for storageId of ${mediaAssetId}`);
      return;
    }

    const fetchRes = await fetch(originalUrl);
    if (!fetchRes.ok) {
      console.warn(`generateDerivatives: fetch failed (${fetchRes.status}) for ${mediaAssetId}`);
      return;
    }
    const originalBuffer = Buffer.from(await fetchRes.arrayBuffer());

    // Load image once; jimp decodes into an internal bitmap
    let image: Awaited<ReturnType<typeof Jimp.read>>;
    try {
      image = await Jimp.read(originalBuffer);
    } catch (err) {
      console.warn(`generateDerivatives: failed to decode image for ${mediaAssetId}:`, err);
      return;
    }

    const naturalWidth = image.width;

    // Generate each derivative and store it
    const results: Record<string, any> = {};

    for (const { field, width } of DERIVATIVE_SIZES) {
      // Skip enlargement: if the image is already smaller than this size, skip
      if (naturalWidth <= width) {
        continue;
      }
      try {
        // Clone the decoded image so each size starts from the original bitmap
        const clone = image.clone();
        // resize with width only; height auto-calculated to maintain aspect ratio
        clone.resize({ w: width, mode: ResizeStrategy.BILINEAR });

        const buffer = await clone.getBuffer("image/jpeg", { quality: JPEG_QUALITY });
        // Copy into a plain ArrayBuffer to satisfy Blob's type constraint
        const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
        const blob = new Blob([ab], { type: "image/jpeg" });
        const storageId = await ctx.storage.store(blob);
        results[field] = storageId;
      } catch (err) {
        // Non-fatal: log and continue with the remaining sizes
        console.warn(`generateDerivatives: failed to generate ${field} for ${mediaAssetId}:`, err);
      }
    }

    // Write all generated storageIds back to the mediaAssets record in one patch
    if (Object.keys(results).length > 0) {
      await ctx.runMutation(internal.media.writeDerivatives, {
        mediaAssetId,
        ...(results as any),
      });
    }
  },
});
