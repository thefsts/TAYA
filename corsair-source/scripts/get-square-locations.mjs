#!/usr/bin/env node
/**
 * Lists Square locations for the configured account/environment.
 * Usage: SQUARE_ACCESS_TOKEN=... [SQUARE_ENVIRONMENT=sandbox] npm run square:locations
 * The access token is read from the environment and never printed.
 */

const env = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
const base =
  env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

const token = process.env.SQUARE_ACCESS_TOKEN;
if (!token) {
  console.error('Error: SQUARE_ACCESS_TOKEN is not set.');
  process.exit(1);
}

try {
  const res = await fetch(`${base}/v2/locations`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-11-20',
    },
  });
  const data = await res.json();
  if (!res.ok || (data.errors && data.errors.length)) {
    console.error('Square error:', data.errors?.[0]?.detail ?? res.status);
    process.exit(1);
  }
  const locations = data.locations ?? [];
  console.log(`\nSquare locations (${env}):`);
  if (!locations.length) {
    console.log('  (none found)');
  }
  for (const loc of locations) {
    console.log(`  • ${loc.name}  id=${loc.id}  status=${loc.status ?? '?'}`);
  }
  console.log('\nSet SQUARE_LOCATION_ID / NEXT_PUBLIC_SQUARE_LOCATION_ID to the id you want to use.\n');
} catch (err) {
  console.error('Request failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
