'use client';

import { useState, useMemo, useEffect } from 'react';
import { getCmsFaqs } from '@/lib/cms';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import FloatingElements from '@/components/FloatingElements';
import PageHero from '@/components/PageHero';

const faqKeys = [
  'general1', 'general2', 'general3', 'general4', 'general5',
  'ltc1', 'ltc2', 'ltc3', 'ltc4', 'ltc5',
  'training1', 'training2', 'training3', 'training4', 'training5', 'training6',
  'pricing1', 'pricing2', 'pricing3', 'pricing4',
] as const;

const categoryColors: Record<string, string> = {
  'General': 'bg-blue-100 text-blue-700',
  'Texas LTC': 'bg-green-100 text-green-700',
  'Training': 'bg-yellow-100 text-yellow-700',
  'Pricing & Booking': 'bg-purple-100 text-purple-700',
};

const categoryKeys = ['all', 'general', 'texasLtc', 'training', 'pricing'] as const;

function FAQItem({ question, answer, category, isOpen, onToggle }: { question: string; answer: string; category: string; isOpen: boolean; onToggle: () => void }) {
  const color = categoryColors[category] || 'bg-gray-100 text-gray-700';
  return (
    <div className="bg-white border border-corsair-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="flex items-start gap-4 px-6 py-5 cursor-pointer select-none hover:bg-corsair-gray-50 transition-colors w-full text-left"
        aria-expanded={isOpen}
      >
        {/* Category badge */}
        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full mt-0.5 hidden sm:inline-block ${color}`}>
          {category}
        </span>
        {/* Question */}
        <span className="flex-1 font-bold text-corsair-blue-900 text-sm leading-snug pr-4">
          {question}
        </span>
        {/* Toggle icon */}
        <span
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors mt-0.5 ${
            isOpen ? 'bg-corsair-red-500' : 'bg-corsair-gray-100'
          }`}
        >
          <svg
            className={`w-3.5 h-3.5 transition-all duration-300 ${
              isOpen ? 'text-white rotate-45' : 'text-corsair-gray-500'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 pt-1">
              {/* Mobile category badge */}
              <span className={`inline-block sm:hidden text-xs font-bold px-2.5 py-1 rounded-full mb-3 ${color}`}>
                {category}
              </span>
              <p className="text-corsair-gray-600 text-sm leading-relaxed">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQPage() {
  const t = useTranslations('faq');
  const tn = useTranslations('nav');

  const [activeCategoryKey, setActiveCategoryKey] = useState<string>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [cmsFaqs, setCmsFaqs] = useState<Array<{ id: string; question: string; answer: string; order: number }>>([]);

  useEffect(() => {
    getCmsFaqs().then((items) => {
      if (items.length > 0) setCmsFaqs(items);
    }).catch(() => {});
  }, []);

  // Build FAQ data from CMS when available, else from translations
  const faqs = useMemo(() => {
    if (cmsFaqs.length > 0) {
      return cmsFaqs
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          key: item.id,
          category: t('categories.general'),
          q: item.question,
          a: item.answer,
        }));
    }
    return faqKeys.map((key) => ({
      key,
      category: t(`faqs.${key}.category`),
      q: t(`faqs.${key}.q`),
      a: t(`faqs.${key}.a`),
    }));
  }, [t, cmsFaqs]);

  const categoryMap: Record<string, string> = {
    all: 'All',
    general: t('categories.general'),
    texasLtc: t('categories.texasLtc'),
    training: t('categories.training'),
    pricing: t('categories.pricing'),
  };

  const activeCategory = categoryMap[activeCategoryKey] || 'All';

  const filteredFaqs = useMemo(() => {
    if (activeCategoryKey === 'all') return faqs;
    return faqs.filter((faq) => faq.category === activeCategory);
  }, [faqs, activeCategoryKey, activeCategory]);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
            {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/steve-classroom-instructor-01.jpg"
        imageAlt={t('hero.imageAlt')}
        floatingVariant="section"
        mirrorCard
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('faq') },
        ]}
      />

      {/* ── Category Filter Pills ── */}
      <section className="bg-white border-b border-corsair-gray-200 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-corsair-gray-500 font-medium">{t('filter')}</span>
            {categoryKeys.map((catKey) => (
              <button
                key={catKey}
                onClick={() => {
                  setActiveCategoryKey(catKey);
                  setOpenIndex(null);
                }}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                  activeCategoryKey === catKey
                    ? 'bg-corsair-blue-900 text-white border-corsair-blue-900 shadow-sm'
                    : 'bg-white text-corsair-gray-600 border-corsair-gray-300 hover:border-corsair-blue-900 hover:text-corsair-blue-900'
                }`}
              >
                {t(`categories.${catKey}`)}
                {catKey !== 'all' && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ({faqs.filter((f) => f.category === categoryMap[catKey]).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ List ── */}
      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Result count */}
          <p className="text-xs text-corsair-gray-400 mb-4 font-medium">
            {filteredFaqs.length} {activeCategoryKey !== 'all' ? `in ${activeCategory}` : ''} question{filteredFaqs.length !== 1 ? 's' : ''}
          </p>

          <div className="space-y-3">
            {filteredFaqs.map((faq, i) => (
              <FAQItem
                key={faq.key}
                question={faq.q}
                answer={faq.a}
                category={faq.category}
                isOpen={openIndex === i}
                onToggle={() => handleToggle(i)}
              />
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-12 bg-corsair-blue-900 rounded-2xl p-8 text-center text-white">
            <div className="w-12 h-12 bg-corsair-red-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-black mb-2">{t('stillQuestions.title')}</h3>
            <p className="text-corsair-gray-300 text-sm mb-6 max-w-md mx-auto">
              {t('stillQuestions.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/contact"
                className="bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3 rounded-xl text-sm font-bold transition-colors"
              >
                {t('stillQuestions.button')} →
              </Link>
              <a
                href="tel:+12143356652"
                className="border-2 border-white/40 hover:border-white text-white px-7 py-3 rounded-xl text-sm font-bold transition-colors"
              >
                📞 214-335-6652
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-12 bg-corsair-gray-50 border-t border-corsair-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-corsair-blue-900 mb-3">{t('cta.title')}</h2>
          <p className="text-corsair-gray-500 text-sm mb-6">{t('cta.subtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/courses" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3 rounded-xl text-sm font-bold transition-all duration-300">
              {t('cta.button')} →
            </Link>
            <Link href="/contact" className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-7 py-3 rounded-xl text-sm font-bold transition-colors">
              {t('cta.contact')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
