'use client';

import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Square?: any;
  }
}

export interface AddOnOption {
  id: string;
  label: string;
  priceCents: number;
}

interface EventBookingFormProps {
  eventSlug: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  priceCents: number;
  addOns?: AddOnOption[];
}

const SQUARE_SDK_URL: Record<string, string> = {
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
  production: 'https://web.squarecdn.com/v1/square.js',
};

export default function EventBookingForm({
  eventSlug,
  eventTitle,
  eventDate,
  eventTime,
  priceCents,
  addOns,
}: EventBookingFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    driverLicense: '',
  });
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());

  const addOnTotal = addOns
    ? [...selectedAddOns].reduce((sum, id) => {
        const ao = addOns.find((a) => a.id === id);
        return sum + (ao?.priceCents ?? 0);
      }, 0)
    : 0;
  const totalCents   = priceCents + addOnTotal;
  const baseDisplay  = `$${Math.round(priceCents / 100)}`;
  const totalDisplay = `$${Math.round(totalCents / 100)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const squareCardRef = useRef<any>(null);
  const [cardReady, setCardReady] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    paymentId: string;
    receiptUrl: string | null;
    selectedAddOnNames: string[];
  } | null>(null);

  useEffect(() => {
    if (step !== 2) return;

    const env = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT ?? 'production';
    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

    if (!appId || !locationId) {
      setPaymentError('Payment is not configured. Please contact us at 214-335-6652.');
      return;
    }

    const sdkUrl = SQUARE_SDK_URL[env] ?? SQUARE_SDK_URL.sandbox;

    async function initCard(aId: string, lId: string) {
      try {
        const payments = window.Square!.payments(aId, lId);
        const card = await payments.card();
        await card.attach('#event-card-container');
        squareCardRef.current = card;
        setCardReady(true);
      } catch (err) {
        console.error('Square card init error:', err);
        setPaymentError('Failed to load payment widget. Please refresh and try again.');
      }
    }

    if (!window.Square) {
      const script = document.createElement('script');
      script.src = sdkUrl;
      script.async = true;
      script.onload = () => initCard(appId, locationId);
      document.head.appendChild(script);
    } else {
      initCard(appId, locationId);
    }

    return () => {
      if (squareCardRef.current) {
        squareCardRef.current.destroy().catch(() => {});
        squareCardRef.current = null;
        setCardReady(false);
      }
    };
  }, [step]);

  async function handlePayment() {
    if (!squareCardRef.current) return;
    setPaymentError('');
    setIsProcessing(true);

    try {
      const tokenResult = await squareCardRef.current.tokenize();
      if (tokenResult.status !== 'OK') {
        setPaymentError(tokenResult.errors?.[0]?.message ?? 'Card tokenization failed. Please check your card details.');
        setIsProcessing(false);
        return;
      }

      const res = await fetch('/api/event-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          eventSlug,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          driverLicense: formData.driverLicense,
          addOnIds: [...selectedAddOns],
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        paymentId?: string;
        receiptUrl?: string | null;
        selectedAddOns?: Array<{ id: string; name: string; priceCents: number }>;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setPaymentError(data.error ?? 'Payment failed. Please try again or call 214-335-6652.');
        setIsProcessing(false);
        return;
      }

      setResult({
        paymentId: data.paymentId!,
        receiptUrl: data.receiptUrl ?? null,
        selectedAddOnNames: (data.selectedAddOns ?? []).map((a) => a.name),
      });
      setStep(3);
    } catch (err) {
      console.error('Payment error:', err);
      setPaymentError('An unexpected error occurred. Please try again.');
    }
    setIsProcessing(false);
  }

  function toggleAddOn(id: string, checked: boolean) {
    setSelectedAddOns((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /* Step 3: Confirmation */
  if (step === 3 && result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-corsair-blue-900 mb-2">You&apos;re Registered!</h3>
        <p className="text-corsair-gray-600 text-sm mb-1">
          <strong>{formData.firstName} {formData.lastName}</strong> is confirmed for
        </p>
        <p className="text-corsair-gray-800 font-bold text-sm mb-1">{eventTitle}</p>
        <p className="text-corsair-gray-500 text-sm mb-3">{eventDate} · {eventTime}</p>
        {result.selectedAddOnNames.length > 0 && (
          <div className="bg-white border border-green-200 rounded-xl px-4 py-3 mb-3 text-left">
            <p className="text-xs font-bold text-corsair-gray-600 mb-1.5">Add-Ons Included</p>
            {result.selectedAddOnNames.map((name) => (
              <p key={name} className="text-xs text-corsair-gray-700 flex items-center gap-1.5">
                <span className="text-green-500">✓</span> {name}
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-corsair-gray-400 mb-5">
          Total: <strong>{totalDisplay}</strong>. Confirmation sent to <strong>{formData.email}</strong>.
          <br />Payment ID: {result.paymentId}
        </p>
        {result.receiptUrl && (
          <a
            href={result.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-corsair-blue-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-corsair-blue-800 transition-colors"
          >
            View Receipt ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-corsair-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-corsair-blue-900 px-6 py-5">
        <p className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest">Register Now</p>
        <h3 className="text-lg font-black text-white mt-0.5 leading-snug">{eventTitle}</h3>
        <p className="text-sm text-corsair-gray-300 mt-0.5">{eventDate} · {eventTime}</p>
      </div>

      <div className="flex border-b border-corsair-gray-100">
        {(['Your Info', 'Payment'] as const).map((label, i) => (
          <div
            key={label}
            className={`flex-1 text-center py-2.5 text-xs font-bold transition-colors ${
              step === i + 1
                ? 'text-corsair-red-500 border-b-2 border-corsair-red-500'
                : step > i + 1
                ? 'text-green-600'
                : 'text-corsair-gray-400'
            }`}
          >
            {step > i + 1 ? '✓ ' : ''}{label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <form
          className="p-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); setStep(2); }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-corsair-gray-700 mb-1">First Name *</label>
              <input required type="text" value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full border border-corsair-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500"
                placeholder="Jane" />
            </div>
            <div>
              <label className="block text-xs font-bold text-corsair-gray-700 mb-1">Last Name *</label>
              <input required type="text" value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full border border-corsair-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500"
                placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-corsair-gray-700 mb-1">Email Address *</label>
            <input required type="email" value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-corsair-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500"
              placeholder="jane@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold text-corsair-gray-700 mb-1">Phone Number</label>
            <input type="tel" value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-corsair-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500"
              placeholder="(214) 555-0123" />
          </div>
          <div>
            <label className="block text-xs font-bold text-corsair-gray-700 mb-1">Driver&apos;s License Number *</label>
            <input required type="text" value={formData.driverLicense}
              onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
              className="w-full border border-corsair-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500"
              placeholder="TX DL number" />
          </div>

          {addOns && addOns.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-corsair-gray-700 mb-2">Optional Add-Ons</label>
              <div className="space-y-2">
                {addOns.map((ao) => (
                  <label key={ao.id}
                    className="flex items-center gap-3 cursor-pointer p-3 border border-corsair-gray-200 rounded-lg hover:border-corsair-red-300 hover:bg-red-50/30 transition-colors">
                    <input type="checkbox" checked={selectedAddOns.has(ao.id)}
                      onChange={(e) => toggleAddOn(ao.id, e.target.checked)}
                      className="w-4 h-4 accent-corsair-red-500 rounded flex-shrink-0" />
                    <span className="flex-1 text-sm text-corsair-gray-700">{ao.label}</span>
                    <span className="text-sm font-bold text-corsair-blue-900">+${Math.round(ao.priceCents / 100)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-corsair-gray-700">Registration Fee</p>
              <span className="text-sm font-bold text-corsair-blue-900">{baseDisplay}</span>
            </div>
            {addOns && selectedAddOns.size > 0 && (
              <>
                {addOns.filter((ao) => selectedAddOns.has(ao.id)).map((ao) => (
                  <div key={ao.id} className="flex items-center justify-between mt-1">
                    <p className="text-xs text-corsair-gray-500">{ao.label}</p>
                    <span className="text-xs text-corsair-gray-600">+${Math.round(ao.priceCents / 100)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-corsair-gray-200">
                  <p className="text-xs font-black text-corsair-gray-700">Total</p>
                  <span className="text-2xl font-black text-corsair-blue-900">{totalDisplay}</span>
                </div>
              </>
            )}
            {(!addOns || selectedAddOns.size === 0) && (
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-corsair-gray-400">
                  {addOns ? 'Select add-ons above' : 'Range fee paid separately at Eagle Gun Range'}
                </p>
                <span className="text-2xl font-black text-corsair-blue-900">{totalDisplay}</span>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs font-bold text-amber-800 mb-1">Cancellation Policy</p>
            <p className="text-xs text-amber-700 leading-relaxed">Course registrations are non-refundable. If unable to attend, you will be automatically enrolled in the next available class at no additional charge.</p>
          </div>

          <button type="submit"
            className="w-full bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold py-3.5 rounded-xl text-sm transition-colors">
            Continue to Payment →
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="p-6 space-y-4">
          <div className="bg-corsair-gray-50 rounded-lg px-4 py-3 text-sm">
            <span className="text-corsair-gray-500">Registering: </span>
            <strong className="text-corsair-blue-900">{formData.firstName} {formData.lastName}</strong>
            <span className="text-corsair-gray-400"> · {formData.email}</span>
          </div>

          {addOns && selectedAddOns.size > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs">
              <p className="font-bold text-corsair-blue-900 mb-1">Add-Ons Selected</p>
              {addOns.filter((ao) => selectedAddOns.has(ao.id)).map((ao) => (
                <div key={ao.id} className="flex justify-between text-corsair-gray-600">
                  <span>{ao.label}</span>
                  <span>+${Math.round(ao.priceCents / 100)}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-corsair-gray-700 mb-2">Card Details *</label>
            <div id="event-card-container"
              className="border border-corsair-gray-300 rounded-lg p-3 min-h-[52px] bg-white" />
            {!cardReady && (
              <p className="text-xs text-corsair-gray-400 mt-1.5 animate-pulse">Loading secure payment form…</p>
            )}
          </div>

          {paymentError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {paymentError}
            </p>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs font-bold text-amber-800 mb-1">Cancellation Policy</p>
            <p className="text-xs text-amber-700 leading-relaxed">Course registrations are non-refundable. If unable to attend, you will be automatically enrolled in the next available class at no additional charge.</p>
          </div>

          <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-bold text-corsair-gray-700">Total Due Today</p>
            <span className="text-2xl font-black text-corsair-blue-900">{totalDisplay}</span>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)}
              className="flex-1 border-2 border-corsair-gray-200 text-corsair-gray-600 font-bold py-3 rounded-xl text-sm hover:border-corsair-blue-900 hover:text-corsair-blue-900 transition-colors">
              ← Back
            </button>
            <button type="button" onClick={handlePayment}
              disabled={!cardReady || isProcessing}
              className="flex-1 bg-corsair-red-500 hover:bg-corsair-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors">
              {isProcessing ? 'Processing…' : `Pay ${totalDisplay} →`}
            </button>
          </div>
          <p className="text-xs text-center text-corsair-gray-400">
            🔒 Secured by Square. Card details never stored on our servers.
          </p>
        </div>
      )}
    </div>
  );
}
