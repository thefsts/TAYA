import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.refundCancellationPolicy' });
  return buildPageMetadata({
    path: '/refund-cancellation-policy',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function RefundCancellationPage() {
  const t = await getTranslations('legalPages.refundCancellationPolicy');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '12px', padding: '24px 28px', marginBottom: '32px' }}>
        <p style={{ fontSize: '20px', fontWeight: 900, color: '#991b1b', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          All Sales Are Final — There Are No Refunds.
        </p>
      </div>

      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">Overview</h2>
      <p>
        All course fees, event registrations, and training payments made through Corsair Tactical Solutions are{' '}
        <strong>non-refundable</strong>. By completing payment, you acknowledge and agree to this no-refund policy.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Need to Reschedule?</h2>
      <p>
        If you are unable to attend your scheduled session, you may <strong>reschedule</strong> at no additional charge.
        You will be placed in the next available session for the same course. Please contact us as soon as possible:
      </p>
      <ul>
        <li>
          <strong>Phone / Text:</strong>{' '}
          <a href="tel:+12143356652" className="text-corsair-red-500 hover:underline">214-335-6652</a>
          {' '}(preferred for urgent changes)
        </li>
        <li>
          <strong>Email:</strong>{' '}
          <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">
            corsairtacticalsolutions@gmail.com
          </a>
        </li>
      </ul>
      <p>
        Please include your full name, course name, and original scheduled date when requesting a reschedule.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">No-Show Policy</h2>
      <p>
        Students who do not attend their scheduled session and do not contact Corsair Tactical Solutions before the
        class start time forfeit their enrollment. No-shows who did not contact Corsair before the class start time are <strong>not eligible to transfer</strong> their enrollment. If you anticipate being unable to attend, please contact us as early as possible — prior contact ensures your transfer eligibility.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Class Cancelled by Corsair Tactical Solutions</h2>
      <p>
        In the rare event that Corsair cancels or reschedules a class due to insufficient enrollment, instructor
        unavailability, severe weather, or circumstances beyond our control, enrolled students will be moved to the
        next available date at no additional charge. We will notify you by phone and email as soon as possible.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Safety Violations</h2>
      <p>
        Students removed from a class due to safety violations, disruptive behavior, or failure to follow instructor
        commands are not eligible to reschedule. Please review our{' '}
        <Link href="/training-waiver" className="text-corsair-red-500 hover:underline">Training Waiver</Link>
        {' '}and{' '}
        <Link href="/safety-disclaimer" className="text-corsair-red-500 hover:underline">Safety Disclaimer</Link>
        {' '}before attending.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Contact Us</h2>
      <p>To request a reschedule, reach us directly:</p>
      <ul>
        <li>
          <strong>Phone / Text:</strong>{' '}
          <a href="tel:+12143356652" className="text-corsair-red-500 hover:underline">214-335-6652</a>
        </li>
        <li>
          <strong>Email:</strong>{' '}
          <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">
            corsairtacticalsolutions@gmail.com
          </a>
        </li>
      </ul>
    </LegalPageLayout>
  );
}
