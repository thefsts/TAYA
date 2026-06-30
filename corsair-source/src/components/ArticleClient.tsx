'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

export default function ArticleClient({ children }: { children: React.ReactNode }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [tocVisible, setTocVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setTocVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Reading progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-corsair-red-500 origin-left z-[60]"
        style={{ scaleX }}
      />

      {/* Mobile sticky TOC trigger */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: tocVisible ? 1 : 0, y: tocVisible ? 0 : 20 }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-corsair-blue-900 text-white shadow-lg flex items-center justify-center md:hidden"
        onClick={() => {
          const articleTop = document.querySelector('article');
          articleTop?.scrollIntoView({ behavior: 'smooth' });
        }}
        aria-label="Back to article top"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      </motion.button>

      {children}
    </>
  );
}
