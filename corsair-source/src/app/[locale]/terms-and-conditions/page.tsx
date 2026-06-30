import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.termsAndConditions' });
  return buildPageMetadata({
    path: '/terms-and-conditions',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function TermsPage() {
  const t = await getTranslations('legalPages.termsAndConditions');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">1. Acceptance of Terms</h2>
      <p>
        By accessing or using the website of Corsair Tactical Solutions, LLC ("Corsair," "we," "us"), or by enrolling in any of our training programs, security services, or private investigation services, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our website or services.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">2. Services Offered</h2>
      <p>Corsair Tactical Solutions provides the following licensed services in the State of Texas:</p>
      <ul>
        <li>Firearms training and education, including Texas License to Carry (LTC) certification</li>
        <li>Security officer training and certification (Level II, III, and IV)</li>
        <li>Private security services (License B29791901)</li>
        <li>Security training school programs (License F30797601)</li>
        <li>Continuing education (License Y30987101)</li>
        <li>Private investigation services (License C31074401)</li>
        <li>Corporate safety and church security consultation</li>
        <li>Custom and specialty firearms training programs</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">3. Eligibility</h2>
      <p>To enroll in our training programs, you must:</p>
      <ul>
        <li>Be at least 18 years of age (21 for certain programs)</li>
        <li>Be legally eligible to possess and handle firearms under federal, state, and local laws</li>
        <li>Not be prohibited from possessing firearms under 18 U.S.C. § 922(g) or Texas law</li>
        <li>Complete any required prerequisite training as specified per course</li>
        <li>Provide valid government-issued photo identification</li>
      </ul>
      <p>
        Corsair Tactical Solutions reserves the right to refuse enrollment or service to any individual who does not meet eligibility requirements or who poses a safety risk.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">4. Enrollment and Registration</h2>
      <p>
        Course enrollment is confirmed upon receipt of payment or deposit as required. Enrollment confirms that you have read and agree to all applicable course policies including the Training Waiver, Safety Disclaimer, and Cancellation & Class Transfer Policy.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">5. Payment Terms</h2>
      <p>
        All course fees must be paid prior to attendance unless a payment arrangement has been made in advance. Pricing is subject to change without notice. Quoted prices are honored for confirmed bookings. We accept major credit/debit cards and other payment methods as specified at booking.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">6. Assumption of Risk and Waiver</h2>
      <p>
        Participation in firearms training involves inherent risks, including the risk of physical injury or death. By enrolling in any Corsair Tactical Solutions program, you acknowledge and accept these risks. A full Training Waiver must be completed before participation. See our <a href="/training-waiver" className="text-corsair-red-500 hover:underline">Training Waiver</a> page for complete terms.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">7. Code of Conduct</h2>
      <p>All participants must:</p>
      <ul>
        <li>Follow all safety rules and instructor commands at all times</li>
        <li>Treat all firearms as if they are loaded</li>
        <li>Wear required eye and ear protection during range activities</li>
        <li>Behave respectfully toward instructors, staff, and fellow students</li>
        <li>Arrive on time and in a physical and mental condition suitable for training</li>
        <li>Not be under the influence of alcohol or drugs of any kind</li>
      </ul>
      <p>
        Corsair Tactical Solutions reserves the right to immediately remove any participant who violates safety rules or the code of conduct, without refund.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">8. Intellectual Property</h2>
      <p>
        All content on this website including text, graphics, logos, course materials, and training curricula is the property of Corsair Tactical Solutions, LLC and is protected by applicable copyright and intellectual property laws. You may not reproduce, distribute, or create derivative works without prior written permission.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">9. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by applicable law, Corsair Tactical Solutions, LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of our services or website. Our total liability for any claim shall not exceed the amount paid by you for the specific service giving rise to the claim.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">10. Certification and Licensing</h2>
      <p>
        Corsair Tactical Solutions is a licensed training provider in the State of Texas. Completion of our courses provides certification as described per course. Certificates are issued only to students who complete all required coursework, demonstrate competency, and meet all legal eligibility requirements. Corsair is not responsible for DPS processing delays or application denials beyond our control.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">11. Governing Law</h2>
      <p>
        These Terms and Conditions shall be governed by and construed in accordance with the laws of the State of Texas. Any disputes arising from these terms shall be resolved in the appropriate courts of Bexar County or Dallas County, Texas.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">12. Changes to Terms</h2>
      <p>
        We reserve the right to modify these Terms and Conditions at any time. Material changes will be posted on this page with an updated effective date. Continued use of our services constitutes acceptance of the updated terms.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">13. Contact</h2>
      <p>
        Questions about these Terms and Conditions may be directed to Corsair Tactical Solutions at <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a> or 214-335-6652.
      </p>
    </LegalPageLayout>
  );
}