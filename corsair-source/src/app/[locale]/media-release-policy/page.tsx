import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.mediaReleasePolicy' });
  return buildPageMetadata({
    path: '/media-release-policy',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function MediaReleasePolicyPage() {
  const t = await getTranslations('legalPages.mediaReleasePolicy');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">1. Overview</h2>
      <p>
        Corsair Tactical Solutions, LLC ("Corsair") may photograph or video record training classes, range activities, demonstrations, and other program events for purposes including marketing, social media, training documentation, and program improvement. This policy describes how media is collected, used, and how participants may opt out.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">2. When Media May Be Captured</h2>
      <p>
        Photos and videos may be taken by Corsair Tactical Solutions instructors or authorized staff during:
      </p>
      <ul>
        <li>Firearms training courses (classroom and range portions)</li>
        <li>Texas License to Carry certification classes</li>
        <li>Security officer training programs</li>
        <li>Private and group training sessions</li>
        <li>Corporate safety and church security workshops</li>
        <li>Specialty training events and demonstrations</li>
        <li>Alliance Training Network events co-hosted by Corsair</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">3. How Media May Be Used</h2>
      <p>
        Media captured during Corsair Tactical Solutions training events may be used for the following purposes:
      </p>
      <ul>
        <li><strong>Marketing and Promotion:</strong> Website, social media profiles (Facebook, Instagram), and digital advertising</li>
        <li><strong>Educational Content:</strong> Training materials, course demonstrations, and curriculum development</li>
        <li><strong>Program Documentation:</strong> Internal records of training sessions and course delivery</li>
        <li><strong>Public Relations:</strong> Press releases, business profiles, and community outreach</li>
      </ul>
      <p>
        Corsair Tactical Solutions will not sell your likeness or personal media to third parties for commercial purposes unrelated to our training and security services.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">4. Consent and Opt-Out</h2>
      <p>
        By enrolling in a Corsair Tactical Solutions training program, you provide general consent for Corsair to capture and use media as described in this policy. However, participation in media capture is entirely voluntary.
      </p>
      <p>
        <strong>How to Opt Out:</strong> If you do not wish to be photographed or recorded, please notify your instructor at the beginning of your class. You may also submit your opt-out preference in advance by:
      </p>
      <ul>
        <li>Contacting us at <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a> before your class date</li>
        <li>Calling 214-335-6652 to speak with Steve directly</li>
        <li>Noting your preference on your course registration form</li>
      </ul>
      <p>
        Your opt-out request will be respected. Opting out will not affect your ability to participate in any training program, nor will it result in any penalty.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">5. Consent for Marketing Use</h2>
      <p>
        Where required by applicable law, Corsair Tactical Solutions will obtain explicit written consent before using identifiable images of participants in advertising or promotional materials. If your image is used for marketing purposes and you have not previously opted out, you will be contacted for consent confirmation.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">6. Participant Photography and Recording</h2>
      <p>
        Participants who wish to photograph or record their own training session for personal use may do so with prior instructor permission. The following restrictions apply:
      </p>
      <ul>
        <li>No photography or recording of other participants without their explicit consent</li>
        <li>No recording of proprietary curriculum content or instructor materials</li>
        <li>Recording must not interfere with safety, training flow, or other participants</li>
        <li>Instructor has final authority to restrict recording at any time on safety grounds</li>
        <li>No live-streaming of range activities without prior written approval</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">7. Social Media Sharing</h2>
      <p>
        We encourage students to share their training achievements on social media. If you post about your Corsair Tactical Solutions training experience:
      </p>
      <ul>
        <li>Please tag us: <strong>@corsairtacticalsolutions</strong> on Facebook and Instagram</li>
        <li>Do not post images that could identify other participants without their consent</li>
        <li>Do not post images showing specific range safety vulnerabilities or facility layouts</li>
        <li>We may share or repost your content with attribution (with your implied consent by tagging us)</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">8. Removal Requests</h2>
      <p>
        If you believe your image has been used in Corsair Tactical Solutions media without proper consent, or if you wish to have your image removed from our website or social media, please contact us immediately:
      </p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a> (Subject: Media Removal Request)</li>
        <li><strong>Phone:</strong> 214-335-6652</li>
      </ul>
      <p>
        We will process removal requests within 5 business days and remove the identified content from our owned and controlled channels. Please note that content that has been shared by third parties may take additional time to fully remove.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">9. Minors</h2>
      <p>
        Corsair Tactical Solutions will not photograph or record individuals who appear to be under the age of 18 without prior written consent from a parent or legal guardian.
      </p>
    </LegalPageLayout>
  );
}