import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

function verifySignature(rawBody: string, signature: string, notificationUrl: string): boolean {
  if (!WEBHOOK_SIGNATURE_KEY || !signature) return false;
  // Square HMAC-SHA256: key=signature_key, message=notification_url + raw_body
  const hmac = createHmac('sha256', WEBHOOK_SIGNATURE_KEY);
  hmac.update(notificationUrl + rawBody);
  const expected = Buffer.from(hmac.digest('base64'));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-square-hmacsha256-signature') ?? '';
  const notificationUrl = request.url;

  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.SQUARE_ENVIRONMENT === 'production';

  if (WEBHOOK_SIGNATURE_KEY) {
    if (!verifySignature(rawBody, signature, notificationUrl)) {
      console.warn('[Square Webhook] Invalid signature rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (isProduction) {
    // Fail closed: never accept unauthenticated webhook events in production.
    console.error('[Square Webhook] SQUARE_WEBHOOK_SIGNATURE_KEY not configured in production');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  let event: { type?: string; data?: { id?: string; object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Log only minimal, non-sensitive identifiers — never the full payload.
  const obj = event.data?.object as Record<string, unknown> | undefined;

  switch (event.type) {
    case 'payment.created':
    case 'payment.updated': {
      const payment = obj?.payment as Record<string, unknown> | undefined;
      console.log(
        `[Square Webhook] ${event.type} — payment ${payment?.id ?? '?'} status=${payment?.status ?? '?'}`
      );
      // TODO(db): persist payment + registration once Supabase is added.
      // TODO: email confirmation to student and notify the instructor.
      break;
    }
    case 'order.created':
    case 'order.updated': {
      const order = obj?.order as Record<string, unknown> | undefined;
      console.log(
        `[Square Webhook] ${event.type} — order ${order?.id ?? '?'} state=${order?.state ?? '?'}`
      );
      // TODO(db): persist order + line items once Supabase is added.
      break;
    }
    case 'refund.created':
    case 'refund.updated': {
      const refund = obj?.refund as Record<string, unknown> | undefined;
      console.log(`[Square Webhook] ${event.type} — refund ${refund?.id ?? '?'}`);
      // TODO: notify student + update booking record.
      break;
    }
    default:
      console.log('[Square Webhook] Unhandled event type:', event.type);
  }

  return NextResponse.json({ received: true });
}
