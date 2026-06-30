'use client';

import { useRef } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';

interface EnhancedScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none' | 'scale';
  duration?: number;
  once?: boolean;
  margin?: string;
}

const variants: Record<string, { hidden: object; visible: object }> = {
  up:     { hidden: { opacity: 0, y: 40 },  visible: { opacity: 1, y: 0 } },
  down:   { hidden: { opacity: 0, y: -40 }, visible: { opacity: 1, y: 0 } },
  left:   { hidden: { opacity: 0, x: 40 },  visible: { opacity: 1, x: 0 } },
  right:  { hidden: { opacity: 0, x: -40 }, visible: { opacity: 1, x: 0 } },
  none:   { hidden: { opacity: 0 },           visible: { opacity: 1 } },
  scale:  { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } },
};

export default function EnhancedScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = 0.6,
  once = true,
  margin = '-60px',
}: EnhancedScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: margin as any });
  const variant = variants[direction] || variants.up;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variant as Variants}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
    >
      {children}
    </motion.div>
  );
}
