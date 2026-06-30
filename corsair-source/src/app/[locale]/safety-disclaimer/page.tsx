import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.safetyDisclaimer' });
  return buildPageMetadata({
    path: '/safety-disclaimer',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function SafetyDisclaimerPage() {
  const t = await getTranslations('legalPages.safetyDisclaimer');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">1. Inherent Risk of Firearms Training</h2>
      <p>
        Firearms training, including all activities conducted by Corsair Tactical Solutions, LLC, involves the use of deadly weapons and inherently carries risk of serious injury or death. No amount of training, instruction, or safety equipment can completely eliminate these risks.
      </p>
      <p>
        By participating in any Corsair Tactical Solutions training program, you acknowledge and accept that the activity involves inherent risks. Corsair Tactical Solutions takes every reasonable precaution to minimize these risks through professional instruction, enforced safety protocols, and proper equipment requirements.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">2. Mandatory Safety Rules</h2>
      <p>
        All students, observers, and visitors present during any Corsair Tactical Solutions training activity must comply with the following mandatory safety rules at all times. These rules are non-negotiable:
      </p>
      <ul>
        <li><strong>Treat Every Firearm as Loaded:</strong> Never assume a firearm is unloaded. Handle every firearm with the care due a loaded weapon at all times.</li>
        <li><strong>Never Muzzle Anything You Are Not Willing to Destroy:</strong> Maintain muzzle discipline at all times. Keep the firearm pointed in a safe direction.</li>
        <li><strong>Keep Your Finger Off the Trigger:</strong> Your trigger finger must remain straight, outside the trigger guard, until you have made the decision to fire and your sights are on the target.</li>
        <li><strong>Know Your Target and Beyond:</strong> Positively identify your target and be aware of what is in front of, behind, and around it before discharging a firearm.</li>
        <li><strong>Wear Eye and Ear Protection:</strong> ANSI-rated eye protection and adequate hearing protection are mandatory during all live-fire activities without exception.</li>
        <li><strong>No Alcohol or Drugs:</strong> The use of alcohol, controlled substances, or any medication that impairs judgment is strictly prohibited before and during all training activities.</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">3. Legal Compliance Requirement</h2>
      <p>
        All participants in Corsair Tactical Solutions training programs are required to comply with all applicable local, state, and federal laws regarding firearms ownership, possession, transport, and use. This includes but is not limited to:
      </p>
      <ul>
        <li>Federal law under 18 U.S.C. § 922 regarding prohibited persons</li>
        <li>Texas Penal Code Chapter 46 regarding unlawful carrying and weapons offenses</li>
        <li>Texas Government Code Chapter 411 regarding the License to Carry program</li>
        <li>All applicable local ordinances in the jurisdiction where training takes place</li>
        <li>All regulations applicable to security professionals under Texas Occupations Code Chapter 1702</li>
      </ul>
      <p>
        Corsair Tactical Solutions is not responsible for any participant's violation of applicable laws. It is each participant's sole responsibility to ensure their eligibility and legal compliance.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">4. Training Does Not Guarantee Performance</h2>
      <p>
        Completion of any Corsair Tactical Solutions training program, including Texas LTC certification, does not guarantee or warrant performance in real-world defensive situations. Training provides skills, knowledge, and practice — real-world outcomes depend on many factors beyond training including stress response, environmental conditions, and individual physical and mental state at the time of an incident.
      </p>
      <p>
        Corsair Tactical Solutions makes no representations or warranties that completion of our training will ensure success in any real-world application of firearms skills. Continued practice and ongoing training are strongly recommended.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">5. Certification Requirements May Vary</h2>
      <p>
        Certification requirements for Texas License to Carry, security licensing, and other professional credentials are established by the Texas Department of Public Safety (DPS) and other regulatory authorities. These requirements may change at any time. Corsair Tactical Solutions provides training that meets current certification standards but is not responsible for:
      </p>
      <ul>
        <li>Changes in state or federal certification requirements after course completion</li>
        <li>DPS processing times or application outcomes</li>
        <li>Denial of licensure due to background check results or eligibility issues</li>
        <li>Reciprocity or recognition of Texas certifications in other states</li>
        <li>Changes to licensing requirements in other jurisdictions</li>
      </ul>
      <p>
        Students are encouraged to verify current requirements directly with the relevant licensing authority before enrolling in a certification course.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">6. Medical and Physical Fitness</h2>
      <p>
        Participation in firearms training requires a level of physical and mental fitness sufficient to safely handle firearms. Participants with medical conditions that may affect their ability to safely participate are advised to consult with a physician before enrolling. Corsair Tactical Solutions instructors are trained in basic emergency response and Stop the Bleed, but are not medical professionals.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">7. Website Content Disclaimer</h2>
      <p>
        Information provided on the Corsair Tactical Solutions website is for general informational purposes only and should not be construed as legal advice regarding firearms laws, self-defense law, or any other legal matter. Laws regarding firearms vary significantly by jurisdiction and change frequently. Always consult a qualified attorney for advice specific to your situation.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">8. Contact</h2>
      <p>
        Questions about our safety policies or requirements can be directed to Steve Hopwood at Corsair Tactical Solutions:
      </p>
      <ul>
        <li><strong>Phone:</strong> 214-335-6652</li>
        <li><strong>Email:</strong> <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a></li>
      </ul>
    </LegalPageLayout>
  );
}