import { NextResponse } from 'next/server';
import { resolveCoursePayment } from '@/lib/pricing';
import {
  SQUARE_BASE_URL,
  SQUARE_VERSION,
  isSquareConfigured,
  newIdempotencyKey,
} from '@/lib/square';

export async function POST(request: Request) {
  if (!isSquareConfigured()) {
    return NextResponse.json(
      { error: 'Payment service is not configured. Please contact us directly.' },
      { status: 503 }
    );
  }

  const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
  const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    sourceId,
    courseSlug,
    pricingOptionId,
    addOnIds = [],
    orderId,
    idempotencyKey,
    firstName,
    lastName,
    email,
    phone,
    preferredDate,
    notes,
  } = body as {
    sourceId?: string;
    courseSlug?: string;
    pricingOptionId?: string;
    addOnIds?: unknown;
    orderId?: string;
    idempotencyKey?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    preferredDate?: string;
    notes?: string;
  };

  if (!sourceId || !courseSlug || !pricingOptionId) {
    return NextResponse.json(
      { error: 'Missing required fields: sourceId, courseSlug, pricingOptionId' },
      { status: 400 }
    );
  }

  // ── Server-side price validation — never trust the client ──────────────────
  const resolved = resolveCoursePayment(courseSlug, pricingOptionId, addOnIds);
  if (!resolved) {
    return NextResponse.json(
      { error: 'This item is not available for online payment.' },
      { status: 400 }
    );
  }

  const { course, optionName, totalCents, lineItems } = resolved;
  if (totalCents <= 0) {
    return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
  }

  const iKey = (typeof idempotencyKey === 'string' && idempotencyKey) || newIdempotencyKey();

  // Link payment to the Square Order so the receipt is fully itemized.
  const squareOrderId =
    typeof orderId === 'string' && orderId.trim() ? orderId.trim() : undefined;

  const squarePayload = {
    idempotency_key: iKey,
    source_id: sourceId,
    amount_money: { amount: totalCents, currency: 'USD' },
    location_id: SQUARE_LOCATION_ID,
    ...(squareOrderId ? { order_id: squareOrderId } : {}),
    reference_id: courseSlug.slice(0, 40),
    note: `Corsair Tactical Solutions — ${course.title} | ${optionName}`,
    buyer_email_address: email,
    metadata: {
      item_type: 'course',
      course_slug: courseSlug,
      course_name: course.title,
      category: course.category,
      pricing_option: optionName,
      student_name: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
      student_email: email ?? '',
      student_phone: phone ?? '',
      preferred_date: preferredDate ?? '',
      notes: notes ?? '',
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

    const payment = data.payment!;

    // ── Fire-and-forget email notifications ─────────────────────────────
    {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        const registrationTime = new Date().toLocaleString('en-US', {
          timeZone: 'America/Chicago', dateStyle: 'long', timeStyle: 'short',
        });
        const totalDollars = (totalCents / 100).toFixed(2);
        const studentName = `${firstName ?? ''} ${lastName ?? ''}`.trim() || '—';

        // Itemized line items for email breakdown
        const lineItemsAddonHtml = lineItems
          .map((li) => {
            const d = (li.priceCents / 100).toFixed(2);
            const badge =
              li.kind === 'fee'
                ? ' <span style="background:#ef4444;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase">Required</span>'
                : li.kind === 'addon'
                ? ' <span style="background:#2563eb;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px">Add-On</span>'
                : '';
            return `<tr><td style="padding:3px 0 3px 12px;font-size:12px;color:#475569">${li.name}${badge}</td><td style="padding:3px 0;font-size:12px;color:#0f172a;text-align:right">$${d}</td></tr>`;
          })
          .join('');
        const lineItemsSectionHtml = lineItemsAddonHtml
          ? `<tr><td colspan="2" style="padding:8px 0 3px;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Order Breakdown</td></tr>${lineItemsAddonHtml}<tr><td colspan="2" style="padding:2px 0 6px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0"/></td></tr>`
          : '';

        const adminHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#0a1628;padding:24px;border-radius:12px 12px 0 0"><h2 style="color:#fff;margin:0;font-size:20px">New Course Registration</h2><p style="color:#cbd5e1;margin:4px 0 0;font-size:13px">Corsair Tactical Solutions</p></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:180px;font-weight:600">Student Name</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${studentName}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Email</td><td style="padding:8px 0;font-size:14px;color:#0f172a"><a href="mailto:${email ?? ''}" style="color:#e53e3e">${email ?? '—'}</a></td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Phone</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${phone ?? '—'}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Course</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:700">${course.title}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Option</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${optionName}</td></tr>${lineItemsSectionHtml}<tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Preferred Date</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${preferredDate ?? '—'}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Notes</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${notes ?? '—'}</td></tr><tr><td colspan="2" style="padding:4px 0;border-top:2px solid #e2e8f0"></td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Total Paid</td><td style="padding:8px 0;font-size:16px;color:#0f172a;font-weight:800">$${totalDollars}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Square Payment ID</td><td style="padding:8px 0;font-size:12px;color:#0f172a;font-family:monospace">${payment.id}</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Registration Time</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${registrationTime} CT</td></tr></table></div></div>`;

        const bringList = (course.whatToBring ?? []).map((item: string) => `<li style="margin-bottom:4px">${item}</li>`).join('');
        const studentHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#0a1628;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center"><p style="color:#4ade80;font-size:36px;margin:0 0 8px">✓</p><h2 style="color:#fff;margin:0;font-size:22px">You're Registered!</h2><p style="color:#cbd5e1;margin:8px 0 0;font-size:14px">Corsair Tactical Solutions</p></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px"><p style="font-size:15px;color:#0f172a;margin:0 0 16px">Hi ${firstName ?? 'there'},</p><p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.6">Your registration is confirmed. Here is a summary:</p><div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:150px;font-weight:600">Course</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:700">${course.title}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Option</td><td style="padding:6px 0;font-size:14px;color:#0f172a">${optionName}</td></tr>${preferredDate ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Preferred Date</td><td style="padding:6px 0;font-size:14px;color:#0f172a">${preferredDate}</td></tr>` : ''}${lineItemsSectionHtml}<tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Total Paid</td><td style="padding:6px 0;font-size:16px;color:#0f172a;font-weight:800">$${totalDollars}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Payment ID</td><td style="padding:6px 0;font-size:12px;color:#64748b;font-family:monospace">${payment.id}</td></tr></table></div>${bringList ? `<div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin-bottom:20px"><p style="font-size:13px;font-weight:700;color:#92400e;margin:0 0 8px">What to Bring</p><ul style="margin:0;padding-left:20px;font-size:13px;color:#78350f;line-height:1.8">${bringList}</ul></div>` : ''}<p style="font-size:13px;color:#64748b;margin:0 0 4px">Questions? We are here to help:</p><p style="font-size:14px;color:#0f172a;margin:0"><strong>Email:</strong> corsairtacticalsolutions@gmail.com &nbsp;|&nbsp; <strong>Call/Text:</strong> 214-335-6652</p></div></div>`;

        const emailJobs: Promise<unknown>[] = [
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Corsair Tactical Solutions <contact@corsairtacticalsolution.com>',
              to: ['corsairtacticalsolutions@gmail.com'],
              reply_to: email ?? undefined,
              subject: `New Registration — ${course.title}`,
              html: adminHtml,
            }),
          }).catch((e: unknown) => console.error('[create-payment] admin email:', e)),
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
                subject: `You\u2019re Registered \u2014 ${course.title} | Corsair Tactical Solutions`,
                html: studentHtml,
              }),
            }).catch((e: unknown) => console.error('[create-payment] student email:', e))
          );
        }
        Promise.all(emailJobs).catch((e: unknown) => console.error('[create-payment] email batch:', e));
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      squareOrderId: squareOrderId ?? null,
      receiptUrl: payment.receipt_url ?? null,
      courseName: course.title,
      totalCents,
      lineItems,
    });
  } catch (err) {
    console.error('[Square] Payment API error:', err);
    return NextResponse.json(
      { error: 'Payment service unavailable. Please try again.' },
      { status: 502 }
    );
  }
}
