'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Course } from '@/lib/courses';

/* ── Square Web Payments SDK type shim ──────────────────────────────────── */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Square?: any;
  }
}

interface BookingFormProps {
  course: Course;
}

const GOV_ID_SLUGS = [
  'texas-license-to-carry',
  'online-texas-ltc-assessment',
  'texas-ltc-wichita',
  'texas-ltc-certification-basic-handgun',
  'texas-ltc-shooting-proficiency',
  'level-2-security-officer',
  'level-3-armed-security-officer',
  'level-4-bodyguard',
  'level-3-4-complete-package',
  'firearm-proficiency-requalification',
  'armed-first-responder',
];

const SQUARE_SDK_URL = {
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
  production: 'https://web.squarecdn.com/v1/square.js',
};

export default function BookingForm({ course }: BookingFormProps) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const requiresGovId = GOV_ID_SLUGS.includes(course.slug);

  const [selectedPricing, setSelectedPricing] = useState(
    course.pricingOptions.find((p) => p.popular)?.id || course.pricingOptions[0]?.id
  );
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
    background: '',
    date: '',
    experience: '',
    notes: '',
    driverLicense: '',
  });
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [govIdAcknowledged, setGovIdAcknowledged] = useState(false);

  // Step 3 — Square payment state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const squareCardRef = useRef<any>(null);
  const [cardReady, setCardReady] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    paymentId: string;
    squareOrderId: string | null;
    receiptUrl: string | null;
    courseName: string;
    totalCents: number;
  } | null>(null);

  const selectedOption = course.pricingOptions.find((p) => p.id === selectedPricing);
  const requiredFeesTotal = (course.requiredFees ?? []).reduce((sum, f) => sum + f.price, 0);
  const optionalAddOnTotal = (course.optionalAddOns ?? [])
    .filter((a) => selectedAddOns.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);
  const totalPrice = (selectedOption?.price || 0) + requiredFeesTotal + optionalAddOnTotal;

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const step2Valid =
    formData.firstName &&
    formData.lastName &&
    formData.email &&
    formData.phone &&
    ageConfirmed &&
    (!requiresGovId || govIdAcknowledged) &&
    formData.driverLicense.trim();

  /* ── Load & init Square Web Payments SDK when user reaches step 3 ── */
  useEffect(() => {
    if (step !== 3) return;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
    const env = (process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT ?? 'production') as 'sandbox' | 'production';

    if (!appId || !locationId) {
      setPaymentError('Payment system is not configured. Please call us at 214-335-6652 to register.');
      return;
    }

    let destroyed = false;

    const initCard = async () => {
      if (destroyed || !window.Square) {
        if (!destroyed) setPaymentError('Payment SDK failed to load. Please refresh the page and try again.');
        return;
      }
      try {
        const payments = window.Square.payments(appId, locationId);
        const card = await payments.card({
          style: {
            '.input-container': {
              borderColor: '#e2e8f0',
              borderRadius: '8px',
            },
            '.input-container.is-focus': {
              borderColor: '#ef4444',
            },
            '.input-container.is-error': {
              borderColor: '#ef4444',
            },
            '.message-text': { color: '#ef4444' },
            '.message-icon': { color: '#ef4444' },
          },
        });
        await card.attach('#square-card-container');
        if (!destroyed) {
          squareCardRef.current = card;
          setCardReady(true);
        }
      } catch (err) {
        console.error('[Square] Card init error:', err);
        if (!destroyed) {
          setPaymentError('Payment form failed to initialize. Please refresh and try again.');
        }
      }
    };

    if (window.Square) {
      initCard();
    } else {
      const scriptSrc = SQUARE_SDK_URL[env];
      const existing = document.querySelector(`script[src="${scriptSrc}"]`);
      if (existing) {
        // Script already in DOM — wait for it
        existing.addEventListener('load', initCard);
      } else {
        const script = document.createElement('script');
        script.src = scriptSrc;
        script.onload = initCard;
        script.onerror = () => {
          if (!destroyed) setPaymentError('Payment SDK failed to load. Please refresh and try again.');
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      destroyed = true;
      if (squareCardRef.current) {
        squareCardRef.current.destroy().catch(() => {/* ignore */});
        squareCardRef.current = null;
        setCardReady(false);
      }
    };
  }, [step]);

  /* ── Square payment handler ────────────────────────────────────────────── */
  const handlePayment = async () => {
    if (!squareCardRef.current || !cardReady) return;
    setIsProcessingPayment(true);
    setPaymentError('');

    try {
      const tokenResult = await squareCardRef.current.tokenize();
      if (tokenResult.status !== 'OK') {
        const msg = tokenResult.errors?.[0]?.message ?? 'Card tokenization failed. Please check your card details.';
        setPaymentError(msg);
        return;
      }

      const newKey = () =>
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const idempotencyKey = newKey();

      // Step A — create an itemized Square Order (course option + each add-on as
      // separate line items). Amounts are resolved server-side; we only send ids.
      const orderRes = await fetch('/api/square/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseSlug: course.slug,
          pricingOptionId: selectedPricing,
          addOnIds: selectedAddOns,
          idempotencyKey: `order-${idempotencyKey}`,
        }),
      });
      const orderData = await orderRes.json() as {
        success?: boolean;
        orderId?: string | null;
        error?: string;
      };
      if (!orderData.success || !orderData.orderId) {
        setPaymentError(orderData.error ?? 'Could not start your order. Please try again.');
        return;
      }

      // Step B — charge the card against that order so the Square receipt is
      // itemized. The server re-derives the amount and links order_id.
      const res = await fetch('/api/square/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          courseSlug: course.slug,
          pricingOptionId: selectedPricing,
          addOnIds: selectedAddOns,
          orderId: orderData.orderId,
          idempotencyKey,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          preferredDate: formData.date,
          notes: formData.notes,
          driverLicense: formData.driverLicense,
        }),
      });

      const result = await res.json() as {
        success?: boolean;
        paymentId?: string;
        squareOrderId?: string | null;
        receiptUrl?: string | null;
        courseName?: string;
        totalCents?: number;
        lineItems?: Array<{kind:string;name:string;priceCents:number;quantity:number}>;
        error?: string;
      };

      if (!result.success) {
        setPaymentError(result.error ?? 'Payment failed. Please try again or use a different card.');
        return;
      }

      setPaymentResult({
        paymentId: result.paymentId ?? '',
        squareOrderId: result.squareOrderId ?? null,
        receiptUrl: result.receiptUrl ?? null,
        courseName: result.courseName ?? course.title,
        totalCents: result.totalCents ?? 0,
      });

      // Build compact itemized param: "Label:cents|Label:cents"
      const itemsParam = Array.isArray(result.lineItems)
        ? (result.lineItems as Array<{name:string;priceCents:number}>)
            .map((li) => `${encodeURIComponent(li.name)}:${li.priceCents}`)
            .join('|')
        : '';

      const params = new URLSearchParams({
        status: 'paid',
        paymentId: result.paymentId ?? '',
        orderId: result.squareOrderId ?? '',
        courseName: result.courseName ?? course.title,
        amount: String(result.totalCents ?? 0),
        ...(itemsParam ? { items: itemsParam } : {}),
      });
      window.location.href = `/${locale}/confirmation?${params.toString()}`;

    } catch (err) {
      console.error('[Square] Payment error:', err);
      setPaymentError('Payment could not be completed. Please try again or contact us directly.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  /* ── Contact-Only (no booking form) ────────────────────────────────────── */
  if (course.contactOnly) {
    return (
      <div className="bg-white rounded-2xl border border-corsair-gray-200 overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-corsair-blue-950 to-corsair-blue-900 text-white px-6 py-5">
          <p className="text-corsair-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">{t('contactOnly.label')}</p>
          <h3 className="text-lg font-black leading-tight">{course.title}</h3>
        </div>
        <div className="p-6 space-y-4 text-center">
          <p className="text-corsair-gray-600 text-sm">{t('contactOnly.description')}</p>
          <a
            href="tel:+12143356652"
            className="block w-full btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
          >
            📞 {t('contactOnly.callButton')}
          </a>
          <a
            href="/contact"
            className="block w-full border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white py-3 rounded-xl text-sm font-bold transition-colors"
          >
            {t('contactOnly.messageButton')}
          </a>
        </div>
      </div>
    );
  }

  /* ── Payment Success State (client-side, before redirect completes) ─────── */
  if (paymentResult) {
    return (
      <div className="bg-white rounded-2xl border border-corsair-gray-200 overflow-hidden shadow-lg">
        <div className="bg-green-50 border-b border-green-100 p-6 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-corsair-blue-900 mb-1">Payment Successful!</h3>
          <p className="text-corsair-gray-600 text-sm">Redirecting to your confirmation…</p>
        </div>
      </div>
    );
  }

  /* ── Step Indicator ─────────────────────────────────────────────────────── */
  const stepLabels = [t('steps.step1'), t('steps.step2'), 'Payment'];

  const StepIndicator = () => (
    <div className="flex items-center gap-0 mb-6">
      {stepLabels.map((label, i) => {
        const num = (i + 1) as 1 | 2 | 3;
        const isActive = step === num;
        const isDone = step > num;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 text-xs font-semibold ${isActive ? 'text-corsair-blue-900' : isDone ? 'text-green-600' : 'text-corsair-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isActive ? 'bg-corsair-blue-900 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-corsair-gray-200 text-corsair-gray-500'}`}>
                {isDone ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < stepLabels.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${step > num ? 'bg-green-500' : 'bg-corsair-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-corsair-gray-200 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-corsair-blue-950 to-corsair-blue-900 text-white px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-corsair-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">{t('header.label')}</p>
            <h3 className="text-lg font-black leading-tight">{course.title}</h3>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-corsair-gray-400">{t('header.startingAt')}</p>
            <p className="text-2xl font-black text-corsair-red-400">{course.pricingOptions[0]?.priceLabel ?? `$${course.pricingOptions[0]?.price}`}</p>
          </div>
        </div>
        {course.urgencyMessage && (
          <div className="mt-3 flex items-center gap-2 bg-corsair-red-500/20 border border-corsair-red-500/30 rounded-lg px-3 py-2">
            <span className="text-base animate-pulse">🔥</span>
            <p className="text-xs font-bold text-corsair-red-300">{course.urgencyMessage}</p>
          </div>
        )}
      </div>

      <div className="p-6">
        <StepIndicator />

        {/* ── Step 1: Package & Add-ons ──────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-3">
                {t('package.label')}
              </label>
              <div className="space-y-2.5">
                {course.pricingOptions.map((option) => {
                  const isSelected = selectedPricing === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected ? 'border-corsair-red-500 bg-corsair-red-50 shadow-sm' : 'border-corsair-gray-200 hover:border-corsair-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'border-corsair-red-500 bg-corsair-red-500' : 'border-corsair-gray-300'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <input type="radio" name="pricing" value={option.id} checked={isSelected} onChange={() => setSelectedPricing(option.id)} className="sr-only" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-corsair-gray-900 text-sm">{option.name}</span>
                            {option.badge && <span className="bg-corsair-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{option.badge}</span>}
                            {option.savings && <span className="text-green-600 text-xs font-bold">({option.savings})</span>}
                          </div>
                          {option.description && <p className="text-corsair-gray-500 text-xs mt-0.5 leading-relaxed">{option.description}</p>}
                        </div>
                      </div>
                      <span className={`text-xl font-black ml-3 flex-shrink-0 ${isSelected ? 'text-corsair-red-500' : 'text-corsair-blue-900'}`}>
                        {option.priceLabel ?? `$${option.price}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Required fees — locked, always included */}
            {(course.requiredFees ?? []).length > 0 && (
              <div>
                <label className="block text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-3">
                  Required Fees
                </label>
                <div className="space-y-2">
                  {(course.requiredFees ?? []).map((fee) => (
                    <div key={fee.id} className="flex items-center justify-between p-3.5 rounded-xl border border-corsair-red-200 bg-corsair-red-50/60 cursor-default">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-4 h-4 rounded border-2 border-corsair-red-500 bg-corsair-red-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-corsair-gray-800 text-sm">{fee.label}</span>
                            <span className="bg-corsair-red-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">Required · Included</span>
                          </div>
                          {fee.description && <p className="text-corsair-gray-500 text-xs mt-0.5">{fee.description}</p>}
                        </div>
                      </div>
                      <span className="font-bold text-corsair-red-600 text-sm ml-3 flex-shrink-0">+${fee.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional add-ons — customer may select */}
            {(course.optionalAddOns ?? []).length > 0 && (
              <div>
                <label className="block text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-3">
                  {t('package.addOns')}
                </label>
                <div className="space-y-2">
                  {(course.optionalAddOns ?? []).map((addOn) => {
                    const isChecked = selectedAddOns.includes(addOn.id);
                    return (
                      <label key={addOn.id} className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${isChecked ? 'border-corsair-blue-500 bg-corsair-blue-50' : 'border-corsair-gray-200 hover:border-corsair-gray-300 bg-white'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? 'border-corsair-blue-600 bg-corsair-blue-600' : 'border-corsair-gray-300'}`}>
                            {isChecked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleAddOn(addOn.id)} className="sr-only" />
                          <div className="min-w-0">
                            <span className="font-semibold text-corsair-gray-800 text-sm">{addOn.label}</span>
                            {addOn.description && <p className="text-corsair-gray-500 text-xs mt-0.5">{addOn.description}</p>}
                          </div>
                        </div>
                        <span className="font-bold text-corsair-gray-700 text-sm ml-3 flex-shrink-0">+${addOn.price}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-corsair-gray-50 rounded-xl p-4 border border-corsair-gray-200">
              <p className="text-xs font-bold text-corsair-blue-900 uppercase tracking-wider mb-3">Order Summary</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-corsair-gray-500">Base Class Price</span>
                  <span className="font-medium text-corsair-gray-700">${selectedOption?.price ?? 0}</span>
                </div>
                {(course.requiredFees ?? []).map((fee) => (
                  <div key={fee.id} className="flex justify-between items-center">
                    <span className="text-corsair-gray-500 flex items-center gap-1.5">
                      {fee.label}
                      <span className="bg-corsair-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded uppercase">Req</span>
                    </span>
                    <span className="font-medium text-corsair-red-600">+${fee.price}</span>
                  </div>
                ))}
                {(course.optionalAddOns ?? []).filter(a => selectedAddOns.includes(a.id)).map((a) => (
                  <div key={a.id} className="flex justify-between items-center">
                    <span className="text-corsair-gray-500">{a.label}</span>
                    <span className="font-medium text-corsair-gray-700">+${a.price}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-corsair-gray-200 mt-2">
                <span className="font-bold text-corsair-blue-900">Total Due</span>
                <span className="text-2xl font-black text-corsair-red-500">${totalPrice}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white py-3.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2"
            >
              {t('package.continueBtn')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <p className="text-center text-xs text-corsair-gray-400 flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t('package.secureNote')}
            </p>
          </div>
        )}

        {/* ── Step 2: Personal Details ────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1.5 text-xs text-corsair-gray-500 hover:text-corsair-blue-900 transition-colors font-medium mb-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('details.backBtn')}
            </button>

            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.firstName')} <span className="text-corsair-red-500">*</span></label>
                <input type="text" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder={t('placeholders.firstName')} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.lastName')} <span className="text-corsair-red-500">*</span></label>
                <input type="text" required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder={t('placeholders.lastName')} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.email')} <span className="text-corsair-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-corsair-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t('placeholders.email')} className="w-full pl-10 pr-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400" />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.phone')} <span className="text-corsair-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-corsair-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </div>
                <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder={t('placeholders.phone')} className="w-full pl-10 pr-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400" />
              </div>
            </div>

            {/* Driver's License */}
            <div>
              <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                Driver&apos;s License Number <span className="text-corsair-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.driverLicense}
                onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
                placeholder="TX DL number"
                className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400"
              />
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-2">{t('details.emergencySection')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.emergencyName')}</label>
                  <input type="text" value={formData.emergencyContact} onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })} placeholder={t('placeholders.emergencyName')} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.emergencyPhone')}</label>
                  <input type="tel" value={formData.emergencyPhone} onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })} placeholder={t('placeholders.emergencyPhone')} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400" />
                </div>
              </div>
            </div>

            {/* Background */}
            <div>
              <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.background')}</label>
              <select value={formData.background} onChange={(e) => setFormData({ ...formData, background: e.target.value })} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow text-corsair-gray-700 bg-white">
                <option value="">{t('details.backgroundOptions.placeholder')}</option>
                <option value="civilian">{t('details.backgroundOptions.civilian')}</option>
                <option value="military">{t('details.backgroundOptions.military')}</option>
                <option value="former-military">{t('details.backgroundOptions.formerMilitary')}</option>
                <option value="law-enforcement">{t('details.backgroundOptions.lawEnforcement')}</option>
                <option value="former-law-enforcement">{t('details.backgroundOptions.formerLawEnforcement')}</option>
                <option value="first-responder">{t('details.backgroundOptions.firstResponder')}</option>
                <option value="instructor">{t('details.backgroundOptions.instructor')}</option>
                <option value="security">{t('details.backgroundOptions.security')}</option>
                <option value="other">{t('details.backgroundOptions.other')}</option>
              </select>
            </div>

            {/* Date + Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.preferredDate')}</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow text-corsair-gray-700" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.experience')}</label>
                <select value={formData.experience} onChange={(e) => setFormData({ ...formData, experience: e.target.value })} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow text-corsair-gray-700 bg-white">
                  <option value="">{t('details.experienceOptions.placeholder')}</option>
                  <option value="none">{t('details.experienceOptions.none')}</option>
                  <option value="beginner">{t('details.experienceOptions.beginner')}</option>
                  <option value="intermediate">{t('details.experienceOptions.intermediate')}</option>
                  <option value="advanced">{t('details.experienceOptions.advanced')}</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('details.notes')}</label>
              <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={t('details.notesPlaceholder')} className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400 resize-none" />
            </div>

            {/* Acknowledgments */}
            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${ageConfirmed ? 'border-green-400 bg-green-50' : 'border-corsair-gray-200 bg-corsair-gray-50 hover:border-corsair-gray-300'}`}>
                <div className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${ageConfirmed ? 'border-green-500 bg-green-500' : 'border-corsair-gray-400'}`}>
                  {ageConfirmed && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="sr-only" />
                <span className="text-xs text-corsair-gray-700 leading-relaxed">
                  {t('details.ageConfirm')} <span className="text-corsair-red-500">*</span>
                </span>
              </label>

              {requiresGovId && (
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${govIdAcknowledged ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-amber-50/50 hover:border-amber-300'}`}>
                  <div className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${govIdAcknowledged ? 'border-amber-500 bg-amber-500' : 'border-amber-400'}`}>
                    {govIdAcknowledged && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" checked={govIdAcknowledged} onChange={(e) => setGovIdAcknowledged(e.target.checked)} className="sr-only" />
                  <span className="text-xs text-corsair-gray-700 leading-relaxed">
                    {t('details.govIdNotice')} <span className="text-corsair-red-500">*</span>
                  </span>
                </label>
              )}
            </div>

            {/* Order Summary */}
            <div className="bg-corsair-blue-900/5 rounded-xl border border-corsair-blue-900/10 p-4">
              <p className="text-xs font-bold text-corsair-blue-900 uppercase tracking-wider mb-3">{t('details.orderSummary')}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-corsair-gray-500">Base Class Price</span>
                  <span className="font-medium text-corsair-gray-800">${selectedOption?.price ?? 0}</span>
                </div>
                {(course.requiredFees ?? []).map((fee) => (
                  <div key={fee.id} className="flex justify-between">
                    <span className="text-corsair-gray-500 flex items-center gap-1.5">
                      {fee.label}
                      <span className="bg-corsair-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded uppercase">Required</span>
                    </span>
                    <span className="font-medium text-corsair-red-600">+${fee.price}</span>
                  </div>
                ))}
                {(course.optionalAddOns ?? []).filter(a => selectedAddOns.includes(a.id)).map((a) => (
                  <div key={a.id} className="flex justify-between">
                    <span className="text-corsair-gray-500">{a.label}</span>
                    <span className="font-medium text-corsair-gray-800">+${a.price}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-corsair-blue-900/10">
                  <span className="font-bold text-corsair-blue-900">Total Due</span>
                  <span className="font-black text-corsair-red-500 text-lg">${totalPrice}</span>
                </div>
              </div>
            </div>

            {/* Continue to Payment */}
            <button
              type="button"
              disabled={!step2Valid}
              onClick={() => { if (step2Valid) setStep(3); }}
              className="w-full btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 disabled:bg-corsair-gray-400 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Continue to Payment — ${totalPrice}
            </button>

            <p className="text-center text-xs text-corsair-gray-400 flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t('details.footerNote')}
            </p>
          </div>
        )}

        {/* ── Step 3: Payment ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <button type="button" onClick={() => { setStep(2); setPaymentError(''); }} className="flex items-center gap-1.5 text-xs text-corsair-gray-500 hover:text-corsair-blue-900 transition-colors font-medium mb-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Registration
            </button>

            {/* Order summary recap — itemized */}
            <div className="bg-corsair-blue-900 rounded-xl p-4 text-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs text-corsair-gray-400 uppercase tracking-wider font-bold mb-1">Order Summary</p>
                  <p className="font-bold text-sm leading-snug">{course.title}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-2xl font-black text-corsair-red-400">${totalPrice}</p>
                  <p className="text-xs text-corsair-gray-400">USD</p>
                </div>
              </div>
              <div className="space-y-1 border-t border-white/10 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-corsair-gray-400">Base Class Price</span>
                  <span className="text-white font-medium">${selectedOption?.price ?? 0}</span>
                </div>
                {(course.requiredFees ?? []).map((fee) => (
                  <div key={fee.id} className="flex justify-between text-xs">
                    <span className="text-corsair-gray-400 flex items-center gap-1">
                      {fee.label}
                      <span className="bg-corsair-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded uppercase">Req</span>
                    </span>
                    <span className="text-corsair-red-300 font-medium">+${fee.price}</span>
                  </div>
                ))}
                {(course.optionalAddOns ?? []).filter(a => selectedAddOns.includes(a.id)).map((a) => (
                  <div key={a.id} className="flex justify-between text-xs">
                    <span className="text-corsair-gray-400">{a.label}</span>
                    <span className="text-white font-medium">+${a.price}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-corsair-gray-400">
                <span>{formData.firstName} {formData.lastName}</span>
                <span className="mx-2">·</span>
                <span>{formData.email}</span>
              </div>
            </div>

            {/* Square card form */}
            <div>
              <label className="block text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-3">
                Card Details
              </label>
              <div
                id="square-card-container"
                className="min-h-[90px] rounded-xl border border-corsair-gray-300 overflow-hidden"
              />
              {!cardReady && !paymentError && (
                <div className="flex items-center gap-2 mt-2 text-xs text-corsair-gray-500">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading secure payment form…
                </div>
              )}
            </div>

            {/* Payment error */}
            {paymentError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-700 leading-relaxed">{paymentError}</p>
              </div>
            )}

            {/* Pay button */}
            <button
              type="button"
              onClick={handlePayment}
              disabled={!cardReady || isProcessingPayment}
              className="w-full btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 disabled:bg-corsair-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2"
            >
              {isProcessingPayment ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing Payment…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Pay Securely with Square — ${totalPrice}
                </>
              )}
            </button>

            {/* Trust badges */}
            <div className="bg-corsair-gray-50 rounded-xl border border-corsair-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-corsair-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  256-bit SSL Encrypted
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  PCI Compliant
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Powered by Square
                </span>
              </div>
            </div>

            <p className="text-center text-xs text-corsair-gray-400">
              Questions? Call <a href="tel:+12143356652" className="text-corsair-blue-900 font-semibold hover:underline">214-335-6652</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
