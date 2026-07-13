import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';
import { getCmsDownloads } from '@/lib/cms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/downloads',
    title: 'Downloads & Resources | Corsair Tactical Solutions',
    description:
      'Free downloadable guides, checklists, and planning tools for security professionals, church safety teams, and responsible firearm owners.',
    locale,
  });
}

export default async function DownloadsPage() {
  const t = await getTranslations('common');
  const downloads = await getCmsDownloads();

  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-corsair-blue-900 py-20 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/"
              className="text-corsair-gray-400 hover:text-white text-sm transition-colors"
            >
              {t('home')}
            </Link>
            <span className="text-corsair-gray-600">/</span>
            <span className="text-corsair-red-400 text-sm font-medium">
              Downloads & Resources
            </span>
          </div>
          <div className="max-w-3xl">
            <span className="inline-block bg-corsair-red-500/20 text-corsair-red-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-4">
              Free Resources
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Downloads &amp; Resources
            </h1>
            <p className="text-corsair-gray-300 text-lg leading-relaxed">
              Professional guides, checklists, and planning tools to help you
              stay prepared — from security professionals to responsible
              firearm owners.
            </p>
          </div>
        </div>
      </section>

      {/* ── Resources Grid ── */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {downloads.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-corsair-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-8 h-8 text-corsair-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-black text-corsair-blue-900 mb-2">
                Resources Coming Soon
              </h3>
              <p className="text-corsair-gray-500 text-sm mb-6 max-w-md mx-auto">
                We&apos;re putting together professional guides and planning
                tools for you. Check back soon!
              </p>
              <Link
                href="/contact"
                className="inline-block bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
              >
                Contact Us for Resources →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {downloads
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((res) => (
                  <a
                    key={res.id}
                    href={res.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4 bg-white rounded-2xl border border-corsair-gray-200 p-6 hover:shadow-md hover:border-corsair-red-200 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-corsair-blue-900 flex items-center justify-center text-white shrink-0 group-hover:bg-corsair-red-500 transition-colors">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors leading-snug">
                        {res.title}
                      </h3>
                      {res.description && (
                        <p className="text-xs text-corsair-gray-500 mt-1 leading-relaxed">
                          {res.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        {res.fileFormat && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-corsair-gray-100 text-corsair-gray-600 uppercase">
                            {res.fileFormat}
                          </span>
                        )}
                        {res.fileSize && (
                          <span className="text-[10px] text-corsair-gray-400">
                            {res.fileSize}
                          </span>
                        )}
                        {res.category && (
                          <span className="text-[10px] text-corsair-red-500 font-semibold">
                            {res.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-12 bg-corsair-blue-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-white mb-3">
            Ready to Train with the Best?
          </h2>
          <p className="text-corsair-gray-300 text-sm mb-6">
            Explore our DPS-certified training programs and professional
            security services.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/courses"
              className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3 rounded-xl text-sm font-bold transition-all duration-300"
            >
              View All Courses →
            </Link>
            <Link
              href="/contact"
              className="border-2 border-white/40 hover:border-white text-white px-7 py-3 rounded-xl text-sm font-bold transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
