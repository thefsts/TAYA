interface DiscountsBannerProps {
  variant?: 'sidebar' | 'full';
  className?: string;
}

const discounts = [
  { label: 'Veteran',            pct: '10%', icon: '🎖️' },
  { label: 'First Responder',    pct: '5%',  icon: '🚒' },
  { label: 'Educator / Teacher', pct: '5%',  icon: '📚' },
];

const DISCLAIMER =
  'Eligible discounts may require verification prior to class attendance.';

export default function DiscountsBanner({
  variant = 'sidebar',
  className = '',
}: DiscountsBannerProps) {
  if (variant === 'sidebar') {
    return (
      <div className={`bg-corsair-blue-950 border border-white/10 rounded-2xl p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-corsair-red-500 animate-pulse flex-shrink-0" />
          <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest">
            Discounts Available
          </span>
        </div>
        <div className="space-y-2.5">
          {discounts.map((d) => (
            <div key={d.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none">{d.icon}</span>
                <span className="text-xs font-semibold text-white/90">{d.label}</span>
              </div>
              <span className="text-corsair-red-400 font-black text-sm flex-shrink-0">
                {d.pct} off
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-white/40 leading-relaxed">{DISCLAIMER}</p>
      </div>
    );
  }

  return (
    <section className={`py-10 bg-corsair-blue-950 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-corsair-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest">
                Service Discounts
              </span>
            </div>
            <h3 className="text-lg font-black text-white">Discounts Available</h3>
            <p className="text-[11px] text-white/40 mt-1 max-w-xs leading-relaxed">
              {DISCLAIMER}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 flex-1">
            {discounts.map((d) => (
              <div
                key={d.label}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 flex-shrink-0"
              >
                <span className="text-2xl leading-none">{d.icon}</span>
                <div>
                  <p className="text-[11px] text-white/55 font-medium uppercase tracking-wider">
                    {d.label}
                  </p>
                  <p className="text-corsair-red-400 font-black text-xl leading-tight">
                    {d.pct}{' '}
                    <span className="text-sm font-semibold text-white/70">off</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
