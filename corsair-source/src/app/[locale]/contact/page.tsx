'use client';

import { useState, useEffect } from 'react';
import { getCmsContact, type CmsContact } from '@/lib/cms';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import PageHero from '@/components/PageHero';

export default function ContactPage() {
  const t = useTranslations('contact');
  const tn = useTranslations('nav');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    course: '',
    message: '',
    consent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [cmsContact, setCmsContact] = useState<CmsContact | null>(null);

  useEffect(() => {
    getCmsContact().then((data) => {
      if (data) setCmsContact(data);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          course: formData.course,
          message: formData.message,
        }),
      });
    } catch {
      // Email errors handled server-side; form advances regardless
    }
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const contactInfo = [
    {
      key: 'phone',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      label: t('info.phone.label'),
      value: cmsContact?.phone ?? t('info.phone.value'),
      sub: t('info.phone.sub'),
      href: cmsContact?.phone ? `tel:${cmsContact.phone.replace(/\s/g, '')}` : 'tel:+12143356652',
    },
    {
      key: 'email',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      label: t('info.email.label'),
      value: cmsContact?.email ?? t('info.email.value'),
      sub: t('info.email.sub'),
      href: cmsContact?.email ? `mailto:${cmsContact.email}` : 'mailto:corsairtacticalsolutions@gmail.com',
    },
    {
      key: 'location',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      label: t('info.location.label'),
      value: cmsContact?.address ?? t('info.location.value'),
      sub: t('info.location.sub'),
      href: null,
    },
  ];

  const hours = cmsContact?.hours && Object.keys(cmsContact.hours).length > 0
    ? Object.entries(cmsContact.hours).map(([day, hoursVal]) => ({ key: day, day, hours: hoursVal }))
    : [
        { key: 'weekdays', day: t('hours.weekdays.day'), hours: t('hours.weekdays.hours') },
        { key: 'saturday', day: t('hours.saturday.day'), hours: t('hours.saturday.hours') },
        { key: 'sunday', day: t('hours.sunday.day'), hours: t('hours.sunday.hours') },
      ];

  const securityOptions = [
    { key: 'securityGeneral',        value: 'security-general' },
    { key: 'securityArmed',          value: 'security-armed' },
    { key: 'securityChurch',         value: 'security-church' },
    { key: 'securityProperty',       value: 'security-property' },
    { key: 'securityExecutive',      value: 'security-executive' },
    { key: 'securityInvestigations', value: 'security-investigations' },
    { key: 'securityCorporate',      value: 'security-corporate' },
    { key: 'securityEvent',          value: 'security-event' },
    { key: 'securityAssessment',     value: 'security-assessment' },
  ];

  const trainingOptions = [
    { key: 'ltc',                value: 'training-ltc' },
    { key: 'securityOfficer',    value: 'training-security-officer' },
    { key: 'handgunBasic',       value: 'training-handgun' },
    { key: 'defensive',          value: 'training-defensive' },
    { key: 'ar15',               value: 'training-ar15' },
    { key: 'shotgun',            value: 'training-shotgun' },
    { key: 'requalification',    value: 'training-requalification' },
    { key: 'privateInstruction', value: 'training-private' },
    { key: 'firstAid',           value: 'training-firstaid' },
    { key: 'otherTraining',      value: 'training-other' },
  ];

  return (
    <>
            {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/group-range-training-01.jpg"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('contact') },
        ]}
      />

      {/* ── Main Content ── */}
      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Left: Contact Info ── */}
            <div className="space-y-6">
              {/* Info cards */}
              {contactInfo.map((item) => (
                <div key={item.key} className="bg-white border border-corsair-gray-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="w-10 h-10 bg-corsair-blue-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-corsair-gray-500 uppercase tracking-wider mb-0.5">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="text-sm font-bold text-corsair-blue-900 hover:text-corsair-red-500 transition-colors truncate block">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-sm font-bold text-corsair-blue-900">{item.value}</p>
                    )}
                    <p className="text-xs text-corsair-gray-500 mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}

              {/* Hours */}
              <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-corsair-blue-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-corsair-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('hours.title')}
                </h3>
                <div className="space-y-1.5 text-xs text-corsair-gray-600">
                  {hours.map((h) => (
                    <div key={h.key} className="flex justify-between">
                      <span className="font-medium text-corsair-gray-700">{h.day}</span>
                      <span>{String(h.hours)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-corsair-blue-900 rounded-2xl p-5">
                <h3 className="text-white font-bold text-sm mb-3">{t('quickActions.title')}</h3>
                <div className="space-y-2">
                  <a
                    href="tel:+12143356652"
                    className="flex items-center gap-2 w-full bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {t('quickActions.call')}
                  </a>
                  <Link
                    href="/courses"
                    className="flex items-center gap-2 w-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors border border-white/10"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {t('quickActions.browseCourses')}
                  </Link>
                </div>
                {/* Social links */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-corsair-gray-400 text-xs font-medium mb-2">{t('quickActions.followUs')}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href="https://www.instagram.com/corsairtacticalsolution?igsh=MTd1MmhkZzZtaWh2MQ=="
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Corsair Tactical Solutions on Instagram"
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-corsair-red-500 flex items-center justify-center text-white transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                      </svg>
                    </a>
                    <a
                      href="https://www.facebook.com/share/17iPFcVg7j/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Corsair Tactical Solutions on Facebook"
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-corsair-red-500 flex items-center justify-center text-white transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                      </svg>
                    </a>
                    <a
                      href="https://www.tiktok.com/@stevehopwood0?_r=1&_t=ZT-96ERuVVLCKU"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Corsair Tactical Solutions on TikTok"
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-corsair-red-500 flex items-center justify-center text-white transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43V13.2a8.19 8.19 0 005.58 2.18v-3.45a4.85 4.85 0 01-3.59-1.39V6.69h3.59z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: Contact Form ── */}
            <div className="lg:col-span-2">
              {isSubmitted ? (
                <div className="bg-white border border-corsair-gray-200 rounded-2xl p-10 text-center shadow-sm">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-corsair-blue-900 mb-2">{t('success.title')}</h3>
                  <p className="text-corsair-gray-600 mb-2">
                    {t('success.message', { name: formData.name })}
                  </p>
                  <p className="text-corsair-gray-500 text-sm mb-7">
                    {t('success.urgentNote')}{' '}
                    <a href="tel:+12143356652" className="text-corsair-red-500 font-bold">214-335-6652</a>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/courses" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3 rounded-xl text-sm font-bold transition-all duration-300">
                      {t('success.browseCourses')} →
                    </Link>
                    <button
                      onClick={() => { setIsSubmitted(false); setFormData({ name: '', email: '', phone: '', course: '', message: '', consent: false }); }}
                      className="border-2 border-corsair-gray-300 text-corsair-gray-600 hover:border-corsair-blue-900 hover:text-corsair-blue-900 px-7 py-3 rounded-xl text-sm font-bold transition-colors"
                    >
                      {t('success.sendAnother')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-corsair-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Form header */}
                  <div className="bg-corsair-blue-900 px-6 py-5">
                    <h2 className="text-lg font-black text-white">{t('form.title')}</h2>
                    <p className="text-corsair-gray-300 text-xs mt-1">{t('form.subtitle')}</p>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Name + Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                          {t('form.nameLabel')} <span className="text-corsair-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder={t('form.namePlaceholder')}
                          className="w-full px-4 py-2.5 border border-corsair-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                          {t('form.phoneLabel')}
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder={t('form.phonePlaceholder')}
                          className="w-full px-4 py-2.5 border border-corsair-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                        {t('form.emailLabel')} <span className="text-corsair-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-corsair-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder={t('form.emailPlaceholder')}
                          className="w-full pl-11 pr-4 py-2.5 border border-corsair-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400"
                        />
                      </div>
                    </div>

                    {/* Course interest */}
                    <div>
                      <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                        {t('form.courseLabel')}
                      </label>
                      <select
                        value={formData.course}
                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                        className="w-full px-4 py-2.5 border border-corsair-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow bg-white text-corsair-gray-700"
                      >
                        <option value="">{t('form.coursePlaceholder')}</option>
                        <optgroup label={t('form.courseOptions.groupSecurity')}>
                          {securityOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t(`form.courseOptions.${opt.key}`)}</option>
                          ))}
                        </optgroup>
                        <optgroup label={t('form.courseOptions.groupTraining')}>
                          {trainingOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t(`form.courseOptions.${opt.key}`)}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                        {t('form.messageLabel')} <span className="text-corsair-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder={t('form.messagePlaceholder')}
                        className="w-full px-4 py-2.5 border border-corsair-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500 focus:border-transparent transition-shadow placeholder:text-corsair-gray-400 resize-none"
                      />
                    </div>

                    {/* Consent checkbox */}
                    <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl px-4 py-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          id="consent"
                          name="consent"
                          checked={formData.consent}
                          onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                          className="mt-0.5 w-4 h-4 rounded border-corsair-gray-300 text-corsair-red-500 focus:ring-corsair-red-500 flex-shrink-0 cursor-pointer"
                          required
                        />
                        <span className="text-xs text-corsair-gray-600 leading-relaxed">
                          {t('form.consent')}
                        </span>
                      </label>
                    </div>

                    {/* Trust note */}
                    <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <p className="text-xs text-corsair-gray-500">
                        {t('form.trustNote')}{' '}
                        <a href="/sms-email-consent-policy" className="text-corsair-red-500 hover:underline">{t('form.smsPolicy')}</a> ·{' '}
                        <a href="/privacy-policy" className="text-corsair-red-500 hover:underline">{t('form.privacyPolicy')}</a>
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 disabled:bg-corsair-gray-400 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {t('form.sending')}
                        </>
                      ) : (
                        <>
                          {t('form.submit')}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
