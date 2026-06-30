import Link from 'next/link';

interface CTABannerProps {
  title: string;
  subtitle?: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  dark?: boolean;
}

export default function CTABanner({
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  dark = false,
}: CTABannerProps) {
  return (
    <section
      className={`py-16 md:py-20 relative overflow-hidden ${
        dark ? 'bg-corsair-blue-950' : 'bg-corsair-red-500'
      }`}
    >
      {/* Background texture */}
      <div className="absolute inset-0 texture-overlay opacity-40" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-white/85 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={primaryHref}
            className={`px-8 py-4 rounded-md text-base font-black transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${
              dark
                ? 'bg-corsair-red-500 hover:bg-corsair-red-600 text-white'
                : 'bg-white text-corsair-red-500 hover:bg-corsair-gray-100'
            }`}
          >
            {primaryLabel}
          </Link>
          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-4 rounded-md text-base font-bold transition-all duration-300"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}