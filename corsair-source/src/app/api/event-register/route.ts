import { NextResponse } from 'next/server';
import {
  SQUARE_BASE_URL,
  SQUARE_VERSION,
  isSquareConfigured,
  newIdempotencyKey,
} from '@/lib/square';

const EVENT_REGISTRY: Record<string, {
  name: string;
  priceCents: number;
  date: string;
  time: string;
  classroomLocation: string;
  rangeLocation: string;
  whatToBring: string[];
}> = {
  'texas-ltc-certification-class-jun2026': {
    name: 'Texas LTC Certification Class',
    priceCents: 10000,
    date: 'June 13, 2026',
    time: '8:30 AM – 3:30 PM CT',
    classroomLocation: 'Hilton Garden Inn Dallas/Addison, 4090 Belt Line Rd, Addison, TX 75001',
    rangeLocation: 'Eagle Gun Range, 14400 Midway Rd, Farmers Branch, TX 75244',
    whatToBring: [
      'Valid Government Photo ID',
      'Handgun and 50 rounds of ammunition',
      'Eye and ear protection',
      'Comfortable clothing and closed-toe shoes',
      'Pen and notebook',
    ],
  },
  'texas-ltc-certification-class-jul2026': {
    name: 'Texas LTC Certification Class',
    priceCents: 10000,
    date: 'July 25, 2026',
    time: '8:30 AM – 3:30 PM CT',
    classroomLocation: 'Hilton Garden Inn Dallas/Addison, 4090 Belt Line Rd, Addison, TX 75001',
    rangeLocation: 'Eagle Gun Range, 13301 Midway Rd, Farmers Branch, TX 75244',
    whatToBring: [
      'Valid Government Photo ID',
      'Handgun (if not renting)',
      'Eye and Ear Protection',
      'Comfortable Clothing',
      'Pen & Notebook',
      '50 Rounds of Ammunition (if not purchasing through registration)',
    ],
  },
  'level-iii-iv-security-training-jul2026': {
    name: 'Level III & IV Security Officer Training',
    priceCents: 40000,
    date: 'July 6–10, 2026',
    time: 'Flexible Schedule · In-Person Training',
    classroomLocation: 'Hilton Garden Inn Dallas/Addison, 4090 Belt Line Rd, Addison, TX 75001',
    rangeLocation: 'Eagle Gun Range, 13301 Midway Rd, Farmers Branch, TX 75244',
    whatToBring: [
      'Valid Government Photo ID',
      'Duty Handgun, Belt, and Holster',
      '250 Rounds of Ammunition',
      'Eye and Ear Protection',
      'Note-taking Materials',
      'MMPI Documentation (if required)',
    ],
  },
};

const EVENT_ADDONS: Record<string, Record<string, { name: string; priceCents: number }>> = {
  'texas-ltc-certification-class-jul2026': {
    'ammo50':         { name: '50 Rounds of Handgun Ammunition', priceCents: 3000 },
    'handgun-rental': { name: 'Handgun Rental',                   priceCents: 2000 },
  },
};

export async function POST(request: Request) {
  if (!isSquareConfigured()) {
    return NextResponse.json(
      { error: 'Payment service is not configured. Please contact us directly at 214-335-6652.' },
      { status: 503 }
    );
  }

  const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
  const SQUARE_LOCATION_ID  = process.env.SQUARE_LOCATION_ID!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sourceId, eventSlug, firstName, lastName, email, phone, addOnIds } = body as {
    sourceId?: string;
    eventSlug?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    addOnIds?: unknown;
  };

  if (!sourceId || !eventSlug) {
    return NextResponse.json({ error: 'Missing required fields: sourceId, eventSlug' }, { status: 400 });
  }

  const event = EVENT_REGISTRY[eventSlug];
  if (!event) {
    return NextResponse.json({ error: 'This event is not available for online registration.' }, { status: 400 });
  }

  const validAddOns = EVENT_ADDONS[eventSlug] ?? {};
  const requestedIds: string[] = Array.isArray(addOnIds)
    ? (addOnIds as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  const selectedAddOns = requestedIds
    .filter((id) => validAddOns[id])
    .map((id) => ({ id, ...validAddOns[id] }));
  const addOnTotal = selectedAddOns.reduce((s, a) => s + a.priceCents, 0);
  const totalCents = event.priceCents + addOnTotal;

  const SEAT_LIMITS: Record<string, number> = {
    'texas-ltc-certification-class-jun2026': 20,
    'texas-ltc-certification-class-jul2026': 20,
    'level-iii-iv-security-training-jul2026': 20,
  };
  const maxSeats = SEAT_LIMITS[eventSlug];
  if (maxSeats !== undefined) {
    const seatsRes = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.corsairtacticalsolution.com'}/api/seats?slug=${eventSlug}`,
      { cache: 'no-store' }
    );
    if (seatsRes.ok) {
      const seatsData = (await seatsRes.json()) as { isFull?: boolean };
      if (seatsData.isFull) {
        return NextResponse.json(
          { error: 'This class is full. Please contact us at 214-335-6652 to join the waitlist.' },
          { status: 409 }
        );
      }
    }
  }

  const squarePayload = {
    idempotency_key: newIdempotencyKey(),
    source_id: sourceId,
    amount_money: { amount: totalCents, currency: 'USD' },
    location_id: SQUARE_LOCATION_ID,
    reference_id: eventSlug.slice(0, 40),
    note: `Corsair Tactical Solutions — ${event.name}`,
    buyer_email_address: email,
    metadata: {
      item_type: 'event',
      event_slug: eventSlug,
      event_name: event.name,
      attendee_name: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
      attendee_email: email ?? '',
      attendee_phone: phone ?? '',
      add_ons: selectedAddOns.map((a) => a.name).join(', ') || 'none',
      source: 'corsair_website',
    },
  };

  try {
    const squareRes = await fetch(`${SQUARE_BASE_URL}/v2/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': SQUARE_VERSION,
      },
      body: JSON.stringify(squarePayload),
    });

    const data = (await squareRes.json()) as {
      payment?: { id: string; receipt_url?: string };
      errors?: Array<{ detail?: string; code?: string }>;
    };

    if (!squareRes.ok || data.errors?.length) {
      const detail = data.errors?.[0]?.detail ?? 'Payment was declined. Please try again.';
      return NextResponse.json({ error: detail }, { status: 400 });
    }

    const payment     = data.payment!;
    const paymentId   = payment.id;
    const totalDollars = (totalCents / 100).toFixed(2);

    {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        const registrationTime = new Date().toLocaleString('en-US', {
          timeZone: 'America/Chicago', dateStyle: 'long', timeStyle: 'short',
        });
        const attendeeName = `${firstName ?? ''} ${lastName ?? ''}`.trim() || '—';

        const addOnRowsAdmin = selectedAddOns.length > 0
          ? selectedAddOns.map((a) =>
              `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;padding-left:16px">${a.name}</td><td style="padding:4px 0;font-size:13px;color:#0f172a;text-align:right">$${(a.priceCents / 100).toFixed(2)}</td></tr>`
            ).join('')
          : '';
        const totalRowAdmin = selectedAddOns.length > 0
          ? `<tr><td colspan="2" style="padding:4px 0;border-top:1px solid #e2e8f0"></td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Total Paid</td><td style="padding:8px 0;font-size:16px;color:#0f172a;font-weight:800;text-align:right">$${totalDollars}</td></tr>`
          : `<tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Total Paid</td><td style="padding:8px 0;font-size:16px;color:#0f172a;font-weight:800">$${totalDollars}</td></tr>`;

        const adminHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#0a1628;padding:24px;border-radius:12px 12px 0 0"><h2 style="color:#fff;margin:0;font-size:20px">New Event Registration</h2><p style="color:#cbd5e1;margin:4px 0 0;font-size:13px">Corsair Tactical Solutions</p></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:180px;font-weight:600">Attendee Name</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${attendeeName}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Email</td><td style="padding:8px 0;font-size:14px;color:#0f172a"><a href="mailto:${email ?? ''}" style="color:#e53e3e">${email ?? '—'}</a></td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Phone</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${phone ?? '—'}</td></tr><tr><td colspan="2" style="padding:4px 0;border-top:1px solid #e2e8f0"></td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Event</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:700">${event.name}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Date</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${event.date}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Time</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${event.time}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Classroom</td><td style="padding:8px 0;font-size:13px;color:#0f172a">${event.classroomLocation}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Range</td><td style="padding:8px 0;font-size:13px;color:#0f172a">${event.rangeLocation}</td></tr><tr><td colspan="2" style="padding:4px 0;border-top:1px solid #e2e8f0"></td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Registration</td><td style="padding:8px 0;font-size:14px;color:#0f172a">$${(event.priceCents / 100).toFixed(2)}</td></tr>${addOnRowsAdmin}${totalRowAdmin}<tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Square Payment ID</td><td style="padding:8px 0;font-size:12px;color:#0f172a;font-family:monospace">${paymentId}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Registration Time</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${registrationTime} CT</td></tr></table></div></div>`;

        const bringList = event.whatToBring.map((item) => `<li style="margin-bottom:4px">${item}</li>`).join('');
        const addOnRowsStudent = selectedAddOns.length > 0
          ? `<tr><td colspan="2" style="padding:2px 0;"><hr style="border:none;border-top:1px solid #e2e8f0"/></td></tr>${
              selectedAddOns.map((a) =>
                `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;padding-left:12px">${a.name}</td><td style="padding:4px 0;font-size:12px;color:#475569">+$${(a.priceCents / 100).toFixed(2)}</td></tr>`
              ).join('')
            }`
          : '';
        const studentHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#0a1628;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center"><p style="color:#4ade80;font-size:36px;margin:0 0 8px">✓</p><h2 style="color:#fff;margin:0;font-size:22px">You’re Registered!</h2><p style="color:#cbd5e1;margin:8px 0 0;font-size:14px">Corsair Tactical Solutions</p></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px"><p style="font-size:15px;color:#0f172a;margin:0 0 16px">Hi ${firstName ?? 'there'},</p><p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.6">Your registration for the following event is confirmed:</p><div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:130px;font-weight:600">Event</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:700">${event.name}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Date</td><td style="padding:6px 0;font-size:14px;color:#0f172a">${event.date}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Time</td><td style="padding:6px 0;font-size:14px;color:#0f172a">${event.time}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Classroom</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${event.classroomLocation}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Range</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${event.rangeLocation}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Registration</td><td style="padding:6px 0;font-size:14px;color:#0f172a">$${(event.priceCents / 100).toFixed(2)}</td></tr>${addOnRowsStudent}<tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Total Paid</td><td style="padding:6px 0;font-size:16px;color:#0f172a;font-weight:800">$${totalDollars}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Payment ID</td><td style="padding:6px 0;font-size:12px;color:#64748b;font-family:monospace">${paymentId}</td></tr></table></div><div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin-bottom:20px"><p style="font-size:13px;font-weight:700;color:#92400e;margin:0 0 8px">What to Bring</p><ul style="margin:0;padding-left:20px;font-size:13px;color:#78350f;line-height:1.8">${bringList}</ul></div><div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:20px"><p style="font-size:13px;font-weight:700;color:#92400e;margin:0 0 6px">Cancellation Policy</p><p style="font-size:13px;color:#78350f;margin:0;line-height:1.6">Course registrations are non-refundable. If unable to attend, you will be automatically enrolled in the next available class at no additional charge.</p></div><p style="font-size:13px;color:#64748b;margin:0 0 4px">Questions? We are here to help:</p><p style="font-size:14px;color:#0f172a;margin:0"><strong>Email:</strong> corsairtacticalsolutions@gmail.com &nbsp;|&nbsp; <strong>Call/Text:</strong> 214-335-6652</p></div></div>`;

        const emailJobs: Promise<unknown>[] = [
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Corsair Tactical Solutions <contact@corsairtacticalsolution.com>',
              to: ['corsairtacticalsolutions@gmail.com'],
              reply_to: email ?? undefined,
              subject: `New Event Registration — ${event.name} (${event.date})`,
              html: adminHtml,
            }),
          }).catch((e: unknown) => console.error('[event-register] admin email:', e)),
        ];
        if (email) {
          emailJobs.push(
            fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Corsair Tactical Solutions <contact@corsairtacticalsolution.com>',
                to: [email],
                reply_to: 'corsairtacticalsolutions@gmail.com',
                subject: `You’re Registered — ${event.name} | Corsair Tactical Solutions`,
                html: studentHtml,
              }),
            }).catch((e: unknown) => console.error('[event-register] student email:', e))
          );
        }
        Promise.all(emailJobs).catch((e: unknown) => console.error('[event-register] email batch:', e));
      }
    }

    return NextResponse.json({
      success: true,
      paymentId,
      receiptUrl: payment.receipt_url ?? null,
      eventName: event.name,
      totalCents,
      selectedAddOns: selectedAddOns.map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents })),
    });
  } catch (err) {
    console.error('[Event Register] Square API error:', err);
    return NextResponse.json(
      { error: 'Payment service unavailable. Please try again or call 214-335-6652.' },
      { status: 502 }
    );
  }
}
