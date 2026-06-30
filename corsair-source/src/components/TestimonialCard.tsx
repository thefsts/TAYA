interface TestimonialCardProps {
  quote: string;
  name: string;
  title: string;
  rating?: number;
  dark?: boolean;
}

export default function TestimonialCard({
  quote,
  name,
  title,
  rating = 5,
  dark = false,
}: TestimonialCardProps) {
  return (
    <div
      className={`rounded-lg p-6 md:p-8 flex flex-col h-full ${
        dark
          ? 'bg-corsair-blue-900 border border-corsair-blue-800'
          : 'bg-white border border-corsair-gray-200 shadow-sm'
      }`}
    >
      {/* Stars */}
      <div className="flex items-center gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      {/* Quote */}
      <blockquote className={`flex-1 text-sm leading-relaxed italic mb-6 ${dark ? 'text-corsair-gray-300' : 'text-corsair-gray-600'}`}>
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Attribution */}
      <div className="flex items-center gap-3 border-t pt-4 mt-auto" style={{ borderColor: dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
          dark ? 'bg-corsair-blue-800 text-corsair-red-400' : 'bg-corsair-blue-50 text-corsair-blue-900'
        }`}>
          {name.charAt(0)}
        </div>
        <div>
          <p className={`font-bold text-sm ${dark ? 'text-white' : 'text-corsair-gray-800'}`}>{name}</p>
          <p className={`text-xs ${dark ? 'text-corsair-gray-400' : 'text-corsair-gray-500'}`}>{title}</p>
        </div>
      </div>
    </div>
  );
}