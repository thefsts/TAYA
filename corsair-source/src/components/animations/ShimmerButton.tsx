'use client';

import { motion } from 'framer-motion';

interface ShimmerButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

const baseStyles = {
  primary:   'bg-corsair-red-500 hover:bg-corsair-red-600 text-white',
  secondary: 'bg-corsair-blue-900 hover:bg-corsair-blue-800 text-white',
  outline:   'border-2 border-corsair-red-500 text-corsair-red-500 hover:bg-corsair-red-500 hover:text-white',
};

export default function ShimmerButton({
  children,
  href,
  onClick,
  className = '',
  variant = 'primary',
}: ShimmerButtonProps) {
  const Component = href ? motion.a : motion.button;
  const props = href ? { href } : { onClick, type: 'button' as const };

  return (
    <Component
      {...props}
      className={`relative overflow-hidden inline-flex items-center gap-2 font-bold px-6 py-3 rounded-xl transition-colors duration-300 group ${baseStyles[variant]} ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="relative z-10">{children}</span>
      {/* Light sweep */}
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
      {/* Ripple on click */}
      <motion.span
        className="absolute inset-0 rounded-xl bg-white/20 pointer-events-none"
        initial={{ scale: 0, opacity: 0.5 }}
        whileTap={{ scale: 2, opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
    </Component>
  );
}
