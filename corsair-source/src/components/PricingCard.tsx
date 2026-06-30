import Link from 'next/link';

interface PricingCardProps {
  name: string;
  price: number;
  description?: string;
  features?: string[];
  badge?: string;
  savings?: string;
  popular?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function PricingCard({
  name,
  price,
  description,
  features = [],
  badge,
  savings,
  popular = false,
  ctaLabel = 'Book Now',
  ctaHref = '/contact',
}: PricingCardProps) {
  return (
    <div
      className={`relative rounded-xl border-2 p-6 flex flex-col transition-all duration-300 card-hover ${
        popular
          ? 'border-corsair-red-500 bg-white shadow-xl'
          : 'border-corsair-gray-200 bg-white shadow-sm'
      }`}
    >
      {/* Popular badge */}
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="badge-popular">Most Popular</span>
        </div>
      )}

      {/* Badge */}
      {badge && !popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="badge-best-value">{badge}</span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-bold text-corsair-blue-900 text-lg">{name}</h3>
        {description && <p className="text-corsair-gray-500 text-sm mt-1">{description}</p>}
      </div>

      <div className="mb-5">
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black text-corsair-blue-900">${price}</span>
          <span className="text-corsair-gray-400 text-sm mb-1">per person</span>
        </div>
        {savings && (
          <p className="text-green-600 text-sm font-semibold mt-1">💰 {savings}</p>
        )}
      </div>

      {features.length > 0 && (
        <ul className="space-y-2 mb-6 flex-1">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-corsair-gray-600">
              <svg className="w-4 h-4 text-corsair-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      )}

      <Link
        href={ctaHref}
        className={`mt-auto block text-center py-3 rounded-md text-sm font-bold transition-all duration-300 ${
          popular
            ? 'btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white'
            : 'bg-corsair-blue-900 hover:bg-corsair-blue-950 text-white'
        }`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}