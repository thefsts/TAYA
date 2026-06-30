import { NextResponse } from 'next/server';

const SEAT_LIMITS: Record<string, number> = {
  /* Events */
  'texas-ltc-certification-class-jun2026': 20,
  'texas-ltc-certification-class-jul2026': 20,
  /* LTC / Certification courses */
  'texas-license-to-carry':              20,
  'online-texas-ltc-assessment':         30,
  'texas-ltc-wichita':                   20,
  'texas-ltc-certification-basic-handgun': 20,
  'texas-ltc-shooting-proficiency':      20,
  /* Beginner */
  'basic-handgun-skills-training':       15,
  'first-shots-basic-firearm-training':  15,
  'introduction-to-firearms':            15,
  /* Defensive */
  'defensive-shooting-skills':           12,
  'concealed-carry-home-defense':        12,
  /* Security */
  'level-3-armed-security-officer':      10,
  'level-4-bodyguard':                    8,
  'level-3-4-complete-package':           8,
  /* Other */
  'non-lethal-defense-training':         15,
  'firearm-proficiency-requalification': 15,
  'armed-first-responder':               12,
};

async function countSquarePayments(slug: string): Promise<number> {
  const token    = process.env.SQUARE_ACCESS_TOKEN;
  const location = process.env.SQUARE_LOCATION_ID;
  if (!token || !location) return 0;

  const base = process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  let count = 0;
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      location_ids: [location],
      query: {
        filter: {
          source_filter: { source_names: ['corsair_website', 'EXTERNAL'] },
          status_filter: { statuses: ['COMPLETED'] },
        },
      },
      limit: 100,
    };
    if (cursor) body.cursor = cursor;

    const res = await fetch(`${base}/v2/payments/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-11-20',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = (await res.json()) as {
      payments?: Array<{ reference_id?: string; metadata?: Record<string, string> }>;
      cursor?: string;
    };

    for (const p of data.payments ?? []) {
      const ref  = p.reference_id ?? '';
      const meta = p.metadata ?? {};
      if (ref === slug || ref.startsWith(slug.slice(0, 20)) ||
          meta['event_slug'] === slug || meta['course_slug'] === slug) {
        count++;
      }
    }
    cursor = data.cursor;
  } while (cursor);

  return count;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug')?.trim();

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const max = SEAT_LIMITS[slug];
  if (max === undefined) {
    return NextResponse.json({ registered: 0, max: null, available: null, isFull: false });
  }

  const registered = await countSquarePayments(slug);
  const available  = Math.max(0, max - registered);

  return NextResponse.json(
    { registered, max, available, isFull: available === 0 },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } }
  );
}
