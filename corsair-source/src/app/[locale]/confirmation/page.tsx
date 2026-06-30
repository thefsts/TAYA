import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'confirmation' });
  return buildPageMetadata({
    path: '/confirmation',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
    noIndex: true,
  });
}

interface ConfirmationLineItem {
  name: string;
  amountCents: number;
}

function parseItems(raw: string | undefined): ConfirmationLineItem[] {
  if (!raw) return [];
  try {
    return raw.split('|').map((part) => {
      const colonIdx = part.lastIndexOf(':');
      if (colonIdx === -1) return null;
      const name = decodeURIComponent(part.slice(0, colonIdx));
      const amountCents = parseInt(part.slice(colonIdx + 1), 10);
      if (!name || isNaN(amountCents)) return null;
      return { name, amountCents };
    }).filter((x): x is ConfirmationLineItem => x !== null);
  } catch {
    return [];
  }
}

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    paymentId?: string;
    orderId?: string;
    courseName?: string;
    amount?: string;
    items?: string;
  }>;
}) {
  const t = await getTranslations('confirmation');
  const { status, paymentId, orderId, courseName, amount, items } = await searchParams;

  const isPaid = status === 'paid';
  const totalCents =
    amount && !isNaN(parseInt(amount)) ? parseInt(amount) : null;
  const totalDollars = totalCents !== null ? (totalCents / 100).toFixed(2) : null;

  const lineItems = parseItems(items);
  const hasItemized = lineItems.length > 0;

  const nextSteps = [
    {
      step: '01',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: t('steps.checkEmail.title'),
      description: t('steps.checkEmail.description'),
      note: t('steps.checkEmail.note'),
    },
    {
      step: '02',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      title: t('steps.reviewPrepare.title'),
      description: t('steps.reviewPrepare.description'),
      note: t('steps.reviewPrepare.note'),
    },
    {
      step: '03',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t('steps.arriveEarly.title'),
      description: t('steps.arriveEarly.description'),
      note: t('steps.arriveEarly.note'),
    },
    {
      step: '04',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: t('steps.trainHard.title'),
      description: t('steps.trainHard.description'),
      note: t('steps.trainHard.note'),
    },
  ];

  return (
    <main className="min-h-screen bg-corsair-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-corsair-blue-950 via-corsair-blue-900 to-corsair-blue-800 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-corsair-red-400 font-bold uppercase tracking-widest text-sm mb-3">
            {t('bookingConfirmed')}
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-4">{t('heroTitle')}</h1>
          <p className="text-corsair-gray-300 text-lg leading-relaxed max-w-xl mx-auto mb-8">
            {t('heroDescription')}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {(['confirmationEmail', 'passRate', 'secureBooking'] as const).map((key) => (
              <span key={key} className="bg-white/10 border border-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full">
                ✓ {t(`heroPills.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">

        {/* ── Itemized Payment Receipt ─────────────────────────────────────── */}
        {isPaid && (
          <section className="bg-white rounded-2xl border border-corsair-gray-200 shadow-sm overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-black text-green-800 text-base">Payment Successful</p>
                <p className="text-green-700 text-xs">Your card has been charged and your spot is reserved.</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {courseName && (
                <div>
                  <p className="text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-1">Course</p>
                  <p className="font-black text-corsair-blue-900 text-base">{courseName}</p>
                </div>
              )}

              {/* Itemized breakdown */}
              {hasItemized ? (
                <div>
                  <p className="text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-2">Order Summary</p>
                  <div className="bg-corsair-gray-50 rounded-xl border border-corsair-gray-200 overflow-hidden">
                    {lineItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex justify-between items-center px-4 py-2.5 text-sm ${idx < lineItems.length - 1 ? 'border-b border-corsair-gray-100' : ''}`}
                      >
                        <span className="text-corsair-gray-700">{item.name}</span>
                        <span className="font-semibold text-corsair-gray-900">${(item.amountCents / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {totalDollars && (
                <div className="flex justify-between items-center bg-corsair-blue-900 text-white rounded-xl px-5 py-4">
                  <span className="font-bold text-sm">Total Paid</span>
                  <span className="text-2xl font-black text-corsair-red-400">${totalDollars}</span>
                </div>
              )}

              {/* Reference IDs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentId && (
                  <div className="bg-corsair-gray-50 rounded-lg border border-corsair-gray-200 px-4 py-3">
                    <p className="text-[10px] font-bold text-corsair-gray-400 uppercase tracking-wider mb-0.5">Payment ID</p>
                    <p className="font-mono text-xs text-corsair-gray-700 break-all">{paymentId}</p>
                  </div>
                )}
                {orderId && (
                  <div className="bg-corsair-gray-50 rounded-lg border border-corsair-gray-200 px-4 py-3">
                    <p className="text-[10px] font-bold text-corsair-gray-400 uppercase tracking-wider mb-0.5">Order ID</p>
                    <p className="font-mono text-xs text-corsair-gray-700 break-all">{orderId}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── What Happens Next ────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <p className="text-corsair-red-500 font-bold uppercase tracking-widest text-sm mb-2">{t('roadmapLabel')}</p>
            <h2 className="text-3xl font-black text-corsair-blue-900 mb-3">{t('whatHappensNext')}</h2>
            <p className="text-corsair-gray-600 max-w-xl mx-auto">{t('whatHappensNextDescription')}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {nextSteps.map((s) => (
              <div key={s.step} className="bg-white rounded-2xl border border-corsair-gray-200 p-6 flex gap-4">
                <div className="w-10 h-10 bg-corsair-blue-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  {s.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-corsair-red-500 tracking-widest">{s.step}</span>
                    <h3 className="font-black text-corsair-blue-900 text-sm">{s.title}</h3>
                  </div>
                  <p className="text-corsair-gray-600 text-xs leading-relaxed mb-1">{s.description}</p>
                  <p className="text-corsair-gray-400 text-xs italic">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── What to Bring ────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-corsair-gray-200 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-corsair-red-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-corsair-red-500 uppercase tracking-wider">{t('bePrepared')}</p>
              <h2 className="text-xl font-black text-corsair-blue-900">{t('whatToBring')}</h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.values({
              govId: t('checklist.govId'),
              closedToeShoes: t('checklist.closedToeShoes'),
              firearm: t('checklist.firearm'),
              eyeEarProtection: t('checklist.eyeEarProtection'),
              bookingConfirmation: t('checklist.bookingConfirmation'),
              waterSnacks: t('checklist.waterSnacks'),
              paymentBalance: t('checklist.paymentBalance'),
            }).map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-corsair-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-corsair-gray-700 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQs ─────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-corsair-gray-200 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-corsair-blue-900 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-corsair-blue-900 uppercase tracking-wider">{t('quickAnswers')}</p>
              <h2 className="text-xl font-black text-corsair-blue-900">{t('commonQuestions')}</h2>
            </div>
          </div>
          <div className="space-y-4">
            {(['reschedule', 'bringFirearm', 'trainingLocation'] as const).map((key) => (
              <details key={key} className="group border border-corsair-gray-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-bold text-corsair-blue-900 text-sm hover:bg-corsair-gray-50 transition-colors">
                  {t(`faqs.${key}.q`)}
                  <svg className="w-4 h-4 text-corsair-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-4 text-corsair-gray-600 text-sm leading-relaxed border-t border-corsair-gray-100">
                  {t(`faqs.${key}.a`)}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ── Footer Actions ───────────────────────────────────────────────── */}
        <section className="text-center">
          <div className="bg-white rounded-2xl border border-corsair-gray-200 p-6 md:p-8 mb-6">
            <h2 className="text-xl font-black text-corsair-blue-900 mb-2">{t('needChanges')}</h2>
            <p className="text-corsair-gray-600 text-sm mb-4">{t('needChangesDescription')}</p>
            <Link
              href="/contact"
              className="inline-block bg-corsair-blue-900 hover:bg-corsair-blue-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              {t('contactUs')}
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/courses" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
              {t('browseMoreCourses')}
            </Link>
            <Link href="/" className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
              {t('backToHome')}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
