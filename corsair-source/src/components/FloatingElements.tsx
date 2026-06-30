'use client';

import { motion } from 'framer-motion';

interface FloatingElementsProps {
  variant?: 'hero' | 'section' | 'minimal';
  className?: string;
}

export default function FloatingElements({ variant = 'hero', className = '' }: FloatingElementsProps) {
  if (variant === 'minimal') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        {/* Single glowing orb */}
        <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-corsair-red-500/10 rounded-full blur-3xl animate-float-slow" />
      </div>
    );
  }

  if (variant === 'section') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        {/* Small floating dots */}
        <motion.div
          className="absolute top-[15%] left-[8%] w-2 h-2 bg-corsair-red-400/40 rounded-full"
          animate={{ y: [-8, 8, -8], x: [-4, 4, -4] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[60%] right-[12%] w-1.5 h-1.5 bg-corsair-red-400/30 rounded-full"
          animate={{ y: [-6, 6, -6], x: [3, -3, 3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute bottom-[25%] left-[20%] w-2.5 h-2.5 bg-corsair-blue-400/20 rounded-full"
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        {/* Subtle glow orbs */}
        <div className="absolute bottom-[10%] right-[25%] w-24 h-24 bg-corsair-red-500/8 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-[40%] left-[5%] w-20 h-20 bg-corsair-blue-400/8 rounded-full blur-3xl animate-float-medium" />
      </div>
    );
  }

  // Full hero variant
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Large ambient glow orbs */}
      <motion.div
        className="absolute -top-20 -left-20 w-80 h-80 bg-corsair-red-500/8 rounded-full blur-3xl"
        animate={{ y: [-30, 30, -30], x: [-15, 15, -15], scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-16 w-64 h-64 bg-corsair-blue-400/8 rounded-full blur-3xl"
        animate={{ y: [20, -20, 20], scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute -bottom-12 left-1/3 w-72 h-72 bg-corsair-red-500/6 rounded-full blur-3xl"
        animate={{ y: [-25, 25, -25], x: [10, -10, 10] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Medium floating shapes */}
      <motion.div
        className="absolute top-[20%] right-[15%] w-3 h-3 bg-corsair-red-400/30 rounded-full"
        animate={{ y: [-15, 15, -15], x: [5, -5, 5] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-[55%] left-[10%] w-2 h-2 bg-white/20 rounded-full"
        animate={{ y: [-12, 12, -12], x: [-8, 8, -8] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
      <motion.div
        className="absolute bottom-[30%] right-[25%] w-2.5 h-2.5 bg-corsair-red-400/20 rounded-full"
        animate={{ y: [-10, 10, -10] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* Small sparkle dots */}
      <motion.div
        className="absolute top-[12%] left-[25%] w-1 h-1 bg-white/40 rounded-full"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-[70%] left-[60%] w-1 h-1 bg-corsair-red-400/50 rounded-full"
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.7, 1.3, 0.7] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute top-[40%] right-[8%] w-1.5 h-1.5 bg-white/25 rounded-full"
        animate={{ opacity: [0.2, 0.8, 0.2], y: [-6, 6, -6] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      />

      {/* Cross-shaped sparkle */}
      <motion.div
        className="absolute top-[15%] right-[30%]"
        animate={{ opacity: [0.3, 0.8, 0.3], rotate: [0, 90, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      >
        <div className="relative w-4 h-4">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/30" />
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white/30" />
        </div>
      </motion.div>

      {/* Diamond shape */}
      <motion.div
        className="absolute bottom-[20%] left-[35%]"
        animate={{ y: [-12, 12, -12], rotate: [0, 180, 360] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-3 h-3 border border-corsair-red-400/20 rotate-45 rounded-[2px]" />
      </motion.div>

      {/* Ring shape */}
      <motion.div
        className="absolute top-[45%] right-[40%]"
        animate={{ y: [-8, 8, -8], scale: [1, 1.1, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      >
        <div className="w-4 h-4 border border-white/15 rounded-full" />
      </motion.div>
    </div>
  );
}