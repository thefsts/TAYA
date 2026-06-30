'use client';

import { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(targetDate: string): TimeLeft | null {
  // Count down to 8:00 AM on the event date (local time)
  const target = new Date(`${targetDate}T08:00:00`);
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export default function EventCountdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(calcTimeLeft(targetDate));
    const id = setInterval(() => {
      const t = calcTimeLeft(targetDate);
      setTimeLeft(t);
      if (!t) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  // Suppress hydration mismatch — only render after mount
  if (!mounted || !timeLeft) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const units = [
    { label: 'Days',    value: timeLeft.days,    padded: false },
    { label: 'Hours',   value: timeLeft.hours,   padded: true  },
    { label: 'Mins',    value: timeLeft.minutes, padded: true  },
    { label: 'Secs',    value: timeLeft.seconds, padded: true  },
  ];

  return (
    <div className="bg-corsair-blue-900 text-white rounded-2xl p-5 shadow-sm">
      <p className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest text-center mb-3">
        Class Starts In
      </p>
      <div className="grid grid-cols-4 gap-2">
        {units.map(({ label, value, padded }) => (
          <div key={label} className="text-center bg-white/10 rounded-xl py-3 px-1">
            <p className="text-2xl font-black leading-none tabular-nums">
              {padded ? pad(value) : value}
            </p>
            <p className="text-[10px] text-corsair-gray-300 font-bold uppercase tracking-wider mt-1">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
