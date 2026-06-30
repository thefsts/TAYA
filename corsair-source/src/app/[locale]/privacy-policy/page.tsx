import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.privacyPolicy' });
  return buildPageMetadata({
    path: '/privacy-policy',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('legalPages.privacyPolicy');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">1. Introduction</h2>
      <p>
        Corsair Tactical Solutions, LLC ("Corsair," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website at corsair-tactical-solutions.vercel.app, contact us, or enroll in our training programs.
      </p>
      <p>
        By using our website or services, you consent to the data practices described in this policy. If you do not agree with the terms of this Privacy Policy, please do not access or use our services.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">2. Information We Collect</h2>
      <h3 className="text-corsair-blue-900 font-semibold">Personal Information You Provide</h3>
      <p>We may collect the following personal information when you voluntarily provide it to us:</p>
      <ul>
        <li>Full name and contact information (phone number, email address)</li>
        <li>Date of birth (when required for licensing or age verification)</li>
        <li>Course enrollment and training records</li>
        <li>Payment information (processed securely through third-party payment processors)</li>
        <li>Government-issued ID information (when required for Texas LTC applications)</li>
        <li>Emergency contact information</li>
        <li>Messages, inquiries, and correspondence you send us</li>
      </ul>

      <h3 className="text-corsair-blue-900 font-semibold">Information Collected Automatically</h3>
      <p>When you visit our website, we may automatically collect certain technical information including:</p>
      <ul>
        <li>IP address and approximate geographic location</li>
        <li>Browser type, version, and operating system</li>
        <li>Pages visited, time spent, and navigation patterns</li>
        <li>Referring website or search terms</li>
        <li>Device identifiers</li>
      </ul>
      <p>This information is collected through cookies and similar tracking technologies. Please see our <a href="/cookie-policy" className="text-corsair-red-500 hover:underline">Cookie Policy</a> for more information.</p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">3. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Process course enrollments, registrations, and payments</li>
        <li>Communicate with you about your training, schedule, and updates</li>
        <li>Send appointment reminders, class confirmations, and follow-up communications</li>
        <li>Comply with Texas Department of Public Safety (DPS) reporting requirements for LTC certifications</li>
        <li>Improve our website, services, and training programs</li>
        <li>Send marketing and promotional communications (with your consent)</li>
        <li>Respond to your inquiries and provide customer support</li>
        <li>Maintain accurate training and certification records</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">4. Information Sharing and Disclosure</h2>
      <p>We do not sell, trade, or rent your personal information to third parties. We may share your information in the following limited circumstances:</p>
      <ul>
        <li><strong>Service Providers:</strong> Third-party vendors who assist us in operating our website and providing services (payment processors, email services, scheduling platforms)</li>
        <li><strong>Legal Compliance:</strong> Texas DPS and other government agencies when required by law for LTC processing or other regulatory requirements</li>
        <li><strong>Legal Requirements:</strong> When required by law, court order, or government authority</li>
        <li><strong>Business Protection:</strong> To protect the rights, property, or safety of Corsair Tactical Solutions, our clients, or others</li>
        <li><strong>Alliance Training Network:</strong> As a co-founding member, limited anonymized training data may be shared for curriculum standards</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">5. Data Security</h2>
      <p>
        We implement commercially reasonable security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. These measures include secure socket layer (SSL) encryption for data transmission and restricted access to personal information by our staff.
      </p>
      <p>
        However, no method of transmission over the internet or method of electronic storage is 100% secure. We cannot guarantee absolute security of your data.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">6. Your Rights and Choices</h2>
      <p>You have the following rights regarding your personal information:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
        <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
        <li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal retention requirements</li>
        <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time by contacting us or using the unsubscribe link in emails</li>
        <li><strong>Cookie Control:</strong> Manage cookie preferences through our cookie consent banner</li>
      </ul>
      <p>To exercise any of these rights, contact us at <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a>.</p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">7. Children's Privacy</h2>
      <p>
        Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">8. Third-Party Links</h2>
      <p>
        Our website may contain links to third-party websites, including our social media profiles on Facebook and Instagram. We are not responsible for the privacy practices of those third-party sites and encourage you to review their privacy policies.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page with an updated "Last Updated" date. Your continued use of our services after any changes constitutes your acceptance of the new policy.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">10. Contact Us</h2>
      <p>
        If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
      </p>
      <ul>
        <li><strong>Business:</strong> Corsair Tactical Solutions, LLC</li>
        <li><strong>Email:</strong> <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a></li>
        <li><strong>Phone:</strong> 214-335-6652</li>
        <li><strong>Location:</strong> San Antonio / DFW, Texas</li>
      </ul>
    </LegalPageLayout>
  );
}