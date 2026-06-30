'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import FloatingElements from '@/components/FloatingElements';

/* ───────────────────────── Types ───────────────────────── */

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface CTAButton {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'phone';
  phone?: string;
}

interface StatItem {
  value: string;
  label: string;
}

interface PageHeroProps {
  /** Eyebrow badge text (e.g. "About Us", "Security Services") */
  badge: string;
  /** Main headline — line 1 */
  title1: string;
  /** Main headline — line 2 (rendered in corsair-red) */
  title2?: string;
  /** Descriptive paragraph below the headline */
  subtitle: string;
  /** Background image src (Unsplash URL, local path, etc.) */
  imageSrc: string;
  /** Alt text for the background image */
  imageAlt: string;
  /** Optional separate image for the split card (defaults to imageSrc) */
  cardImageSrc?: string;
  /** Breadcrumb navigation items */
  breadcrumbs?: BreadcrumbItem[];
  /** Call-to-action buttons */
  ctas?: CTAButton[];
  /** Stat badges displayed below CTAs */
  stats?: StatItem[];
  /** Small floating card data (image + label + sublabel) */
  floatingCard?: {
    imageSrc: string;
    imageAlt: string;
    label: string;
    sublabel: string;
  };
  /** Extra content rendered below the subtitle (e.g. urgency bar) */
  children?: React.ReactNode;
  /** Use the "section" floating-elements variant instead of "hero" */
  floatingVariant?: 'hero' | 'section' | 'minimal';
  /** Whether this hero uses a split layout (text left / image right on lg) */
  splitLayout?: boolean;
  /** Flip the portrait card image horizontally (fix mirrored logos/text in photos) */
  mirrorCard?: boolean;
}

/* ─────────────────── Animation Variants ─────────────────── */

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const imageRevealVariants = {
  hidden: { opacity: 0, scale: 1.08, x: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.3 },
  },
};

/* ─────────────────────── Component ─────────────────────── */

export default function PageHero({
  badge,
  title1,
  title2,
  subtitle,
  imageSrc,
  imageAlt,
  cardImageSrc,
  breadcrumbs = [],
  ctas = [],
  stats = [],
  floatingCard,
  children,
  floatingVariant = 'hero',
  splitLayout = true,
  mirrorCard = false,
}: PageHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-corsair-blue-950 overflow-hidden"
    >
      {/* ── Background layers ── */}
      <motion.div className="absolute inset-0" style={{ y: bgY }}>
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover object-top"
          sizes="100vw"
          priority
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-br from-corsair-blue-950/92 via-corsair-blue-950/85 to-corsair-blue-950/80" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-corsair-red-500/5 to-transparent" />

      <FloatingElements variant={floatingVariant} />

      {/* ── Content ── */}
      <motion.div
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24 lg:py-32"
        style={{ opacity: contentOpacity }}
      >
        <div
          className={
            splitLayout
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-16 items-center'
              : 'max-w-3xl'
          }
        >
          {/* ── Text Column ── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="order-2 lg:order-1"
          >
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <motion.nav
                variants={itemVariants}
                aria-label="Breadcrumb"
                className="flex items-center gap-2 mb-5"
              >
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && (
                      <span className="text-corsair-gray-600">/</span>
                    )}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="text-corsair-gray-400 hover:text-white text-sm transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-corsair-red-400 text-sm font-medium">
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ))}
              </motion.nav>
            )}

            {/* Badge */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-2 bg-corsair-red-500/15 border border-corsair-red-500/25 text-corsair-red-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-400 animate-pulse" />
                {badge}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-5xl lg:text-[3.5rem] font-black text-white leading-[1.1] mb-5"
            >
              {title1}
              {title2 && (
                <>
                  <br />
                  <span className="text-corsair-red-400 text-glow-red">
                    {title2}
                  </span>
                </>
              )}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-lg md:text-xl text-white/70 font-medium leading-relaxed max-w-xl mb-8"
            >
              {subtitle}
            </motion.p>

            {/* Extra children (urgency bar, etc.) */}
            {children && (
              <motion.div variants={itemVariants}>{children}</motion.div>
            )}

            {/* CTAs */}
            {ctas.length > 0 && (
              <motion.div
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-4 mb-10"
              >
                {ctas.map((cta, i) => {
                  if (cta.variant === 'phone') {
                    return (
                      <a
                        key={i}
                        href={`tel:${cta.phone || '+12143356652'}`}
                        className="border-2 border-white/30 hover:border-white/60 text-white hover:bg-white/10 px-8 py-4 rounded-xl text-base font-bold transition-all duration-300 text-center flex items-center justify-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        {cta.label}
                      </a>
                    );
                  }
                  if (cta.variant === 'secondary') {
                    return (
                      <Link
                        key={i}
                        href={cta.href}
                        className="border-2 border-white/30 hover:border-white/60 text-white hover:bg-white/10 px-8 py-4 rounded-xl text-base font-bold transition-all duration-300 text-center"
                      >
                        {cta.label}
                      </Link>
                    );
                  }
                  return (
                    <Link
                      key={i}
                      href={cta.href}
                      className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-xl text-base font-bold transition-all duration-300 text-center flex items-center justify-center gap-2"
                    >
                      {cta.label}
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  );
                })}
              </motion.div>
            )}

            {/* Stats */}
            {stats.length > 0 && (
              <motion.div
                variants={itemVariants}
                className="flex flex-wrap gap-8"
              >
                {stats.map((stat, i) => (
                  <div key={i} className="text-left">
                    <div className="text-2xl lg:text-3xl font-black text-white">
                      {stat.value}
                    </div>
                    <div className="text-xs text-white/50 font-medium uppercase tracking-wider mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>

          {/* ── Image Column (split layout only) ── */}
          {splitLayout && (
            <motion.div
              variants={imageRevealVariants}
              initial="hidden"
              animate="visible"
              className="order-1 lg:order-2"
            >
              <div className="relative">
                {/* Accent shapes */}
                <div className="absolute -bottom-4 -right-4 w-full h-full bg-corsair-red-500/15 rounded-2xl hidden lg:block" />
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-corsair-blue-800/40 rounded-2xl hidden lg:block" />

                {/* Main image card */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl h-56 sm:h-72 md:h-auto md:aspect-[4/5] lg:aspect-[3/4]">
                  <Image
                    src={cardImageSrc ?? imageSrc}
                    alt={imageAlt}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                    style={mirrorCard ? { transform: 'scaleX(-1)' } : undefined}
                  />
                  {/* Subtle gradient overlay on image */}
                  <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/30 via-transparent to-transparent" />
                </div>

                {/* Floating card */}
                {floatingCard && (
                  <div className="hidden lg:flex absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-3 items-center gap-3 z-10">
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={floatingCard.imageSrc}
                        alt={floatingCard.imageAlt}
                        width={56}
                        height={56}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-black text-corsair-blue-900">
                        {floatingCard.label}
                      </p>
                      <p className="text-xs text-corsair-gray-500">
                        {floatingCard.sublabel}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ── Bottom gradient fade ── */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
