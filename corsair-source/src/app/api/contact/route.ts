import { NextResponse } from 'next/server';
import { submitFormToCms } from '@/lib/cms';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, email, phone, course, message } = body as {
    name?: string;
    email?: string;
    phone?: string;
    course?: string;
    message?: string;
  };

  const INQUIRY_LABELS: Record<string, string> = {
    'security-general':         'General Security Services Inquiry',
    'security-armed':           'Armed Security Services',
    'security-church':          'Church Security Services',
    'security-property':        'Property Management & HOA Security',
    'security-executive':       'Executive Protection',
    'security-investigations':  'Private Investigations',
    'security-corporate':       'Corporate Security Services',
    'security-event':           'Event Security Services',
    'security-assessment':      'Security Assessment / Consultation',
    'training-ltc':             'Texas License to Carry (LTC)',
    'training-security-officer':'Security Officer Training',
    'training-handgun':         'Basic Handgun Training',
    'training-defensive':       'Defensive Shooting',
    'training-ar15':            'AR-15 Rifle Course',
    'training-shotgun':         'Shotgun Course',
    'training-requalification': 'Firearm Proficiency Re-Qualification',
    'training-private':         'Private Instruction',
    'training-firstaid':        'First Aid / Stop the Bleed',
    'training-other':           'Other Training Programs',
  };
  const inquiryLabel = course ? (INQUIRY_LABELS[course] ?? course) : null;

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields: name, email, message' }, { status: 400 });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0a1628;padding:24px;border-radius:12px 12px 0 0">
        <h2 style="color:#fff;margin:0;font-size:20px">New Contact Form Submission</h2>
        <p style="color:#cbd5e1;margin:4px 0 0;font-size:13px">Corsair Tactical Solutions</p>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:140px;font-weight:600">Name</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${name}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Email</td><td style="padding:8px 0;font-size:14px;color:#0f172a"><a href="mailto:${email}" style="color:#e53e3e">${email}</a></td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">Phone</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${phone ?? '—'}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600">How Can We Help You?</td><td style="padding:8px 0;font-size:14px;color:#0f172a">${inquiryLabel ?? '—'}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;vertical-align:top">Message</td><td style="padding:8px 0;font-size:14px;color:#0f172a;white-space:pre-wrap">${message}</td></tr>
        </table>
      </div>
    </div>
  `;

  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Corsair Tactical Solutions <contact@corsairtacticalsolution.com>',
          to: ['corsairtacticalsolutions@gmail.com'],
          reply_to: email,
          subject: `Contact: ${name}${inquiryLabel ? ` — ${inquiryLabel}` : ''}`,
          html: htmlBody,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[Contact] Resend error:', data);
      }
    } catch (err) {
      console.error('[Contact] Email send error:', err);
    }
  } else {
    console.warn('[Contact] RESEND_API_KEY not set — form data logged only');
    console.info('[Contact]', { name, email, phone, course, message: message.slice(0, 100) });
  }

  // Forward submission to the FSTS Dashboard inbox (fire-and-forget)
  void submitFormToCms({
    formType: "contact",
    name,
    email,
    phone,
    message,
    data: { course: course ?? null, inquiryLabel: inquiryLabel ?? null },
  });

  return NextResponse.json({ success: true });
}
