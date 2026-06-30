import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/pricing';
import {
  compareCatalog,
  isAdminAuthorized,
  isSquareConfigured,
  listCatalogItems,
} from '@/lib/square';

/**
 * Compares the website catalog against the Square Catalog and reports
 * matched / missing / price-mismatch / duplicate / inactive items.
 * Admin-guarded: requires x-admin-token matching SQUARE_ADMIN_TOKEN
 * (allowed without a token only outside production).
 */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSquareConfigured()) {
    return NextResponse.json({ error: 'Square is not configured' }, { status: 503 });
  }

  try {
    const squareItems = await listCatalogItems();
    const comparison = compareCatalog(getCatalog(), squareItems);
    return NextResponse.json({
      environment: process.env.SQUARE_ENVIRONMENT ?? 'sandbox',
      squareItemCount: squareItems.length,
      ...comparison,
    });
  } catch (err) {
    console.error('[Square] Catalog check error:', err);
    return NextResponse.json({ error: 'Catalog check failed' }, { status: 502 });
  }
}
