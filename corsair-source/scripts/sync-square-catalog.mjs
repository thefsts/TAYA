#!/usr/bin/env node
/**
 * Syncs missing website catalog items into the Square Catalog by calling the
 * admin-guarded /api/square/catalog-sync route on the running app.
 *
 * DRY-RUN by default. To actually create items you must set BOTH:
 *   - server env CONFIRM_SQUARE_SYNC=true (on the app/deployment)
 *   - this script's CONFIRM_SQUARE_SYNC=true (sends { confirm: true })
 *
 * Usage:
 *   SQUARE_ADMIN_TOKEN=... [SQUARE_API_BASE=...] npm run square:sync:sandbox
 *   SQUARE_ADMIN_TOKEN=... CONFIRM_SQUARE_SYNC=true npm run square:sync:sandbox
 */

const base = (
  process.env.SQUARE_API_BASE ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const adminToken = process.env.SQUARE_ADMIN_TOKEN ?? '';
const confirm = process.env.CONFIRM_SQUARE_SYNC === 'true';

try {
  const res = await fetch(`${base}/api/square/catalog-sync`, {
    method: 'POST',
    headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Request failed (${res.status}):`, data.error ?? data);
    process.exit(1);
  }

  if (data.dryRun) {
    console.log(`\n[DRY RUN] environment: ${data.environment}`);
    console.log(data.message);
    console.log(`\n  Would create ${data.wouldCreate.length} item(s):`);
    for (const c of data.wouldCreate) console.log(`    - ${c.name} (${c.slug})`);
    if (data.priceMismatchesNeedingManualReview?.length) {
      console.log('\n  Price mismatches (review manually in Square):');
      for (const p of data.priceMismatchesNeedingManualReview) {
        console.log(`    - ${p.name} / ${p.variation}: ${p.websiteCents} vs ${p.squareCents ?? 'missing'}`);
      }
    }
    console.log('');
  } else {
    console.log(`\n[SYNC] environment: ${data.environment}`);
    console.log(`  Created: ${data.created.length}`);
    for (const c of data.created) console.log(`    + ${c.slug} → ${c.squareId}`);
    if (data.failed?.length) {
      console.log(`  Failed: ${data.failed.length}`);
      for (const f of data.failed) console.log(`    ! ${f.slug}: ${f.error}`);
    }
    console.log('');
  }
} catch (err) {
  console.error('Request failed:', err instanceof Error ? err.message : err);
  console.error('Is the app running and reachable at', base, '?');
  process.exit(1);
}
