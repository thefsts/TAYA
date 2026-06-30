import LegalPageLayout from '@/components/LegalPageLayout';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.accessibilityStatement' });
  return buildPageMetadata({
    path: '/accessibility-statement',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function AccessibilityStatementPage() {
  const t = await getTranslations('legalPages.accessibilityStatement');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">Our Commitment</h2>
      <p>
        Corsair Tactical Solutions, LLC is committed to ensuring that our website and training services are accessible to all individuals, including those with disabilities. We believe that every person has the right to access safety and self-defense education, regardless of their physical or sensory abilities.
      </p>
      <p>
        We strive to meet or exceed the requirements of the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and to continuously improve the accessibility of our digital and in-person services.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Support for Deaf and Hard-of-Hearing Visitors</h2>
      <div className="bg-corsair-blue-950 text-white rounded-xl p-6 my-6 not-prose">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 bg-corsair-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M9 10a3 3 0 000 4" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-base mb-2">Notice to Deaf and Hard-of-Hearing Visitors</p>
            <p className="text-corsair-gray-300 text-sm leading-relaxed mb-3">
              If you are deaf, hard of hearing, or need assistance accessing training information, contact us and we will provide reasonable communication support. We are committed to making our training programs accessible to all individuals.
            </p>
            <p className="text-corsair-gray-300 text-sm leading-relaxed mb-4">
              We can accommodate deaf and hard-of-hearing students through written communication, visual training aids, and coordination with qualified interpreters where requested in advance.
            </p>
            <Link
              href="/contact"
              className="inline-block bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              Contact Accessibility Support
            </Link>
          </div>
        </div>
      </div>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Captions and Transcripts</h2>
      <p>
        Where video content is used on our website or in our training materials, we are committed to providing accurate captions or transcripts to ensure equal access for deaf and hard-of-hearing individuals. If you encounter video content that lacks captions or a transcript, please contact us and we will prioritize providing accessible alternatives.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Website Accessibility Features</h2>
      <p>Our website includes the following accessibility features:</p>
      <ul>
        <li><strong>Text Size Controls:</strong> Use our accessibility widget (bottom-right corner) to increase or decrease text size</li>
        <li><strong>High Contrast Mode:</strong> Toggle high contrast for improved readability</li>
        <li><strong>Grayscale Mode:</strong> Switch to grayscale display for certain visual needs</li>
        <li><strong>Pause Animations:</strong> Stop all moving elements and animations on the page</li>
        <li><strong>Keyboard Navigation:</strong> Full keyboard navigation support throughout the website</li>
        <li><strong>Screen Reader Compatible:</strong> Semantic HTML, ARIA labels, and descriptive alt text for all images</li>
        <li><strong>Responsive Design:</strong> Fully functional across all screen sizes and assistive devices</li>
        <li><strong>Accessible Forms:</strong> All form fields include proper labels, descriptions, and error messaging</li>
        <li><strong>Skip Navigation:</strong> Keyboard users can skip repetitive navigation elements</li>
        <li><strong>Color Contrast:</strong> Text and interactive elements maintain a minimum 4.5:1 contrast ratio</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">In-Person Training Accommodations</h2>
      <p>We offer reasonable accommodations for in-person training participants with disabilities, including:</p>
      <ul>
        <li>Written and visual instruction supplements available upon request</li>
        <li>Extended time for written portions of certification tests when needed</li>
        <li>Coordination with qualified ASL interpreters (advance notice required — minimum 5 business days)</li>
        <li>One-on-one private training sessions for students who require additional support</li>
        <li>Physical accessibility consideration for training venue selection</li>
      </ul>
      <p>
        To request accommodations, please contact us at least 5 business days before your scheduled training date so we can make appropriate arrangements.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Known Limitations</h2>
      <p>
        While we strive for full accessibility, some areas of our website or third-party integrations may not yet fully meet WCAG 2.1 AA standards. We are actively working to address these limitations. If you encounter an accessibility barrier, please let us know immediately.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Reporting Accessibility Issues</h2>
      <p>
        We welcome your feedback on the accessibility of our website and services. If you experience any accessibility barriers or have suggestions for improvement, please contact us:
      </p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a> (Subject: Accessibility)</li>
        <li><strong>Phone:</strong> 214-335-6652</li>
      </ul>
      <p>
        <strong>Response Commitment:</strong> We will respond to accessibility inquiries within 2 business days and work to resolve reported barriers as quickly as possible, typically within 5–10 business days for website issues.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Formal Complaints</h2>
      <p>
        If you are not satisfied with our response to your accessibility concern, you may contact the U.S. Department of Justice Civil Rights Division at <a href="https://www.ada.gov" target="_blank" rel="noopener noreferrer" className="text-corsair-red-500 hover:underline">www.ada.gov</a> or the Texas Governor's Committee on People with Disabilities at <a href="https://gov.texas.gov/organization/gcpd" target="_blank" rel="noopener noreferrer" className="text-corsair-red-500 hover:underline">gov.texas.gov/organization/gcpd</a>.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">Continuous Improvement</h2>
      <p>
        Corsair Tactical Solutions is committed to ongoing improvement of website and service accessibility. We conduct periodic reviews of our website against WCAG 2.1 AA standards and address identified issues in a timely manner. This Accessibility Statement is reviewed and updated at least annually.
      </p>
    </LegalPageLayout>
  );
}