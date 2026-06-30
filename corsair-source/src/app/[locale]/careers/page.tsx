import Link from 'next/link';
import Image from 'next/image';
import PageHero from '@/components/PageHero';
import { getTranslations } from 'next-intl/server';
import ScrollReveal, { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';

const benefits = [
  { icon: '🎖️', title: 'Veteran-Led Culture', desc: 'Work alongside military veterans and licensed professionals who take the mission seriously.' },
  { icon: '📋', title: 'Free Level II Training', desc: 'New hires with no prior security experience receive sponsored Level II certification training through Corsair.' },
  { icon: '🔐', title: 'Armed & Unarmed Roles', desc: 'Positions available for both armed (Level III/IV) and unarmed (Level II) security officers.' },
  { icon: '📈', title: 'Career Growth', desc: 'Advance from Level II to Level III/IV. We promote from within and support continuing education.' },
  { icon: '🏛️', title: 'Diverse Assignments', desc: 'Church safety, corporate security, private events, property management, and executive protection.' },
  { icon: '💼', title: 'Flexible Scheduling', desc: 'Full-time and part-time shifts available. Day, evening, and weekend assignments.' },
];

const requirements = [
  'Must be 18 years of age or older',
  'Valid Texas Driver\'s License required',
  'Must be legally eligible to work in the United States',
  'No disqualifying criminal history',
  'Reliable transportation to assignment locations',
  'Professional demeanor and strong communication skills',
  'Must be able to pass a background check',
  'Level II security license required (or willingness to obtain — we can help)',
];

const preferredQuals = [
  'Texas DPS Level II, III, or IV Security License',
  'Prior military or law enforcement experience',
  'Texas License to Carry (LTC)',
  'First Aid / Stop the Bleed certification',
  'Experience in church safety, corporate, or event security',
];

export default async function CareersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tc = await getTranslations({ locale, namespace: 'common' });

  return (
    <>
      <PageHero
        imageSrc="/images/corsair-real/security-team-church-01.jpg"
        imageAlt="Corsair Tactical Solutions security officers on duty"
        badge="Now Hiring"
        title1="Join the Corsair Team"
        subtitle="Build a career in professional security with a veteran-owned Texas company. New security guards welcome — we sponsor Level II training."
        breadcrumbs={[
          { label: tc('home'), href: '/' },
          { label: 'Careers' },
        ]}
      />

      {/* ── Why Join Us ── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Why Corsair</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2 mb-4">
              More Than a Job — A Career in Security
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
              We are a licensed, veteran-owned Texas security company. Whether you are just getting started
              or bringing years of experience, we have a role for you and the support to grow.
            </p>
          </div>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.08}>
            {benefits.map((b, i) => (
              <StaggerItem key={i}>
                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6 hover-lift">
                  <div className="text-3xl mb-3">{b.icon}</div>
                  <h3 className="text-base font-bold text-corsair-blue-900 mb-2">{b.title}</h3>
                  <p className="text-sm text-corsair-gray-600 leading-relaxed">{b.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Open Position ── */}
      <section className="py-16 bg-corsair-gray-50 border-y border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Position card */}
            <div className="bg-white rounded-2xl border border-corsair-gray-200 shadow-sm overflow-hidden">
              <div className="bg-corsair-blue-900 px-6 py-5">
                <span className="inline-block bg-corsair-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded mb-2">
                  Open Position
                </span>
                <h3 className="text-xl font-black text-white">Security Officer</h3>
                <p className="text-corsair-gray-300 text-sm mt-0.5">Level II · Level III · Level IV · Armed &amp; Unarmed</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  {['Texas-Based', 'Full-Time', 'Part-Time', 'New Guards Welcome'].map((tag) => (
                    <span key={tag} className="bg-corsair-blue-50 text-corsair-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-corsair-blue-100">
                      {tag}
                    </span>
                  ))}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-3">Requirements</h4>
                  <ul className="space-y-2">
                    {requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-corsair-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0 mt-1.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-3">Preferred Qualifications</h4>
                  <ul className="space-y-2">
                    {preferredQuals.map((q, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-corsair-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-corsair-blue-400 flex-shrink-0 mt-1.5" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-corsair-red-50 border border-corsair-red-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-corsair-red-700 uppercase tracking-wider mb-1">No License? No Problem.</p>
                  <p className="text-sm text-corsair-red-800 leading-relaxed">
                    We sponsor motivated candidates through our Level II security training program.
                    Complete the application below and we will be in touch about next steps.
                  </p>
                </div>
              </div>
            </div>

            {/* Contact + quick apply */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-corsair-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-corsair-blue-900 mb-4">Questions? Reach Out Directly</h3>
                <div className="space-y-3">
                  <a
                    href="mailto:corsairtacticalsolutions@gmail.com"
                    className="flex items-center gap-3 p-3.5 bg-corsair-gray-50 rounded-xl border border-corsair-gray-200 hover:border-corsair-blue-300 transition-colors group"
                  >
                    <div className="w-9 h-9 bg-corsair-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-corsair-gray-500 font-medium">Email</p>
                      <p className="text-sm font-bold text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors">
                        corsairtacticalsolutions@gmail.com
                      </p>
                    </div>
                  </a>
                  <a
                    href="tel:+12143356652"
                    className="flex items-center gap-3 p-3.5 bg-corsair-gray-50 rounded-xl border border-corsair-gray-200 hover:border-corsair-blue-300 transition-colors group"
                  >
                    <div className="w-9 h-9 bg-corsair-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-corsair-gray-500 font-medium">Phone</p>
                      <p className="text-sm font-bold text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors">
                        (214) 335-6652
                      </p>
                    </div>
                  </a>
                </div>
              </div>

              <div className="bg-corsair-blue-900 rounded-2xl p-6 text-white">
                <h3 className="text-base font-bold mb-2">What to Expect</h3>
                <ol className="space-y-3">
                  {[
                    'Submit the application form below',
                    'We review your application within 2 business days',
                    'Phone or in-person interview with our team',
                    'Background check & license verification',
                    'Orientation and assignment placement',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-corsair-gray-200">
                      <span className="w-5 h-5 rounded-full bg-corsair-red-500 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Application Form (Google Form iframe) ── */}
      <section className="py-16 bg-white" id="apply">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Apply Now</span>
            <h2 className="text-3xl font-black text-corsair-blue-900 mt-2 mb-3">
              Submit Your Application
            </h2>
            <p className="text-corsair-gray-600 text-sm max-w-xl mx-auto">
              Fill out the form below. We review every application and respond within 2 business days.
              Questions? Email us at{' '}
              <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline font-semibold">
                corsairtacticalsolutions@gmail.com
              </a>
            </p>
          </div>

          {/* Apply button */}
          <div className="flex flex-col items-center gap-4">
            <a
              href="https://forms.gle/3PTmsUuXBJVrmCnm7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-10 py-4 rounded-xl text-base font-bold transition-colors shadow-lg shadow-corsair-red-500/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Open Application Form ↗
            </a>
            <p className="text-xs text-corsair-gray-400">Opens in a new tab · Takes about 5 minutes</p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-14 bg-corsair-blue-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">Get Licensed First</span>
          <h2 className="text-3xl font-black text-white mt-2 mb-3">
            Need Your Level II License?
          </h2>
          <p className="text-corsair-gray-300 mb-7 text-sm max-w-xl mx-auto">
            Enroll in our security officer certification courses and start working sooner.
            Level II training is required for all Texas security officers — we can get you there.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/security-training"
              className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
            >
              View Security Training →
            </Link>
            <Link
              href="/contact"
              className="border-2 border-white/50 hover:border-white text-white hover:bg-white/10 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
