import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.smsEmailConsentPolicy' });
  return buildPageMetadata({
    path: '/sms-email-consent-policy',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function SmsEmailConsentPage() {
  const t = await getTranslations('legalPages.smsEmailConsentPolicy');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">1. Overview</h2>
      <p>
        Corsair Tactical Solutions, LLC ("Corsair") values your privacy and is committed to communicating with you only in ways you have consented to. This policy explains how we use SMS (text message), email, and phone communications, what types of messages you may receive, and how to opt out at any time.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">2. Types of Communications</h2>
      <h3 className="text-corsair-blue-900 font-semibold">Transactional / Service Communications</h3>
      <p>
        These communications are directly related to services you have requested or enrolled in. They include:
      </p>
      <ul>
        <li>Course enrollment confirmations and booking details</li>
        <li>Class reminders and schedule updates</li>
        <li>Cancellation or rescheduling notices</li>
        <li>Payment receipts and invoices</li>
        <li>Certification completion notices</li>
        <li>Responses to your direct inquiries</li>
      </ul>
      <p>
        Transactional communications are considered part of the service you have enrolled in and may be sent without separate marketing consent. However, you may still request to receive these via a different channel (e.g., email instead of SMS).
      </p>

      <h3 className="text-corsair-blue-900 font-semibold">Marketing / Promotional Communications</h3>
      <p>
        These are optional communications that provide information about our courses, promotions, new services, and training opportunities. They include:
      </p>
      <ul>
        <li>New course announcements</li>
        <li>Special offers and discounts</li>
        <li>Training tips and safety reminders</li>
        <li>Newsletter updates</li>
        <li>Event invitations</li>
      </ul>
      <p>
        You will only receive marketing communications if you have provided explicit consent, either through our contact form, at enrollment, or through a separate opt-in process.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">3. SMS Text Message Communications</h2>
      <p>
        By providing your mobile phone number and checking the consent checkbox on our contact form or enrollment form, you consent to receive SMS text messages from Corsair Tactical Solutions. Message types may include appointment reminders, class confirmations, and promotional offers.
      </p>

      <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl p-5 my-4 not-prose">
        <p className="text-corsair-blue-950 font-bold text-sm mb-2">Important SMS Disclosures</p>
        <ul className="text-sm text-corsair-gray-700 space-y-1 list-disc pl-4">
          <li>Message and data rates may apply depending on your mobile carrier and plan.</li>
          <li>Message frequency varies based on your activity and preferences.</li>
          <li>Corsair Tactical Solutions does not charge for SMS messages, but carrier rates may apply.</li>
          <li>You may opt out of SMS communications at any time (see Section 5 below).</li>
          <li>For help, reply HELP to any text message or contact us at 214-335-6652.</li>
        </ul>
      </div>

      <h2 className="text-corsair-blue-950 text-xl font-bold">4. Email Communications</h2>
      <p>
        By providing your email address and checking the consent checkbox on our contact or enrollment forms, you consent to receive email communications from Corsair Tactical Solutions. Email communications may include course confirmations, training resources, and promotional content.
      </p>
      <p>
        All marketing emails will include an unsubscribe link at the bottom. Clicking this link will immediately remove you from marketing email lists. Transactional emails related to active enrollments will continue until your enrollment period is complete.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">5. How to Opt Out</h2>
      <p>You may opt out of communications from Corsair Tactical Solutions at any time using the following methods:</p>
      <ul>
        <li><strong>SMS:</strong> Reply STOP to any text message from us. You will receive one final confirmation message and no further texts will be sent.</li>
        <li><strong>Email:</strong> Click the "Unsubscribe" link in any marketing email, or email us at <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a> with "UNSUBSCRIBE" in the subject line.</li>
        <li><strong>Phone:</strong> Call 214-335-6652 and request to be removed from our contact list.</li>
        <li><strong>Direct Contact:</strong> Email <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a> specifying which communications you wish to stop.</li>
      </ul>
      <p>
        Opt-out requests will be processed within 10 business days. After opting out of marketing communications, you may still receive transactional messages directly related to active services or enrollments.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">6. Data Sharing</h2>
      <p>
        Corsair Tactical Solutions does not sell, rent, or share your phone number or email address with third-party marketers. Your contact information is used only by Corsair Tactical Solutions for the purposes described in this policy and in our <a href="/privacy-policy" className="text-corsair-red-500 hover:underline">Privacy Policy</a>.
      </p>
      <p>
        We may use third-party service providers (such as email platforms or SMS gateways) to deliver communications on our behalf. These providers are contractually required to protect your information and use it only for delivering our communications.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">7. CAN-SPAM and TCPA Compliance</h2>
      <p>
        Corsair Tactical Solutions is committed to complying with the CAN-SPAM Act (for email communications) and the Telephone Consumer Protection Act (TCPA) (for SMS and phone communications). We will not send unsolicited commercial messages and will honor all opt-out requests promptly.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">8. Updates to This Policy</h2>
      <p>
        This policy may be updated periodically to reflect changes in our communication practices or applicable law. Updates will be posted on this page with a revised "Last Updated" date.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">9. Contact</h2>
      <p>
        For questions about this policy or to manage your communication preferences, contact us:
      </p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a></li>
        <li><strong>Phone:</strong> 214-335-6652</li>
        <li><strong>Location:</strong> San Antonio / DFW, Texas</li>
      </ul>
    </LegalPageLayout>
  );
}