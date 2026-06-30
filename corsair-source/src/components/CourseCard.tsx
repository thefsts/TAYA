import Link from 'next/link';
import Image from 'next/image';
import { Course } from '@/lib/courses';
import SeatCounter from '@/components/SeatCounter';
import { getCatalogItemBySlug } from '@/lib/pricing';

export default function CourseCard({ course }: { course: Course }) {
  const catalog = getCatalogItemBySlug(course.slug);
  const isContactOnly = !catalog || catalog.contactOnly;
  const startingPrice = catalog?.basePriceCents != null ? catalog.basePriceCents / 100 : null;
  const requiredFeesTotal = (catalog?.requiredFees ?? []).reduce((sum, f) => sum + f.amountCents / 100, 0);
  const estimatedTotal = startingPrice !== null ? startingPrice + requiredFeesTotal : null;
  const hasRequiredFees = requiredFeesTotal > 0;

  const levelColors: Record<string, string> = {
    Beginner: 'bg-green-100 text-green-700',
    Intermediate: 'bg-yellow-100 text-yellow-700',
    Advanced: 'bg-orange-100 text-orange-700',
    Professional: 'bg-corsair-blue-100 text-corsair-blue-800',
    'All Levels': 'bg-purple-100 text-purple-700',
  };

  const levelColor = levelColors[course.level] || 'bg-corsair-gray-100 text-corsair-gray-700';

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group bg-white rounded-xl border border-corsair-gray-200 overflow-hidden card-hover flex flex-col"
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-corsair-gray-900">
        <Image
          src={course.image}
          alt={course.title}
          fill
          className={`${course.imagePosition === 'object-contain' ? 'object-contain' : `object-cover ${course.imagePosition ?? 'object-top'}`} group-hover:scale-105 transition-transform duration-500`}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${levelColor}`}>
            {course.level}
          </span>
        </div>
        <div className="absolute bottom-3 left-3">
          <span className="bg-corsair-blue-900/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {course.duration}
          </span>
        </div>

        {/* Hover quick-info overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-900/95 via-corsair-blue-900/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4" aria-hidden="true">
          <div className="translate-y-3 group-hover:translate-y-0 transition-transform duration-300">
            <p className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest mb-1">
              {isContactOnly ? 'Contact for Pricing' : estimatedTotal ? `$${estimatedTotal} estimated` : startingPrice !== null ? `From $${startingPrice}` : 'Contact'}
            </p>
            <span className="inline-flex items-center gap-1 bg-corsair-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow">
              View Course →
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-base font-black text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors mb-2 leading-tight line-clamp-2 min-h-[2.75rem]">
          {course.title}
        </h3>
        <p className="text-corsair-gray-500 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
          {course.description}
        </p>

        {/* Key Points */}
        <ul className="space-y-1.5 mb-4">
          {course.keyPoints.slice(0, 3).map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-corsair-gray-600">
              <svg className="w-3.5 h-3.5 text-corsair-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {point}
            </li>
          ))}
        </ul>

        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-4 border-t border-corsair-gray-100 gap-3">
          <div className="min-w-0">
            {isContactOnly || startingPrice === null ? (
              <p className="text-base font-black text-corsair-blue-900 leading-none">
                Contact for Pricing
              </p>
            ) : (
              <>
                <span className="text-[10px] text-corsair-gray-400 uppercase tracking-wide font-semibold">
                  {hasRequiredFees ? 'Starting at' : 'Starting at'}
                </span>
                <p className="text-2xl font-black text-corsair-blue-900 leading-none">${startingPrice}</p>
                {hasRequiredFees && (
                  <div className="mt-1 space-y-0.5">
                    {(course.requiredFees ?? []).map((f) => (
                      <p key={f.id} className="text-[10px] text-corsair-gray-500 leading-tight">
                        + ${f.price} {f.label} <span className="text-corsair-red-500 font-semibold">Required</span>
                      </p>
                    ))}
                    <p className="text-xs font-bold text-corsair-blue-900 leading-tight">
                      Total: ${estimatedTotal}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <span className="btn-red-glow bg-corsair-red-500 text-white px-4 py-2 rounded-md text-xs font-bold group-hover:bg-corsair-red-600 transition-colors shrink-0">
            View Course →
          </span>
        </div>
        <SeatCounter slug={course.slug} className="mt-3" />
      </div>
    </Link>
  );
}
