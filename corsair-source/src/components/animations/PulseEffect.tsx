'use client';

import { motion } from 'framer-motion';

interface PulseEffectProps {
  children: React.ReactNode;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' };
const ringMap = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-32 h-32' };

export default function PulseEffect({
  children,
  color = 'bg-corsair-red-500',
  size = 'md',
  className = '',
}: PulseEffectProps) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <span className={`absolute inline-flex ${ringMap[size]} rounded-full ${color} opacity-20 animate-ping`} />
      <span className={`relative inline-flex items-center justify-center ${sizeMap[size]} rounded-full ${color} text-white`}>
        {children}
      </span>
    </span>
  );
}

export function RadarPulse({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <motion.div
        className="absolute w-20 h-20 rounded-full border border-corsair-blue-400/30"
        animate={{ scale: [1, 2], opacity: [0.6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute w-20 h-20 rounded-full border border-corsair-blue-400/20"
        animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
      />
      <div className="w-10 h-10 rounded-full bg-corsair-blue-900 flex items-center justify-center">
        <svg className="w-5 h-5 text-corsair-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
    </div>
  );
}

export function ShieldPulse({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <motion.div
        className="absolute w-16 h-16"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-20">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="10 5" />
        </svg>
      </motion.div>
      <div className="w-12 h-12 rounded-full bg-corsair-red-500 flex items-center justify-center shadow-lg shadow-corsair-red-500/30">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
    </div>
  );
}
