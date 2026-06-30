import { NextResponse } from 'next/server';

interface WaiverPayload {
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  driverLicense?: string;
  course?: string;
  instructor?: string;
  acknowledgments?: Record<string, boolean>;
  typedSignature?: string;
  signatureDate?: string;
  drawnSignature?: string;
  submittedAt?: string;
}

export async function POST(request: Request) {
  let body: WaiverPayload;
  try {
    body = (await request.json()) as WaiverPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (RESEND_API_KEY) {
    const {
      fullName = '—',
      email,
      phone = '—',
      dob = '—',
      address = '—',
      city = '—',
      state = '—',
      zip = '—',
      emergencyContactName = '—',
      emergencyContactPhone = '—',
      driverLicense = '—',
      course = '—',
      instructor = '—',
      typedSignature = '—',
      signatureDate = '—',
      submittedAt,
    } = body;

    const submittedTime = new Date(submittedAt ?? Date.now()).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const adminHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#0a1628;padding:24px;border-radius:12px 12px 0 0"><h2 style="color:#fff;margin:0;font-size:20px">Training Waiver Signed</h2><p style="color:#cbd5e1;margin:4px 0 0;font-size:13px">Corsair Tactical Solutions</p></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:7px 0;font-size:13px;color:#64748b;width:200px;font-weight:600">Full Name</td><td style="padding:7px 0;font-size:14px;color:#0f172a;font-weight:700">${fullName}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Email</td><td style="padding:7px 0;font-size:14px;color:#0f172a"><a href="mailto:${email ?? ''}" style="color:#e53e3e">${email ?? '—'}</a></td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Phone</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${phone}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Date of Birth</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${dob}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Driver&#39;s License</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${driverLicense}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Address</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${address}, ${city}, ${state} ${zip}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Emergency Contact</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${emergencyContactName} · ${emergencyContactPhone}</td></tr><tr><td colspan="2" style="padding:4px 0;border-top:2px solid #e2e8f0"></td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Course / Program</td><td style="padding:7px 0;font-size:14px;color:#0f172a;font-weight:700">${course}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Instructor</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${instructor}</td></tr><tr><td colspan="2" style="padding:4px 0;border-top:2px solid #e2e8f0"></td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Typed Signature</td><td style="padding:7px 0;font-size:14px;color:#0f172a;font-style:italic">${typedSignature}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Signature Date</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${signatureDate}</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#64748b;font-weight:600">Submitted</td><td style="padding:7px 0;font-size:14px;color:#0f172a">${submittedTime} CT</td></tr><tr><td style="padding:7px 0;font-size:13px;color:#16a34a;font-weight:600">All Acknowledgments</td><td style="padding:7px 0;font-size:14px;color:#16a34a;font-weight:700">&#10003; Signed</td></tr></table></div></div>`;

    const studentHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#0a1628;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center"><p style="color:#4ade80;font-size:36px;margin:0 0 8px">&#10003;</p><h2 style="color:#fff;margin:0;font-size:22px">Waiver Received</h2><p style="color:#cbd5e1;margin:8px 0 0;font-size:14px">Corsair Tactical Solutions</p></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px"><p style="font-size:15px;color:#0f172a;margin:0 0 16px">Hi ${fullName},</p><p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.6">Your training waiver for <strong>${course}</strong> has been received and is on file with Corsair Tactical Solutions.</p><div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:150px;font-weight:600">Course</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:700">${course}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Instructor</td><td style="padding:6px 0;font-size:14px;color:#0f172a">${instructor}</td></tr><tr><td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600">Signed</td><td style="padding:6px 0;font-size:14px;color:#0f172a">${signatureDate}</td></tr></table></div><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px"><p style="font-size:13px;font-weight:700;color:#1e40af;margin:0 0 6px">Next Steps</p><p style="font-size:13px;color:#1d4ed8;margin:0;line-height:1.6">If you haven&#39;t already, complete your course registration at <a href="https://corsairtacticalsolution.com/courses" style="color:#e53e3e;font-weight:600">corsairtacticalsolution.com/courses</a>. Steve will follow up to confirm your training date.</p></div><p style="font-size:13px;color:#64748b;margin:0 0 4px">Questions? We&#39;re here to help:</p><p style="font-size:14px;color:#0f172a;margin:0"><strong>Email:</strong> corsairtacticalsolutions@gmail.com &nbsp;|&nbsp; <strong>Call/Text:</strong> 214-335-6652</p></div></div>`;

    const emailJobs: Promise<unknown>[] = [
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Corsair Tactical Solutions <contact@corsairtacticalsolution.com>',
          to: ['corsairtacticalsolutions@gmail.com'],
          ...(email ? { reply_to: email } : {}),
          subject: `Waiver Signed — ${fullName} (${course})`,
          html: adminHtml,
        }),
      }).catch((e: unknown) => console.error('[waiver] admin email:', e)),
    ];

    if (email) {
      emailJobs.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Corsair Tactical Solutions <contact@corsairtacticalsolution.com>',
            to: [email],
            reply_to: 'corsairtacticalsolutions@gmail.com',
            subject: `Waiver Received — ${course} | Corsair Tactical Solutions`,
            html: studentHtml,
          }),
        }).catch((e: unknown) => console.error('[waiver] student email:', e))
      );
    }

    await Promise.all(emailJobs);
  }

  return NextResponse.json({ success: true });
}
