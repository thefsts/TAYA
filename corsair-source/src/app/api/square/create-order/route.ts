import { NextResponse } from 'next/server';
import { resolveCoursePayment, getCatalogItemBySlug, isPayable } from '@/lib/pricing';
import {
  squareFetch,
  isSquareConfigured,
  newIdempotencyKey,
} from '@/lib/square';

/**
 * Creates an itemized Square Order. Amounts are resolved server-side from the
 * trusted catalog — the client only sends slug, pricingOptionId, and optional
 * add-on ids.
 *
 * Line items:
 *   1. Base course option
 *   2. Required locked fees (range fee etc.) — always included
 *   3. Selected optional add-ons — only valid catalog ids
 */
export async function POST(request: Request) {
  if (!isSquareConfigured()) {
    return NextResponse.json(
      { error: 'Payment service is not configured. Please contact us directly.' },
      { status: 503 }
    );
  }

  const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { courseSlug, pricingOptionId, addOnIds = [], idempotencyKey } = body as {
    courseSlug?: string;
    pricingOptionId?: string;
    addOnIds?: unknown;
    idempotencyKey?: string;
  };

  if (!courseSlug || !pricingOptionId) {
    return NextResponse.json(
      { error: 'Missing required fields: courseSlug, pricingOptionId' },
      { status: 400 }
    );
  }

  if (courseSlug === 'online-texas-ltc-assessment') {
    return NextResponse.json(
      { error: 'This course is completed through Texas Carry Academy. Please visit https://texascarryacademy.com/product/?add-to-cart=69884 to begin your online assessment.' },
      { status: 400 }
    );
  }

  const catalogItem = getCatalogItemBySlug(courseSlug);
  if (!catalogItem) {
    return NextResponse.json(
      { error: `Course "${courseSlug}" was not found in the catalog.`, code: 'UNKNOWN_COURSE_SLUG' },
      { status: 400 }
    );
  }

  if (!isPayable(courseSlug)) {
    return NextResponse.json(
      { error: 'This course is not available for online payment. Please contact us to register.', code: 'COURSE_NOT_PAYABLE' },
      { status: 400 }
    );
  }

  const resolved = resolveCoursePayment(courseSlug, pricingOptionId, addOnIds);
  if (!resolved) {
    return NextResponse.json(
      { error: 'This item is not available for online ordering.' },
      { status: 400 }
    );
  }

  if (resolved.totalCents <= 0 || resolved.lineItems.length < 1) {
    return NextResponse.json(
      { error: 'Order total is invalid. Please contact us directly.' },
      { status: 400 }
    );
  }

  const { course, totalCents, lineItems } = resolved;

  const orderPayload = {
    idempotency_key:
      (typeof idempotencyKey === 'string' && idempotencyKey) || newIdempotencyKey(),
    order: {
      location_id: SQUARE_LOCATION_ID,
      reference_id: courseSlug.slice(0, 40),
      line_items: lineItems.map((li) => ({
        name: li.name,
        quantity: String(li.quantity),
        base_price_money: { amount: li.priceCents, currency: 'USD' },
        note:
          li.kind === 'course'
            ? `slug:${courseSlug} | category:${course.category}`
            : li.kind === 'fee'
            ? 'required-fee'
            : 'optional-addon',
      })),
      metadata: {
        item_type: 'course',
        course_slug: courseSlug,
        category: course.category,
        source: 'corsair_website',
      },
    },
  };

  try {
    const res = await squareFetch('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });
    const data = (await res.json()) as {
      order?: { id: string; total_money?: { amount?: number } };
      errors?: Array<{ detail?: string }>;
    };
    if (!res.ok || data.errors?.length) {
      const detail = data.errors?.[0]?.detail ?? 'Could not create order. Please try again.';
      return NextResponse.json({ error: detail }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      orderId: data.order?.id ?? null,
      totalCents,
      courseName: course.title,
    });
  } catch (err) {
    console.error('[Square] Order API error:', err);
    return NextResponse.json(
      { error: 'Order service unavailable. Please try again.' },
      { status: 502 }
    );
  }
}
