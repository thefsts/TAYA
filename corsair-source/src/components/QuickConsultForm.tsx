'use client';

import { useState } from 'react';

const SERVICE_OPTIONS = [
  'Church Security — Armed Officers',
  'Church Security — Unarmed Officers',
  'Church Security — Volunteer Training',
  'Church Security Assessment (Free)',
  'Business Security Services',
  'Event Security',
  'Executive Protection',
  'Property / HOA Security',
  '4D Protection Model Consulting',
  'Security Training — Level II/III/IV',
  'Texas License to Carry (LTC)',
  'Other / General Inquiry',
];

interface QuickConsultFormProps {
  defaultService?: string;
  heading?:        string;
  subheading?:     string;
  darkBg?:         boolean;
}

export default function QuickConsultForm({
  defaultService = '',
  heading        = 'Request a Free Consultation',
  subheading     = "Tell us about your security needs and we'll respond within one business day.",
  darkBg         = false,
}: QuickConsultFormProps) {
  const [fields, setFields] = useState({
    name:    '',
    email:   '',
    phone:   '',
    service: defaultService,
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:    fields.name,
          email:   fields.email,
          phone:   fields.phone,
          course:  fields.service,
          message: fields.message || `Service inquiry: ${fields.service}`,
        }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const labelCls  = darkBg ? 'text-white/70' : 'text-corsair-gray-700';
  const inputCls  = `w-full rounded-xl border px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
    darkBg
      ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:ring-corsair-red-500 focus:border-corsair-red-500'
      : 'bg-white border-corsair-gray-200 text-corsair-blue-950 placeholder-corsair-gray-400 focus:ring-corsair-red-500 focus:border-corsair-red-500'
  }`;

  if (status === 'sent') {
    return (
      <div className={`rounded-2xl p-8 text-center ${darkBg ? 'bg-white/10 border border-white/20' : 'bg-corsair-gray-50 border border-corsair-gray-200'}`}>
        <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className={`text-xl font-black mb-2 ${darkBg ? 'text-white' : 'text-corsair-blue-900'}`}>Request Received!</h3>
        <p className={darkBg ? 'text-white/70' : 'text-corsair-gray-600'}>
          We'll reach out within one business day. You can also call us directly at{' '}
          <a href="tel:+12143356652" className="font-bold text-corsair-red-500">214-335-6652</a>.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-6 md:p-8 ${darkBg ? 'bg-white/8 border border-white/15' : 'bg-corsair-gray-50 border border-corsair-gray-200 shadow-sm'}`}>
      <div className="mb-6">
        <h3 className={`text-xl font-black mb-1 ${darkBg ? 'text-white' : 'text-corsair-blue-900'}`}>{heading}</h3>
        <p className={`text-sm ${darkBg ? 'text-white/60' : 'text-corsair-gray-500'}`}>{subheading}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${labelCls}`}>Full Name *</label>
            <input required value={fields.name} onChange={set('name')} type="text" placeholder="Your name" className={inputCls} />
          </div>
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${labelCls}`}>Email *</label>
            <input required value={fields.email} onChange={set('email')} type="email" placeholder="your@email.com" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${labelCls}`}>Phone</label>
            <input value={fields.phone} onChange={set('phone')} type="tel" placeholder="(214) 000-0000" className={inputCls} />
          </div>
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${labelCls}`}>Service of Interest</label>
            <select value={fields.service} onChange={set('service')} className={inputCls}>
              <option value="">Select a service…</option>
              {SERVICE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${labelCls}`}>Message</label>
          <textarea
            value={fields.message} onChange={set('message')} rows={3}
            placeholder="Tell us about your location, congregation size, upcoming event, or any specific concerns…"
            className={`${inputCls} resize-none`}
          />
        </div>
        {status === 'error' && (
          <p className="text-corsair-red-500 text-sm">Something went wrong. Please call us at 214-335-6652 or try again.</p>
        )}
        <button
          type="submit" disabled={status === 'sending'}
          className="w-full bg-corsair-red-500 hover:bg-corsair-red-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          style={{ boxShadow: '0 6px 20px rgba(239,68,68,.35)' }}
        >
          {status === 'sending' ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Sending…
            </>
          ) : 'Send Request'}
        </button>
        <p className={`text-xs text-center ${darkBg ? 'text-white/40' : 'text-corsair-gray-400'}`}>
          No obligation. We respond within 1 business day.
        </p>
      </form>
    </div>
  );
}
