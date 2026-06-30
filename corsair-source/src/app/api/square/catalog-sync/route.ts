import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/pricing';
import {
  compareCatalog,
  createCatalogItem,
  isAdminAuthorized,
  isSquareConfigured,
  listCatalogItems,
} from '@/lib/square';

/**
 * Safely syncs the website catalog into the Square Catalog.
 * - Admin-guarded (x-admin-token == SQUARE_ADMIN_TOKEN).
 * - DRY-RUN by default: only creates items when BOTH the request body
 *   `confirm: true` AND env `CONFIRM_SQUARE_SYNC === 'true'` are set.
 * - Only CREATES missing items; never deletes and never auto-updates prices.
 */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSquareConfigured()) {
    return NextResponse.json({ error: 'Square is not configured' }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — defaults to dry-run.
  }

  const confirmed = body.confirm === true && process.env.CONFIRM_SQUARE_SYNC === 'true';

  try {
    const catalog = getCatalog();
    const squareItems = await listCatalogItems();
    const comparison = compareCatalog(catalog, squareItems);

    const toCreate = comparison.missingInSquare
      .map((m) => catalog.find((c) => c.slug === m.slug))
      .filter((c): c is NonNullable<typeof c> => Boolean(c) && c!.variations.length > 0);

    if (!confirmed) {
      return NextResponse.json({
        dryRun: true,
        message:
          'Dry run only. Set CONFIRM_SQUARE_SYNC=true and send { "confirm": true } to create items.',
        environment: process.env.SQUARE_ENVIRONMENT ?? 'sandbox',
        wouldCreate: toCreate.map((c) => ({ slug: c.slug, name: c.name })),
        priceMismatchesNeedingManualReview: comparison.priceMismatches,
      });
    }

    const created: Array<{ slug: string; squareId: string }> = [];
    const failed: Array<{ slug: string; error: string }> = [];
    for (const item of toCreate) {
      try {
        const result = await createCatalogItem(item);
        created.push({ slug: item.slug, squareId: result.id });
      } catch (e) {
        failed.push({ slug: item.slug, error: e instanceof Error ? e.message : 'unknown' });
      }
    }

    return NextResponse.json({
      dryRun: false,
      environment: process.env.SQUARE_ENVIRONMENT ?? 'sandbox',
      created,
      failed,
      priceMismatchesNeedingManualReview: comparison.priceMismatches,
    });
  } catch (err) {
    console.error('[Square] Catalog sync error:', err);
    return NextResponse.json({ error: 'Catalog sync failed' }, { status: 502 });
  }
}
