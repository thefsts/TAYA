'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import FloatingElements from '@/components/FloatingElements';
import PageHero from '@/components/PageHero';
import { getCmsTeam, type CmsTeamMember } from '@/lib/cms';

const instructorKeys = ['steve', 'hilton', 'casilda', 'shannon'] as const;

const instructorImages: Record<string, string> = {
  steve: '/images/corsair-real/meet-steve-hopwood.jpg',
  hilton: '/images/corsair-real/hilton-jackson-bio-01.jpg',
  casilda: '/images/corsair-real/dr-casilda-maxwell.jpg',
  shannon: '/images/instructors/shannon-gulley.jpg',
};

const instructorLinks: Partial<Record<typeof instructorKeys[number], string>> = {
  hilton: 'https://www.gideontrainingsolutions.com/',
  casilda: 'https://lowkeydefense.com/#home',
};

const instructorObjectFit: Partial<Record<typeof instructorKeys[number], string>> = {
  steve: 'object-contain object-center',
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

const serviceVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.04,
      duration: 0.4,
      ease: 'easeOut' as const,
    },
  }),
};

export default function InstructorsPage() {
  const t = useTranslations('instructors');
  const tn = useTranslations('nav');
  const [cmsTeam, setCmsTeam] = useState<CmsTeamMember[]>([]);

  useEffect(() => {
    getCmsTeam().then((members) => {
      if (members.length > 0) setCmsTeam(members);
    }).catch(() => {});
  }, []);

  const allianceServices: string[] = (t.raw('allianceServices') as string[]).filter(Boolean);

  return (
    <>
      {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/instructors-hero-main-01.png"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('about'), href: '/about' },
          { label: tn('instructors') },
        ]}
        ctas={[
          { label: t('hero.cta'), href: '/courses', variant: 'primary' },
          { label: '📞 214-335-6652', href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
      />

      {/* ── Instructor Cards ── */}
      <section className="bg-corsair-gray-100 py-20 relative overflow-hidden">
        <FloatingElements variant="minimal" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mb-4">
              {t('teamSection.title')}
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('teamSection.subtitle')}
            </p>
          </motion.div>

          <div className="space-y-12">
            {cmsTeam.length > 0 ? cmsTeam
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((member, i) => (
                <motion.div
                  key={member.id}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={cardVariants}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden border border-corsair-gray-200 card-glow group"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0">
                    {member.photoUrl ? (
                      <div className="relative h-80 lg:h-auto lg:min-h-[360px] bg-corsair-blue-900 overflow-hidden">
                        <Image
                          src={member.photoUrl}
                          alt={member.name}
                          fill
                          className="object-cover object-top group-hover:scale-105 transition-transform duration-700"
                          sizes="(max-width: 1024px) 100vw, 280px"
                        />
                      </div>
                    ) : (
                      <div className="h-80 lg:h-auto lg:min-h-[360px] bg-corsair-blue-900 flex items-center justify-center">
                        <span className="text-6xl font-black text-white/20">{member.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="p-8 lg:p-10 flex flex-col justify-center">
                      <h3 className="text-2xl md:text-3xl font-black text-corsair-blue-900 mb-1">{member.name}</h3>
                      {member.role && (
                        <p className="text-corsair-red-500 font-bold text-sm uppercase tracking-widest mb-4">{member.role}</p>
                      )}
                      {member.bio && (
                        <p className="text-corsair-gray-600 leading-relaxed mb-6">{member.bio}</p>
                      )}
                      {member.credentials && member.credentials.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-corsair-blue-900 uppercase tracking-widest mb-3">
                            Certifications & Credentials
                          </h4>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                            {member.credentials.map((cred) => (
                              <li key={cred} className="flex items-center gap-2 text-sm text-corsair-gray-600">
                                <svg className="w-4 h-4 text-corsair-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {cred}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )) : instructorKeys.map((key, i) => {
              const credentials: string[] = (t.raw(`instructors.${key}.credentials`) as string[]).filter(Boolean);
              return (
                <motion.div
                  key={key}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={cardVariants}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden border border-corsair-gray-200 card-glow group"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0">
                    {/* Photo */}
                    <div className="relative h-80 lg:h-auto lg:min-h-[360px] bg-corsair-blue-900 overflow-hidden">
                      <Image
                        src={instructorImages[key]}
                        alt={t(`instructors.${key}.imageAlt`)}
                        fill
                        className={`${instructorObjectFit[key] ?? 'object-cover object-top'} group-hover:scale-105 transition-transform duration-700`}
                        sizes="(max-width: 1024px) 100vw, 280px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/70 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-corsair-blue-950/30" />
                      {/* Glow accent */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-corsair-red-500 via-corsair-red-400 to-corsair-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>

                    {/* Content */}
                    <div className="p-6 md:p-8">
                      <h3 className="text-2xl font-black text-corsair-blue-900 mb-1">
                        {instructorLinks[key] ? (
                          <a href={instructorLinks[key]} target="_blank" rel="noopener noreferrer"
                             className="hover:text-corsair-red-500 transition-colors">
                            {t(`instructors.${key}.name`)} <span className="text-base font-normal opacity-50">↗</span>
                          </a>
                        ) : t(`instructors.${key}.name`)}
                      </h3>
                      <p className="text-corsair-red-500 font-bold text-sm uppercase tracking-wide mb-4">{t(`instructors.${key}.role`)}</p>
                      <p className="text-corsair-gray-600 leading-relaxed mb-6">{t(`instructors.${key}.bio`)}</p>
                      <div>
                        <h4 className="text-xs font-bold text-corsair-blue-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
                          {t('certificationsLabel')}
                        </h4>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                          {credentials.map((cred) => (
                            <li key={cred} className="flex items-start gap-2 text-sm text-corsair-gray-700">
                              <svg className="w-4 h-4 text-corsair-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {cred}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Alliance Network ── */}
      <section className="bg-white py-20 relative overflow-hidden">
        <FloatingElements variant="section" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mb-4">
              {t('allianceSection.title')}
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('allianceSection.subtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allianceServices.map((service, i) => (
              <motion.div
                key={service}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={serviceVariants}
                className="flex items-center gap-3 bg-corsair-gray-50 rounded-lg p-4 border border-corsair-gray-200 glow-border"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-corsair-red-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-corsair-blue-900">{service}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-corsair-blue-900 py-16 relative overflow-hidden">
        <FloatingElements variant="minimal" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-black text-white mb-4"
          >
            {t('cta.title')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-white/75 text-lg mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            {t('cta.subtitle')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/courses"
              className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-lg text-base font-bold transition-all duration-300 glow-pulse"
            >
              {t('cta.button')} →
            </Link>
            <Link
              href="/contact"
              className="border-2 border-white/60 hover:border-white text-white hover:bg-white/10 px-8 py-4 rounded-lg text-base font-bold transition-all duration-300"
            >
              {t('cta.contact')}
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
