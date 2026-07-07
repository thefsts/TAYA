'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
  Fragment,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlideLayout = 'darkstatement' | 'mosaic' | 'editorial';

interface Slide {
  id: number;
  layout: SlideLayout;
  eyebrow: string;
  headline: string;
  /** Words that rotate in the accent position */
  rotatingWords: string[];
  subheadline: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  image: string;
  imageAlt: string;
  image2?: string;
  image2Alt?: string;
  /** When true, renders the image as a contained logo instead of a Ken-Burns photo */
  isLogo?: boolean;
}

// ─── Slide Data ───────────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  {
    id: 1,
    layout: 'darkstatement',
    eyebrow: 'Corsair Tactical Solutions — Texas',
    headline: 'Security Solutions Built on Experience, Training & Accountability',
    rotatingWords: ['Armed Security Officers', 'Executive Protection', 'Church Security Programs', 'Property Management Security', 'Private Investigations'],
    subheadline:
      'Professional security services throughout Texas — specializing in armed security, executive protection, church security, property management, and private investigations. Powered by our proven 4D Protection Model™.',
    ctaPrimary: { label: 'Schedule a Consultation', href: '/contact' },
    ctaSecondary: { label: 'Request a Proposal', href: '/contact' },
    image: '/corsair-logo-transparent.png',
    imageAlt: 'Corsair Tactical Solutions Logo',
    isLogo: true,
  },
  {
    id: 2,
    layout: 'mosaic',
    eyebrow: 'Texas DPS Certified Training',
    headline: 'Security Officer Training',
    rotatingWords: ['& Certification', '— Level II · III · IV', '— Church Safety', '— Armed & Unarmed'],
    subheadline:
      'Launch your career with DPS-certified programs — Level II, III & IV armed security, church safety, and professional development courses.',
    ctaPrimary: { label: 'View Security Training', href: '/security-training' },
    ctaSecondary: { label: 'Register Today', href: '/contact' },
    image: '/images/corsair-real/hero-corsair-training-outdoor-01.jpg',
    imageAlt: 'Corsair instructor briefing security trainees at outdoor shooting range',
  },
  {
    id: 3,
    layout: 'editorial',
    eyebrow: 'Texas DPS Certified · LTC Instructor',
    headline: 'Texas License to Carry',
    rotatingWords: ['Certification Classes', 'All Skill Levels', 'Starting at $100', 'Get Licensed Today'],
    subheadline:
      'State-certified instruction, shooting proficiency qualification, and everything you need to carry legally in Texas — all skill levels welcome.',
    ctaPrimary: { label: 'View LTC Classes', href: '/courses/texas-ltc-certification-basic-handgun' },
    ctaSecondary: { label: 'Upcoming Events', href: '/events' },
    image: '/images/corsair-real/group-range-training-01.jpg',
    imageAlt: 'Texas LTC class — group range training',
  },
];

// ─── Shared Hooks & Components ────────────────────────────────────────────────

/**
 * Typewriter: types `text` character-by-character, then pauses, then erases.
 * Returns the current display string.
 */
function useTypewriter(text: string, typingSpeed = 48, eraseSpeed = 28, pauseMs = 1800) {
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing');

  useEffect(() => {
    setDisplayed('');
    setPhase('typing');
  }, [text]);

  useEffect(() => {
    if (phase === 'typing') {
      if (displayed.length < text.length) {
        const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), typingSpeed);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setPhase('pause'), pauseMs);
        return () => clearTimeout(t);
      }
    }
    if (phase === 'pause') {
      const t = setTimeout(() => setPhase('erasing'), 200);
      return () => clearTimeout(t);
    }
    if (phase === 'erasing') {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), eraseSpeed);
        return () => clearTimeout(t);
      }
    }
  }, [displayed, phase, text, typingSpeed, eraseSpeed, pauseMs]);

  return { displayed, done: phase === 'pause' };
}

/**
 * BulletCursor — a side-profile bullet that bobs forward while typing,
 * idles with a slow drift when paused. Themed for a tactical/security brand.
 */
function BulletCursor({ dark, typing }: { dark: boolean; typing: boolean }) {
  const accent = dark ? '#f87171' : '#ef4444';
  const nose   = dark ? '#fca5a5' : '#dc2626';
  return (
    <motion.span
      className="inline-flex items-center align-middle ml-1"
      aria-hidden="true"
      animate={
        typing
          ? { x: [0, 4, 0], rotate: [0, -3, 0] }
          : { x: [0, 1.5, 0], rotate: 0 }
      }
      transition={
        typing
          ? { duration: 0.18, repeat: Infinity, ease: 'easeOut' }
          : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
      }
    >
      {/* Bullet SVG: nose right, body left */}
      <svg
        width="22"
        height="10"
        viewBox="0 0 22 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* Brass casing */}
        <rect x="0" y="2.5" width="13" height="5" rx="1.2" fill={accent} />
        {/* Projectile nose */}
        <path d="M13 2.5 L22 5 L13 7.5 Z" fill={nose} />
        {/* Casing groove line */}
        <rect x="10" y="3.5" width="1" height="3" rx="0.5" fill="rgba(0,0,0,.25)" />
      </svg>
    </motion.span>
  );
}

/**
 * RotatingWord: cycles through `words` array.
 * When the current word finishes typing & erasing → moves to next word.
 */
function RotatingWord({ words, dark }: { words: string[]; dark: boolean }) {
  const [idx, setIdx] = useState(0);
  const { displayed, done } = useTypewriter(words[idx], 52, 30, 2000);
  const [typing, setTyping] = useState(true);

  // Watch for full-erase completion to advance word
  const prevDisplayed = useRef(displayed);
  useEffect(() => {
    setTyping(displayed.length > 0 && !done);
    if (prevDisplayed.current.length > 0 && displayed.length === 0) {
      setIdx((i) => (i + 1) % words.length);
    }
    prevDisplayed.current = displayed;
  }, [displayed, words.length, done]);

  return (
    <span
      className={dark ? 'text-corsair-red-400' : 'text-corsair-red-500'}
      style={{ textShadow: dark ? '0 0 40px rgba(239,68,68,.35)' : 'none' }}
    >
      {displayed}
      <BulletCursor dark={dark} typing={typing} />
    </span>
  );
}

/**
 * ShootInText: each CHARACTER fires in from the right with a slight rotation
 * that settles at 0 — like impact of a bullet hitting the screen.
 * Characters are grouped by word inside a whitespace-nowrap wrapper so the
 * browser cannot break a word mid-letter (single-char orphan fix).
 * Re-animates whenever `triggerKey` changes.
 */
function StaggeredWords({ text, dark, triggerKey }: { text: string; dark: boolean; triggerKey: string | number }) {
  const words = text.split(' ');
  const colorCls = dark ? 'text-white/65' : 'text-corsair-blue-950/65';

  let globalIdx = 0;
  return (
    <span className="inline">
      {words.map((word, wi) => {
        const chars = word.split('');
        const wordStart = globalIdx;
        globalIdx += chars.length + 1; // +1 for the trailing space
        return (
          <Fragment key={`${triggerKey}-w${wi}`}>
          <span
            className="inline-flex whitespace-nowrap"
          >
            {chars.map((ch, ci) => {
              const idx = wordStart + ci;
              return (
                <motion.span
                  key={`${triggerKey}-${idx}`}
                  initial={{ opacity: 0, x: 18, rotate: -12, scale: 0.7 }}
                  animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                  transition={{
                    delay: 0.28 + idx * 0.018,
                    duration: 0.22,
                    ease: [0.16, 1.2, 0.5, 1] as [number, number, number, number],
                  }}
                  className={`inline-block ${colorCls}`}
                >
                  {ch}
                </motion.span>
              );
            })}
          </span>{wi < words.length - 1 ? ' ' : ''}
          </Fragment>
        );
      })}
    </span>
  );
}

/**
 * KenBurns: wraps an image and applies a slow zoom + slight pan CSS animation.
 * `animKey` forces a restart every slide change.
 */
const KenBurns = memo(function KenBurns({
  src, alt, sizes, priority = false, animKey,
}: {
  src: string; alt: string; sizes: string; priority?: boolean; animKey: string | number;
}) {
  return (
    <div key={animKey} className="absolute inset-0 ken-burns-container overflow-hidden">
      <div className="ken-burns-inner w-full h-full relative">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-center"
          sizes={sizes}
          priority={priority}
        />
      </div>
    </div>
  );
});

// ─── Slide 1: DARK STATEMENT ──────────────────────────────────────────────────

function DarkStatementSlide({ slide, triggerKey }: { slide: Slide; triggerKey: number }) {
  const stats = [
    { value: 'All 50', label: 'States Served' },
    { value: '24 / 7', label: 'Available' },
    { value: '100%', label: 'Licensed & Insured' },
  ];

  return (
    <div
      className="relative min-h-[600px] flex items-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050c15 0%, #08111e 60%, #0a1628 100%)' }}
    >
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />
      {/* Red corner glow */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(circle at 80% 20%, rgba(239,68,68,.12) 0%, transparent 65%)' }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {([
          { left: '7%',  bottom: '-8px', delay: '0s',   dur: '18s', size: 3 },
          { left: '18%', bottom: '-8px', delay: '3.5s', dur: '14s', size: 2 },
          { left: '33%', bottom: '-8px', delay: '7s',   dur: '21s', size: 4 },
          { left: '52%', bottom: '-8px', delay: '1.5s', dur: '16s', size: 2 },
          { left: '67%', bottom: '-8px', delay: '9s',   dur: '23s', size: 3 },
          { left: '80%', bottom: '-8px', delay: '4.5s', dur: '15s', size: 2 },
          { left: '91%', bottom: '-8px', delay: '11s',  dur: '19s', size: 3 },
        ] as Array<{left:string;bottom:string;delay:string;dur:string;size:number}>).map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-corsair-red-500/25 animate-float-up"
            style={{ left: p.left, bottom: p.bottom, width: `${p.size}px`, height: `${p.size}px`, animationDelay: p.delay, animationDuration: p.dur }}
          />
        ))}
      </div>

      {/* LEFT: content */}
      <motion.div
        key={triggerKey}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative z-10 flex-1 px-6 sm:px-10 lg:px-16 py-16 lg:max-w-[60%]"
      >
        {/* Ghost "50" */}
        <div
          aria-hidden="true"
          className="absolute left-6 lg:left-14 top-1/2 -translate-y-1/2 select-none pointer-events-none leading-none font-black text-white"
          style={{ fontSize: 'clamp(14rem, 22vw, 22rem)', opacity: 0.032, letterSpacing: '-0.06em' }}
        >
          50
        </div>

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="relative flex items-center gap-3 mb-6"
        >
          <span className="inline-flex items-center gap-2 bg-corsair-red-500/15 border border-corsair-red-500/30 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-400 animate-pulse" />
            <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-[0.2em]">{slide.eyebrow}</span>
          </span>
        </motion.div>

        {/* Headline line 1 — words stagger in */}
        <h1 className="relative text-[2.2rem] sm:text-[2.9rem] lg:text-[3.6rem] font-black text-white leading-[1.04] mb-3 tracking-tight">
          <motion.span
            key={`hl-${triggerKey}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            className="block"
          >
            {slide.headline}
          </motion.span>
          {/* Rotating / typewriter accent */}
          <motion.span
            key={`rw-${triggerKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="block"
          >
            <RotatingWord words={slide.rotatingWords} dark />
          </motion.span>
        </h1>

        {/* Rule */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-0.5 w-12 bg-corsair-red-500 rounded-full" />
          <div className="h-px flex-1 bg-white/8 rounded-full" />
        </div>

        {/* Subheadline — staggered words */}
        <p className="relative text-sm sm:text-base leading-relaxed mb-8 max-w-lg">
          <StaggeredWords text={slide.subheadline} dark triggerKey={triggerKey} />
        </p>

        {/* CTAs */}
        <motion.div
          key={`cta-${triggerKey}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.45 }}
          className="relative flex flex-col sm:flex-row gap-3 mb-10"
        >
          <Link
            href={slide.ctaPrimary.href}
            className="inline-flex items-center justify-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
            style={{ boxShadow: '0 8px 30px rgba(239,68,68,.35)' }}
          >
            {slide.ctaPrimary.label}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href={slide.ctaSecondary.href}
            className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/50 text-white/80 hover:text-white hover:bg-white/8 px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
          >
            {slide.ctaSecondary.label}
          </Link>
        </motion.div>

        {/* Stat chips */}
        <motion.div
          key={`stats-${triggerKey}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="relative flex flex-wrap gap-2"
        >
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-full px-4 py-1.5">
              <span className="text-sm font-black text-white">{s.value}</span>
              <span className="text-[10px] text-white/45 font-medium uppercase tracking-wider">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* RIGHT: logo or portrait */}
      <motion.div
        key={`img-${triggerKey}`}
        initial={{ opacity: 0, x: 40, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: 'easeOut', delay: 0.15 }}
        className="absolute right-0 top-0 bottom-0 w-[42%] hidden lg:block"
      >
        {slide.isLogo ? (
          /* ── Logo panel: futuristic target-lock ──────────────────── */
          <div
            className="absolute inset-0 overflow-hidden flex items-center justify-center"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0 100%, 0 10%)' }}
          >
            {/* Pulsing radial glow — brightens on lock */}
            <motion.div
              key={`glow-${triggerKey}`}
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 1, 0.5, 1] }}
              transition={{ delay: 0.65, duration: 1.4, times: [0, 0.35, 0.55, 0.75, 1] }}
              style={{ background: 'radial-gradient(ellipse at 58% 50%, rgba(239,68,68,.22) 0%, rgba(239,68,68,.06) 45%, transparent 68%)' }}
            />

            {/* ── Logo: shoots across from left, bounces on landing ── */}
            <motion.div
              key={`logo-${triggerKey}`}
              className="relative z-10 flex items-center justify-center"
              initial={{ x: -680, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ x: { duration: 0.5, ease: [0.12, 1, 0.3, 1] as [number, number, number, number], delay: 0.2 }, opacity: { duration: 0.15, delay: 0.2 } }}
            >
              {/* Inner bounce on landing */}
              <motion.div
                key={`bounce-${triggerKey}`}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.08, 0.95, 1.03, 1] }}
                transition={{ delay: 0.68, duration: 0.55, times: [0, 0.3, 0.55, 0.78, 1], ease: 'easeOut' }}
              >
                {/* Logo image — bigger */}
                <div className="relative w-80 h-80 lg:w-[22rem] lg:h-[22rem]">
                  <Image
                    src={slide.image}
                    alt={slide.imageAlt}
                    fill
                    className="object-contain"
                    style={{ filter: 'drop-shadow(0 0 28px rgba(239,68,68,.5)) drop-shadow(0 8px 40px rgba(0,0,0,.9))' }}
                    priority
                    sizes="38vw"
                  />
                </div>
              </motion.div>

              {/* ── Impact pulse rings fire outward on landing ── */}
              {([0, 0.12, 0.26] as const).map((d, i) => (
                <motion.div
                  key={`ring-${i}-${triggerKey}`}
                  className="absolute inset-0 rounded-full border border-corsair-red-500 pointer-events-none"
                  initial={{ scale: 0.7, opacity: 0.85 }}
                  animate={{ scale: 2.8 + i * 0.5, opacity: 0 }}
                  transition={{ delay: 0.68 + d, duration: 0.85, ease: 'easeOut' }}
                />
              ))}

              {/* ── Targeting reticle: outer circle shrinks to lock ── */}
              <motion.div
                key={`reticle-outer-${triggerKey}`}
                className="absolute inset-[-22px] rounded-full border border-corsair-red-500/55 pointer-events-none"
                initial={{ scale: 2.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.62, duration: 0.42, ease: [0.2, 0.9, 0.3, 1] as [number, number, number, number] }}
              />
              {/* Inner reticle */}
              <motion.div
                key={`reticle-inner-${triggerKey}`}
                className="absolute inset-[-8px] rounded-full border border-corsair-red-400/30 pointer-events-none"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.72, duration: 0.28 }}
              />

              {/* ── Crosshair lines ── */}
              {/* top */}
              <motion.div key={`ch-t-${triggerKey}`}
                className="absolute left-1/2 -translate-x-px w-px bg-corsair-red-500/75 pointer-events-none origin-bottom"
                style={{ bottom: '100%', marginBottom: 26 }}
                initial={{ height: 0, opacity: 0 }} animate={{ height: 22, opacity: 1 }}
                transition={{ delay: 0.74, duration: 0.18 }} />
              {/* bottom */}
              <motion.div key={`ch-b-${triggerKey}`}
                className="absolute left-1/2 -translate-x-px w-px bg-corsair-red-500/75 pointer-events-none origin-top"
                style={{ top: '100%', marginTop: 26 }}
                initial={{ height: 0, opacity: 0 }} animate={{ height: 22, opacity: 1 }}
                transition={{ delay: 0.74, duration: 0.18 }} />
              {/* left */}
              <motion.div key={`ch-l-${triggerKey}`}
                className="absolute top-1/2 -translate-y-px h-px bg-corsair-red-500/75 pointer-events-none origin-right"
                style={{ right: '100%', marginRight: 26 }}
                initial={{ width: 0, opacity: 0 }} animate={{ width: 22, opacity: 1 }}
                transition={{ delay: 0.76, duration: 0.18 }} />
              {/* right */}
              <motion.div key={`ch-r-${triggerKey}`}
                className="absolute top-1/2 -translate-y-px h-px bg-corsair-red-500/75 pointer-events-none origin-left"
                style={{ left: '100%', marginLeft: 26 }}
                initial={{ width: 0, opacity: 0 }} animate={{ width: 22, opacity: 1 }}
                transition={{ delay: 0.76, duration: 0.18 }} />

              {/* ── Corner brackets snap in ── */}
              <motion.div key={`br-tl-${triggerKey}`} className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-2 border-l-2 border-corsair-red-400 pointer-events-none"
                initial={{ opacity: 0, x: -10, y: -10 }} animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.78, type: 'spring', stiffness: 600, damping: 18 }} />
              <motion.div key={`br-tr-${triggerKey}`} className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-2 border-r-2 border-corsair-red-400 pointer-events-none"
                initial={{ opacity: 0, x: 10, y: -10 }} animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.78, type: 'spring', stiffness: 600, damping: 18 }} />
              <motion.div key={`br-bl-${triggerKey}`} className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-2 border-l-2 border-corsair-red-400 pointer-events-none"
                initial={{ opacity: 0, x: -10, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.78, type: 'spring', stiffness: 600, damping: 18 }} />
              <motion.div key={`br-br-${triggerKey}`} className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-2 border-r-2 border-corsair-red-400 pointer-events-none"
                initial={{ opacity: 0, x: 10, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.78, type: 'spring', stiffness: 600, damping: 18 }} />

              {/* ── TARGET LOCKED badge ── */}
              <motion.div
                key={`locked-${triggerKey}`}
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95, duration: 0.3 }}
              >
                <div className="flex items-center gap-1.5 bg-black/50 border border-corsair-red-500/50 backdrop-blur-sm rounded px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-400 animate-pulse flex-shrink-0" />
                  <span className="text-[9px] font-black text-corsair-red-400 uppercase tracking-[0.28em]">Target Locked</span>
                </div>
              </motion.div>
            </motion.div>

            {/* ── Scan line sweeps top-to-bottom, then repeats ── */}
            <motion.div
              key={`scan-${triggerKey}`}
              className="absolute left-0 right-0 h-0.5 pointer-events-none z-20"
              style={{ top: 0, background: 'linear-gradient(to right, transparent, rgba(239,68,68,.75) 40%, rgba(239,68,68,.75) 60%, transparent)' }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: [0, 620], opacity: [0, 1, 1, 0] }}
              transition={{ delay: 0.82, duration: 1.3, ease: 'linear', times: [0, 0.06, 0.94, 1], repeat: Infinity, repeatDelay: 3.5 }}
            />

            {/* Left-edge gradient overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to right, #050c15 0%, rgba(5,12,21,.5) 18%, transparent 52%)' }} />
          </div>
        ) : (
          /* ── Photo / Ken-Burns panel ─────────────────────────────── */
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0 100%, 0 10%)' }}
          >
            <KenBurns src={slide.image} alt={slide.imageAlt} sizes="42vw" priority animKey={triggerKey} />
            <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(to right, #050c15 0%, rgba(5,12,21,.55) 20%, transparent 55%)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-32 z-10" style={{ background: 'linear-gradient(to top, #050c15 0%, transparent 100%)' }} />
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset -3px 0 0 rgba(239,68,68,.35), inset 0 -3px 0 rgba(239,68,68,.2)' }} />
        <div className="absolute bottom-10 right-6 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5 shadow-xl">
          <svg className="w-4 h-4 text-corsair-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-xs font-bold text-white">Licensed · Bonded · Insured</span>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Slide 2: DUAL MOSAIC ─────────────────────────────────────────────────────

function MosaicSlide({ slide, triggerKey }: { slide: Slide; triggerKey: number }) {
  const features = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'Level II · III · IV Programs',
      desc: 'Unarmed through armed personal protection officer certification',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: 'Church & Venue Safety',
      desc: 'Specialized active-threat and congregation protection training',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      title: 'Texas DPS State Certified',
      desc: 'Fully state-licensed instructor with 12+ years of experience',
    },
  ];

  return (
    <div
      className="relative min-h-[580px] flex flex-col lg:flex-row overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #070f1c 0%, #0b1525 55%, #0e1c30 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(239,68,68,.07) 0%, transparent 55%)' }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 40px)' }} />

      {/* LEFT */}
      <motion.div
        key={triggerKey}
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-14 lg:w-[52%]"
      >
        {/* Eyebrow */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }} className="flex items-center gap-2 mb-6">
          <div className="h-4 w-0.5 rounded-full bg-corsair-red-500" />
          <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-[0.22em]">{slide.eyebrow}</span>
        </motion.div>

        {/* Headline */}
        <h1 className="text-[2.2rem] sm:text-[2.8rem] lg:text-[3.2rem] font-black text-white leading-[1.04] mb-4 tracking-tight">
          <motion.span
            key={`hl2-${triggerKey}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
            className="block"
          >
            {slide.headline}
          </motion.span>
          <motion.span
            key={`rw2-${triggerKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.3 }}
            className="block"
          >
            <RotatingWord words={slide.rotatingWords} dark />
          </motion.span>
        </h1>

        <p className="text-sm text-white/50 leading-relaxed mb-8 max-w-md">
          <StaggeredWords text={slide.subheadline} dark triggerKey={triggerKey} />
        </p>

        {/* Features */}
        <div className="space-y-4 mb-9">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.1, duration: 0.4 }}
              className="flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-corsair-red-500/12 border border-corsair-red-500/25 flex items-center justify-center flex-shrink-0 text-corsair-red-400">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">{f.title}</p>
                <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTAs */}
        <motion.div
          key={`cta2-${triggerKey}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link
            href={slide.ctaPrimary.href}
            className="inline-flex items-center justify-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
            style={{ boxShadow: '0 6px 24px rgba(239,68,68,.3)' }}
          >
            {slide.ctaPrimary.label}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href={slide.ctaSecondary.href}
            className="inline-flex items-center justify-center border border-white/18 hover:border-white/45 text-white/75 hover:text-white hover:bg-white/6 px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
          >
            {slide.ctaSecondary.label}
          </Link>
        </motion.div>
      </motion.div>

      {/* RIGHT: single full-height image */}
      <motion.div
        key={`mosaic-${triggerKey}`}
        initial={{ opacity: 0, x: 30, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        className="relative flex-1 min-h-[300px] lg:min-h-0 hidden lg:block overflow-hidden"
      >
        <div className="absolute left-0 top-[15%] bottom-[15%] w-0.5 bg-gradient-to-b from-transparent via-corsair-red-500/50 to-transparent rounded-full z-10" />
        <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ clipPath: 'polygon(5% 0, 100% 0, 100% 95%, 95% 100%, 0 100%)' }}>
          <KenBurns src={slide.image} alt={slide.imageAlt} sizes="48vw" priority animKey={`${triggerKey}-single`} />
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent to-[#070f1c]/40" />
          <div className="absolute top-3 right-3 z-20 bg-black/50 backdrop-blur-sm border border-white/15 rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">DPS Certified</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Slide 3: EDITORIAL ───────────────────────────────────────────────────────

function EditorialSlide({ slide, triggerKey }: { slide: Slide; triggerKey: number }) {
  const trust = ['Veteran-Owned', 'NRA · USCCA Certified', 'TX State-Certified', 'Licensed & Insured'];
  const stats = [
    { value: '500+', label: 'Students Licensed' },
    { value: '5.0★', label: 'Google Rating' },
    { value: '$100', label: 'Starting Price' },
  ];

  return (
    <div className="min-h-[580px] flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT: Editorial content */}
      <motion.div
        key={triggerKey}
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative flex-1 lg:max-w-[54%] flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-14 bg-[#f4f6f9]"
      >
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(239,68,68,.06) 0%, transparent 60%)' }} />
        <div className="relative">
          {/* Eyebrow */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="flex items-center gap-3 mb-5">
            <div className="w-1 h-12 rounded-full bg-corsair-red-500" />
            <div>
              <p className="text-[9px] font-bold text-corsair-red-500 uppercase tracking-[0.25em] mb-0.5">Texas License to Carry</p>
              <p className="text-[10px] font-bold text-corsair-blue-950/50 uppercase tracking-widest">{slide.eyebrow}</p>
            </div>
          </motion.div>

          {/* Headline */}
          <h1 className="text-[2.8rem] sm:text-[3.5rem] lg:text-[4rem] font-black text-corsair-blue-950 leading-[0.95] mb-5 tracking-tight">
            <motion.span
              key={`hl3-${triggerKey}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="block"
            >
              {slide.headline}
            </motion.span>
            <motion.span
              key={`rw3-${triggerKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.48, duration: 0.3 }}
              className="block"
            >
              <RotatingWord words={slide.rotatingWords} dark={false} />
            </motion.span>
          </h1>

          {/* Rule */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-corsair-blue-950/15" />
            <span className="text-[10px] text-corsair-blue-950/40 uppercase tracking-widest font-bold">Texas Law · Range Qualification · All Skill Levels</span>
            <div className="h-px flex-1 bg-corsair-blue-950/15" />
          </div>

          <p className="text-sm sm:text-base leading-relaxed mb-8 max-w-lg">
            <StaggeredWords text={slide.subheadline} dark={false} triggerKey={triggerKey} />
          </p>

          {/* Stats */}
          <motion.div
            key={`stats3-${triggerKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex items-center gap-6 mb-8 pb-8 border-b border-corsair-blue-950/10"
          >
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-corsair-blue-950">{s.value}</div>
                <div className="text-[10px] text-corsair-blue-950/50 font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            key={`cta3-${triggerKey}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 mb-8"
          >
            <Link
              href={slide.ctaPrimary.href}
              className="inline-flex items-center justify-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-md shadow-corsair-red-500/20"
            >
              {slide.ctaPrimary.label}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href={slide.ctaSecondary.href}
              className="inline-flex items-center justify-center border-2 border-corsair-blue-950/20 hover:border-corsair-blue-950/50 text-corsair-blue-950 hover:bg-corsair-blue-950/5 px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
            >
              {slide.ctaSecondary.label}
            </Link>
          </motion.div>

          {/* Trust pills */}
          <motion.div
            key={`trust3-${triggerKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.72, duration: 0.4 }}
            className="flex flex-wrap gap-2"
          >
            {trust.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-corsair-blue-950/10 rounded-full px-3 py-1 text-[11px] font-bold text-corsair-blue-950 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0" />
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* RIGHT: Full-height photo with Ken Burns */}
      <motion.div
        key={`img3-${triggerKey}`}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative flex-1 min-h-[340px] lg:min-h-0 overflow-hidden"
      >
        <KenBurns src={slide.image} alt={slide.imageAlt} sizes="50vw" animKey={triggerKey} />
        <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(to right, rgba(244,246,249,1) 0%, rgba(244,246,249,.2) 15%, transparent 35%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-20 z-10 bg-gradient-to-t from-[#f4f6f9]/60 to-transparent" />
      </motion.div>
    </div>
  );
}

// ─── Carousel Shell ───────────────────────────────────────────────────────────

interface HeroCarouselProps {
  cmsSlide0Headline?: string;
  cmsSlide0Subheadline?: string;
}

const HeroCarousel = ({
  cmsSlide0Headline,
  cmsSlide0Subheadline,
}: HeroCarouselProps) => {
  // If the CMS provides a headline/subheadline override for the first slide,
  // merge it in so dashboard edits appear on the live site without a deploy.
  const slides = useMemo(() => {
    if (!cmsSlide0Headline && !cmsSlide0Subheadline) return SLIDES;
    return SLIDES.map((s, i) =>
      i === 0
        ? {
            ...s,
            ...(cmsSlide0Headline ? { headline: cmsSlide0Headline } : {}),
            ...(cmsSlide0Subheadline ? { subheadline: cmsSlide0Subheadline } : {}),
          }
        : s,
    );
  }, [cmsSlide0Headline, cmsSlide0Subheadline]);

  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [triggerKey, setTriggerKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const AUTOPLAY_MS = 8000;
  const PROGRESS_STEP = 50;

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const scrollOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  // Parallax: content shifts up slightly on scroll
  const scrollY = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setProgress(0);
      setTimeout(() => {
        setCurrent(index);
        setTriggerKey((k) => k + 1);
        setIsTransitioning(false);
      }, 380);
    },
    [isTransitioning],
  );

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo, slides.length]);
  const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, goTo, slides.length]);

  const resetAutoplay = useCallback(() => {
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    let elapsed = 0;
    progressRef.current = setInterval(() => {
      elapsed += PROGRESS_STEP;
      setProgress(Math.min((elapsed / AUTOPLAY_MS) * 100, 100));
    }, PROGRESS_STEP);
    intervalRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
      setTriggerKey((k) => k + 1);
      setProgress(0);
    }, AUTOPLAY_MS);
  }, []);

  useEffect(() => {
    resetAutoplay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [resetAutoplay]);

  useEffect(() => { setProgress(0); }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { prev(); resetAutoplay(); }
      else if (e.key === 'ArrowRight') { next(); resetAutoplay(); }
    };
    const el = sectionRef.current;
    if (el) { el.setAttribute('tabindex', '0'); el.addEventListener('keydown', onKey); }
    return () => { if (el) el.removeEventListener('keydown', onKey); };
  }, [prev, next, resetAutoplay]);

  const pauseAutoplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  };

  const onTouchStart = (e: React.TouchEvent) => { touchEndRef.current = null; touchStartRef.current = e.targetTouches[0].clientX; };
  const onTouchMove  = (e: React.TouchEvent) => { touchEndRef.current = e.targetTouches[0].clientX; };
  const onTouchEnd   = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const d = touchStartRef.current - touchEndRef.current;
    if (d > 50) { next(); resetAutoplay(); }
    else if (d < -50) { prev(); resetAutoplay(); }
  };

  const slide  = slides[current];
  const isDark = slide.layout !== 'editorial';

  return (
    <section
      ref={sectionRef}
      className="relative outline-none overflow-hidden"
      onMouseEnter={pauseAutoplay}
      onMouseLeave={resetAutoplay}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-label="Featured services carousel"
      role="region"
    >
      {/* Parallax + fade wrapper */}
      <motion.div style={{ opacity: scrollOpacity, y: scrollY }}>
        {/* AnimatePresence for crossfade between slides */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: 'easeInOut' }}
          >
            {slide.layout === 'darkstatement' && <DarkStatementSlide slide={slide} triggerKey={triggerKey} />}
            {slide.layout === 'mosaic'         && <MosaicSlide        slide={slide} triggerKey={triggerKey} />}
            {slide.layout === 'editorial'      && <EditorialSlide     slide={slide} triggerKey={triggerKey} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Controls */}
      <div className="absolute bottom-5 left-0 right-0 z-30">
        <div className="max-w-[180px] mx-auto mb-3">
          <div className={`h-0.5 rounded-full overflow-hidden ${isDark ? 'bg-white/12' : 'bg-corsair-blue-950/12'}`}>
            <div className="h-full bg-corsair-red-500 rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { prev(); resetAutoplay(); }}
            aria-label="Previous slide"
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-corsair-red-400 ${isDark ? 'bg-white/8 hover:bg-white/20 border-white/15' : 'bg-black/6 hover:bg-black/15 border-corsair-blue-950/18'}`}
          >
            <svg className={`w-3.5 h-3.5 ${isDark ? 'text-white' : 'text-corsair-blue-950'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex gap-2" role="tablist">
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => { goTo(i); resetAutoplay(); }}
                className={`rounded-full transition-all duration-300 focus:outline-none ${i === current ? 'w-7 h-2.5 bg-corsair-red-500' : isDark ? 'w-2.5 h-2.5 bg-white/22 hover:bg-white/45' : 'w-2.5 h-2.5 bg-corsair-blue-950/18 hover:bg-corsair-blue-950/40'}`}
              />
            ))}
          </div>

          <button
            onClick={() => { next(); resetAutoplay(); }}
            aria-label="Next slide"
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-corsair-red-400 ${isDark ? 'bg-white/8 hover:bg-white/20 border-white/15' : 'bg-black/6 hover:bg-black/15 border-corsair-blue-950/18'}`}
          >
            <svg className={`w-3.5 h-3.5 ${isDark ? 'text-white' : 'text-corsair-blue-950'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slide counter */}
      <div className={`absolute top-5 right-5 z-30 flex items-center gap-1 rounded-lg px-2.5 py-1.5 backdrop-blur-sm text-sm ${isDark ? 'bg-black/35 text-white' : 'bg-white/70 text-corsair-blue-950'}`}>
        <span className="font-black">{String(current + 1).padStart(2, '0')}</span>
        <span className="opacity-40 text-xs mx-0.5">/</span>
        <span className="opacity-50 text-xs">{String(slides.length).padStart(2, '0')}</span>
      </div>
    </section>
  );
};

export default HeroCarousel;
