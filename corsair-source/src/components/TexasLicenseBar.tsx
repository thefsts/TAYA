/**
 * TexasLicenseBar — reusable Texas DPS license display component.
 *
 * variant="section"  — standalone full-width section (homepage, about, contact)
 *   Includes: shield header, compliance statement, 5 license cards, callout strip
 * variant="footer"   — compact strip for use inside the site footer
 */

const LICENSES = [
  { label: 'Instructor License',            number: '161402002' },
  { label: 'Training School License',       number: 'F30797601' },
  { label: 'Continuing Education License',  number: 'Y30987101' },
  { label: 'Business License',             number: 'B29791901' },
  { label: 'Private Investigation License', number: 'C31074401' },
];

interface Props {
  variant?: 'section' | 'footer';
}

export default function TexasLicenseBar({ variant = 'section' }: Props) {
  /* ── Compact footer strip ── */
  if (variant === 'footer') {
    return (
      <div className="border-t border-corsair-blue-900 py-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          {/* Label */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <svg
              className="w-5 h-5 text-corsair-red-400 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            <span className="text-[10px] font-bold text-corsair-gray-400 uppercase tracking-widest whitespace-nowrap">
              Texas License Info
            </span>
          </div>
          {/* License grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-1.5 flex-1">
            {LICENSES.map(({ label, number }) => (
              <div key={number} className="min-w-0">
                <p className="text-[9px] text-corsair-gray-500 uppercase tracking-wider leading-none mb-0.5">{label}</p>
                <p className="text-xs font-black text-corsair-gray-300 font-mono tracking-wide">{number}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Full section ── */
  return (
    <section
      className="bg-corsair-blue-900 border-t border-corsair-blue-800"
      aria-label="Texas Licensing Information"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header row ── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          {/* Shield badge */}
          <div className="w-12 h-12 rounded-xl bg-corsair-red-500/20 border border-corsair-red-500/30 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-6 h-6 text-corsair-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>

          {/* Title + statement */}
          <div className="flex-1">
            <p className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest mb-1">
              State of Texas · Licensed &amp; Regulated
            </p>
            <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-3">
              Texas Licensed Security &amp; Training Provider
            </h2>
            <p className="text-sm text-corsair-gray-300 leading-relaxed max-w-3xl">
              Corsair Tactical Solutions is licensed by the State of Texas to provide security
              services, private investigations, security training, continuing education, and firearms
              instruction. We are committed to maintaining the highest standards of
              professionalism, compliance, and public safety.
            </p>
          </div>
        </div>

        {/* ── License cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {LICENSES.map(({ label, number }) => (
            <div
              key={number}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5"
            >
              <p className="text-[9px] font-bold text-corsair-red-400 uppercase tracking-widest mb-2 leading-tight">
                {label}
              </p>
              <p className="text-sm font-black text-white font-mono tracking-wide break-all">
                {number}
              </p>
            </div>
          ))}
        </div>

        {/* ── Callout strip ── */}
        <div className="border border-white/10 rounded-xl px-5 py-3 bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-0">
            {[
              'State Licensed',
              'Professionally Trained',
              'Trusted Protection Solutions',
            ].map((item, i, arr) => (
              <span key={item} className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">{item}</span>
                {i < arr.length - 1 && (
                  <span className="text-corsair-red-500 text-sm font-black mx-1" aria-hidden="true">•</span>
                )}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[10px] font-bold text-corsair-gray-400 uppercase tracking-widest">
              Licensed &amp; Insured
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
