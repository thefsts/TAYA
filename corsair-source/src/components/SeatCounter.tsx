'use client';

import { useEffect, useState } from 'react';

interface SeatData {
  registered: number;
  max: number | null;
  available: number | null;
  isFull: boolean;
}

export default function SeatCounter({ slug, className = '' }: { slug: string; className?: string }) {
  const [data, setData]       = useState<SeatData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/seats?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d: SeatData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-corsair-gray-100 animate-pulse ${className}`}>
        <span className="w-2 h-2 rounded-full bg-corsair-gray-300" />
        <span className="text-[10px] text-corsair-gray-400 font-bold uppercase tracking-wide">Checking seats…</span>
      </div>
    );
  }

  if (!data || data.max === null) return null;

  const { registered, max, available, isFull } = data;
  const pct = Math.round((registered / max) * 100);

  const isCritical = available !== null && available <= 3;
  const isLow      = available !== null && available <= 6 && !isCritical;

  const dotColor  = isFull     ? 'bg-gray-400'
                  : isCritical ? 'bg-corsair-red-500 animate-pulse'
                  : isLow      ? 'bg-amber-400 animate-pulse'
                  :              'bg-emerald-400';

  const textColor = isFull     ? 'text-gray-500'
                  : isCritical ? 'text-corsair-red-600'
                  : isLow      ? 'text-amber-600'
                  :              'text-emerald-700';

  const bgColor   = isFull     ? 'bg-gray-100 border-gray-200'
                  : isCritical ? 'bg-red-50 border-corsair-red-200'
                  : isLow      ? 'bg-amber-50 border-amber-200'
                  :              'bg-emerald-50 border-emerald-200';

  const label = isFull
    ? 'Class Full — Join Waitlist'
    : isCritical
    ? `Only ${available} seat${available === 1 ? '' : 's'} left!`
    : isLow
    ? `${available} seats remaining`
    : `${available} of ${max} seats open`;

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${bgColor} ${textColor}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        {label}
      </div>
      <div className="h-1 rounded-full bg-corsair-gray-200 overflow-hidden w-full">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFull ? 'bg-gray-400'
            : isCritical ? 'bg-corsair-red-500'
            : isLow ? 'bg-amber-400'
            : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
