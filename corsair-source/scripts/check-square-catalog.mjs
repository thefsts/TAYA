#!/usr/bin/env node
/**
 * Compares the website catalog against the Square Catalog.
 * Calls the admin-guarded /api/square/catalog-check route on the running app.
 *
 * Usage:
 *   SQUARE_ADMIN_TOKEN=... [SQUARE_API_BASE=https://corsair-tactical-solutions.vercel.app] npm run square:check
 *
 * Base URL resolution: SQUARE_API_BASE → NEXT_PUBLIC_SITE_URL → http://localhost:3000
 */

const base = (
  process.env.SQUARE_API_BASE ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const adminToken = process.env.SQUARE_ADMIN_TOKEN ?? '';

try {
  const res = await fetch(`${base}/api/square/catalog-check`, {
    headers: { 'x-admin-token': adminToken },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Request failed (${res.status}):`, data.error ?? data);
    process.exit(1);
  }

  console.log(`\nCatalog check — environment: ${data.environment}`);
  console.log(`Square items found: ${data.squareItemCount}`);
  console.log(`\n  Matched:              ${data.matched.length}`);
  console.log(`  Missing in Square:    ${data.missingInSquare.length}`);
  console.log(`  Price mismatches:     ${data.priceMismatches.length}`);
  console.log(`  Required fee issues:  ${data.feeMismatches.length}`);
  console.log(`  Optional add-on issues: ${data.addonMismatches.length}`);
  console.log(`  Duplicates:           ${data.duplicatesInSquare.length}`);
  console.log(`  Inactive in Square:   ${data.inactiveInSquare.length}`);

  if (data.missingInSquare.length) {
    console.log('\n  Missing in Square:');
    for (const m of data.missingInSquare) console.log(`    - ${m.name} (${m.slug})`);
  }

  if (data.priceMismatches.length) {
    console.log('\n  Base price mismatches (website vs Square, cents):');
    for (const p of data.priceMismatches) {
      console.log(`    - ${p.name} / ${p.variation}: website=${p.websiteCents}¢ vs square=${p.squareCents ?? 'missing'}¢`);
    }
  }

  if (data.feeMismatches.length) {
    console.log('\n  Required fee mismatches:');
    for (const f of data.feeMismatches) {
      const squarePart = f.squareCents !== null ? `square=${f.squareCents}¢` : 'missing in Square';
      console.log(`    - [${f.slug}] ${f.feeLabel}: website=${f.websiteCents}¢, ${squarePart} (${f.status})`);
    }
  }

  if (data.addonMismatches.length) {
    console.log('\n  Optional add-on mismatches:');
    for (const a of data.addonMismatches) {
      const squarePart = a.squareCents !== null ? `square=${a.squareCents}¢` : 'missing in Square';
      console.log(`    - [${a.slug}] ${a.feeLabel}: website=${a.websiteCents}¢, ${squarePart} (${a.status})`);
    }
  }

  const totalIssues =
    data.missingInSquare.length +
    data.priceMismatches.length +
    data.feeMismatches.length +
    data.addonMismatches.length;

  if (totalIssues === 0) {
    console.log('\n  ✓ All matched — website and Square catalogs are in sync.');
  } else {
    console.log(`\n  ⚠  ${totalIssues} issue(s) found. Website catalog is the source of truth;`);
    console.log('     update the Square catalog to match, then re-run to verify.');
  }
  console.log('');
} catch (err) {
  console.error('Request failed:', err instanceof Error ? err.message : err);
  console.error('Is the app running and reachable at', base, '?');
  process.exit(1);
}
