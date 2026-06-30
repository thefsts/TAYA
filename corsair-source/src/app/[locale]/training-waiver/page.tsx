'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAllCourses } from '@/lib/courses';
import { useTranslations } from 'next-intl';

const courses = getAllCourses();

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  driverLicense: string;
  course: string;
  instructor: string;
  acknowledgments: Record<string, boolean>;
  typedSignature: string;
  signatureDate: string;
}

function TrainingWaiverForm() {
  const searchParams = useSearchParams();
  const courseParam = searchParams.get('course') || '';
  const t = useTranslations('waiver');
  const tc = useTranslations('common');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const acknowledgmentIds = [
    'safety-rules',
    'assumption-of-risk',
    'compliance',
    'protection',
    'release',
    'medical',
    'legal-eligibility',
    'binding-agreement',
  ];

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    address: '',
    city: '',
    state: 'TX',
    zip: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    driverLicense: '',
    course: courseParam,
    instructor: 'Steve Hopwood',
    acknowledgments: Object.fromEntries(acknowledgmentIds.map((id) => [id, false])),
    typedSignature: '',
    signatureDate: today,
  });

  useEffect(() => {
    if (courseParam) {
      setFormData((prev) => ({ ...prev, course: courseParam }));
    }
  }, [courseParam]);

  const updateField = useCallback(
    (field: keyof FormData, value: string | boolean | Record<string, boolean>) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const toggleAcknowledgment = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      acknowledgments: {
        ...prev.acknowledgments,
        [id]: !prev.acknowledgments[id],
      },
    }));
  }, []);

  const allAcknowledged = acknowledgmentIds.every((id) => formData.acknowledgments[id]);
  const canProceedStep1 =
    formData.fullName.trim() && formData.email.trim() && formData.phone.trim() &&
    formData.dob && formData.driverLicense.trim();
  const canProceedStep2 = allAcknowledged;
  const canSubmit = formData.typedSignature.trim() && allAcknowledged;

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      ctx.strokeStyle = '#1A3A52';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  useEffect(() => {
    if (drawMode) {
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [drawMode, initCanvas]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPosRef.current = getCanvasPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const pos = getCanvasPos(e);
    if (ctx && lastPosRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPosRef.current = pos;
  };

  const stopDraw = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      let drawnSignatureData = '';
      if (drawMode && canvasRef.current) {
        drawnSignatureData = canvasRef.current.toDataURL('image/png');
      }

      const payload = {
        ...formData,
        drawnSignature: drawnSignatureData,
        submittedAt: new Date().toISOString(),
      };

      const res = await fetch('/api/waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Submission failed');
      setIsSubmitted(true);
    } catch {
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = [
    { num: 1, label: t('steps.studentInfo') },
    { num: 2, label: t('steps.legalAcknowledgments') },
    { num: 3, label: t('steps.signature') },
  ];

  if (isSubmitted) {
    const matchedSlug = courses.find(c => c.title === formData.course)?.slug;
    const continueHref = matchedSlug ? `/courses/${matchedSlug}` : '/courses';
    return (
      <div className="min-h-screen bg-corsair-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-2xl border border-corsair-gray-200 overflow-hidden shadow-lg">
            <div className="bg-green-50 border-b border-green-100 p-8 text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-corsair-blue-900 mb-2">{t('success.title')}</h1>
              <p className="text-corsair-gray-600 text-sm">
                {t('success.description', { course: formData.course || t('success.yourSelectedCourse') })}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-corsair-gray-50 rounded-xl p-4 border border-corsair-gray-200">
                <p className="text-xs font-bold text-corsair-blue-900 uppercase tracking-wider mb-3">{t('success.confirmation')}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-corsair-gray-500">{t('success.name')}</span>
                    <span className="font-medium text-corsair-gray-800">{formData.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-corsair-gray-500">{t('success.course')}</span>
                    <span className="font-medium text-corsair-gray-800">{formData.course || t('success.notSpecified')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-corsair-gray-500">{t('success.instructor')}</span>
                    <span className="font-medium text-corsair-gray-800">{formData.instructor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-corsair-gray-500">{t('success.signed')}</span>
                    <span className="font-medium text-corsair-gray-800">{formData.signatureDate}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-blue-800 text-sm font-semibold">{t('success.whatHappensNext')}</p>
                    <p className="text-blue-700 text-xs mt-1 leading-relaxed">
                      {t('success.whatHappensNextDescription')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Link
                  href={continueHref}
                  className="block w-full text-center bg-corsair-red-500 hover:bg-corsair-red-600 text-white py-3.5 rounded-xl text-sm font-bold transition-colors"
                >
                  {t('success.continueToPayment')} &rarr;
                </Link>
                <Link
                  href="/contact"
                  className="block w-full text-center border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white py-3 rounded-xl text-sm font-bold transition-colors"
                >
                  {t('success.contactInstructor')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <section className="relative bg-corsair-blue-900 py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-corsair-blue-950/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/" className="text-corsair-gray-400 hover:text-white text-sm transition-colors">{tc('home')}</Link>
            <span className="text-corsair-gray-600">/</span>
            <Link href="/courses" className="text-corsair-gray-400 hover:text-white text-sm transition-colors">{tc('courses')}</Link>
            <span className="text-corsair-gray-600">/</span>
            <span className="text-corsair-red-400 text-sm font-medium">{t('hero.breadcrumb')}</span>
          </div>
          <div className="max-w-3xl">
            <span className="inline-block bg-corsair-red-500/20 text-corsair-red-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-4">
              {t('hero.badge')}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
              {t('hero.title')}
            </h1>
            <p className="text-corsair-gray-300 text-lg leading-relaxed max-w-2xl">
              {t('hero.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Compliance Warning */}
      <div className="bg-red-50 border-b border-red-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-corsair-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-red-800 text-sm font-semibold">
              {t('complianceWarning')}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <section className="py-10 md:py-14 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-10">
            {stepLabels.map((s, i) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <div key={i} className="flex items-center flex-1">
                  <div className={`flex items-center gap-2 text-xs font-semibold ${isActive ? 'text-corsair-blue-900' : isDone ? 'text-green-600' : 'text-corsair-gray-400'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isActive ? 'bg-corsair-blue-900 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-corsair-gray-200 text-corsair-gray-500'}`}>
                      {isDone ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : s.num}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mx-2 ${step > s.num ? 'bg-green-500' : 'bg-corsair-gray-200'}`} />}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit}>
            {/* STEP 1: Student Information */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-corsair-blue-900 mb-1">{t('step1.title')}</h2>
                  <p className="text-sm text-corsair-gray-500">{t('step1.description')}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                    {t('step1.fullName')} <span className="text-corsair-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    placeholder={t('step1.fullNamePlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                      {t('step1.email')} <span className="text-corsair-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder={t('step1.emailPlaceholder')}
                      className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                      {t('step1.phone')} <span className="text-corsair-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder={t('step1.phonePlaceholder')}
                      className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                    />
                  </div>
                </div>

                <div className="max-w-xs">
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                    {t('step1.dob')} <span className="text-corsair-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dob}
                    onChange={(e) => updateField('dob', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all text-corsair-gray-700"
                  />
                </div>

                <div className="max-w-xs">
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                    Driver&apos;s License Number <span className="text-corsair-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.driverLicense}
                    onChange={(e) => updateField('driverLicense', e.target.value)}
                    placeholder="TX DL number"
                    className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.streetAddress')}</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder={t('step1.streetPlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.city')}</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder={t('step1.cityPlaceholder')}
                      className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.state')}</label>
                    <select
                      value={formData.state}
                      onChange={(e) => updateField('state', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all text-corsair-gray-700 bg-white"
                    >
                      <option value="TX">TX</option>
                      <option value="OK">OK</option>
                      <option value="AR">AR</option>
                      <option value="LA">LA</option>
                      <option value="NM">NM</option>
                      <option value="Other">{t('step1.other')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.zip')}</label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => updateField('zip', e.target.value)}
                      placeholder={t('step1.zipPlaceholder')}
                      className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                    />
                  </div>
                </div>

                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-corsair-blue-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-corsair-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {t('step1.emergencyContact')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.contactName')}</label>
                      <input
                        type="text"
                        value={formData.emergencyContactName}
                        onChange={(e) => updateField('emergencyContactName', e.target.value)}
                        placeholder={t('step1.contactNamePlaceholder')}
                        className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.contactPhone')}</label>
                      <input
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                        placeholder={t('step1.contactPhonePlaceholder')}
                        className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.courseProgram')}</label>
                  <select
                    value={formData.course}
                    onChange={(e) => updateField('course', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all text-corsair-gray-700 bg-white"
                  >
                    <option value="">{t('step1.selectCourse')}</option>
                    {courses.map((c) => (
                      <option key={c.slug} value={c.title}>
                        {c.title} &mdash; {c.price}
                      </option>
                    ))}
                    <option value="Other">{t('step1.otherNotListed')}</option>
                  </select>
                  {courseParam && (
                    <p className="text-xs text-corsair-gray-400 mt-1.5 italic">
                      {t('step1.preSelected')}
                    </p>
                  )}
                </div>

                <div className="max-w-sm">
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step1.instructorLabel')}</label>
                  <input
                    type="text"
                    value={formData.instructor}
                    onChange={(e) => updateField('instructor', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all text-corsair-gray-700 bg-corsair-gray-50"
                  />
                  <p className="text-xs text-corsair-gray-400 mt-1.5 italic">{t('step1.instructorDefault')}</p>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    disabled={!canProceedStep1}
                    onClick={() => setStep(2)}
                    className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 disabled:bg-corsair-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2"
                  >
                    {t('step1.continueToAcknowledgments')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Legal Acknowledgments */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-corsair-blue-900 mb-1">{t('step2.title')}</h2>
                  <p className="text-sm text-corsair-gray-500">{t('step2.description')}</p>
                </div>

                <div className="space-y-4">
                  {acknowledgmentIds.map((ackId, i) => (
                    <label
                      key={ackId}
                      className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.acknowledgments[ackId]
                          ? 'border-green-400 bg-green-50/50'
                          : 'border-corsair-gray-200 hover:border-corsair-gray-300 bg-white'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        formData.acknowledgments[ackId]
                          ? 'border-green-500 bg-green-500'
                          : 'border-corsair-gray-300'
                      }`}>
                        {formData.acknowledgments[ackId] && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.acknowledgments[ackId]}
                        onChange={() => toggleAcknowledgment(ackId)}
                        className="sr-only"
                      />
                      <div>
                        <span className="text-corsair-gray-700 text-sm font-medium leading-relaxed">{t(`acknowledgments.${ackId}`)}</span>
                        <span className="text-xs text-corsair-gray-400 block mt-1">{t('step2.sectionOf', { current: i + 1, total: acknowledgmentIds.length })}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allChecked = Object.fromEntries(acknowledgmentIds.map((id) => [id, true]));
                      setFormData((prev) => ({ ...prev, acknowledgments: allChecked }));
                    }}
                    className="text-xs font-semibold text-corsair-blue-900 hover:text-corsair-red-500 underline transition-colors"
                  >
                    {t('step2.acknowledgeAll')}
                  </button>
                  {!allAcknowledged && (
                    <span className="text-xs text-corsair-gray-400">
                      ({Object.values(formData.acknowledgments).filter(Boolean).length}/{acknowledgmentIds.length} {t('step2.acknowledged')})
                    </span>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-corsair-gray-500 hover:text-corsair-blue-900 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('step2.backToStudentInfo')}
                  </button>
                  <button
                    type="button"
                    disabled={!canProceedStep2}
                    onClick={() => setStep(3)}
                    className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 disabled:bg-corsair-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2"
                  >
                    {t('step2.continueToSignature')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Signature */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-corsair-blue-900 mb-1">{t('step3.title')}</h2>
                  <p className="text-sm text-corsair-gray-500">{t('step3.description')}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">
                    {t('step3.typedSignature')} <span className="text-corsair-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.typedSignature}
                    onChange={(e) => updateField('typedSignature', e.target.value)}
                    placeholder={t('step3.typedSignaturePlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-corsair-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all placeholder:text-corsair-gray-400 font-serif italic text-lg"
                  />
                  <p className="text-xs text-corsair-gray-400 mt-1.5 italic">
                    {t('step3.typedSignatureNote')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-corsair-gray-700 mb-1.5">{t('step3.date')}</label>
                  <input
                    type="text"
                    value={formData.signatureDate}
                    readOnly
                    className="w-full max-w-xs px-3.5 py-2.5 border border-corsair-gray-200 rounded-lg text-sm bg-corsair-gray-50 text-corsair-gray-700 cursor-default"
                  />
                  <p className="text-xs text-corsair-gray-400 mt-1.5 italic">{t('step3.autoDate')}</p>
                </div>

                <div className="border border-corsair-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-corsair-blue-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-corsair-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      {t('step3.drawSignature')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setDrawMode(!drawMode)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        drawMode
                          ? 'bg-corsair-blue-900 text-white border-corsair-blue-900'
                          : 'text-corsair-blue-900 border-corsair-gray-300 hover:border-corsair-blue-900'
                      }`}
                    >
                      {drawMode ? t('step3.drawingModeOn') : t('step3.openDrawingPad')}
                    </button>
                  </div>

                  {drawMode && (
                    <div>
                      <div className="border-2 border-dashed border-corsair-gray-300 rounded-lg bg-white relative">
                        <canvas
                          ref={canvasRef}
                          className="w-full touch-none cursor-crosshair"
                          style={{ height: '150px' }}
                          onMouseDown={startDraw}
                          onMouseMove={draw}
                          onMouseUp={stopDraw}
                          onMouseLeave={stopDraw}
                          onTouchStart={startDraw}
                          onTouchMove={draw}
                          onTouchEnd={stopDraw}
                        />
                        <div className="absolute bottom-4 left-8 right-8 border-t border-corsair-gray-300" />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-corsair-gray-400">{t('step3.drawNote')}</p>
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="text-xs font-semibold text-corsair-red-500 hover:text-corsair-red-600 transition-colors"
                        >
                          {t('step3.clearSignature')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-corsair-blue-900 mb-3">{t('step3.reviewInfo')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-corsair-gray-500 text-xs">{t('step3.reviewName')}:</span> <span className="font-medium">{formData.fullName || '—'}</span></div>
                    <div><span className="text-corsair-gray-500 text-xs">{t('step3.reviewEmail')}:</span> <span className="font-medium">{formData.email || '—'}</span></div>
                    <div><span className="text-corsair-gray-500 text-xs">{t('step3.reviewCourse')}:</span> <span className="font-medium">{formData.course || t('step3.notSelected')}</span></div>
                    <div><span className="text-corsair-gray-500 text-xs">{t('step3.reviewInstructor')}:</span> <span className="font-medium">{formData.instructor}</span></div>
                    <div><span className="text-corsair-gray-500 text-xs">{t('step3.reviewAcknowledgments')}:</span> <span className="font-medium">{Object.values(formData.acknowledgments).filter(Boolean).length}/{acknowledgmentIds.length}</span></div>
                    <div><span className="text-corsair-gray-500 text-xs">{t('step3.reviewDate')}:</span> <span className="font-medium">{formData.signatureDate}</span></div>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-corsair-gray-500 hover:text-corsair-blue-900 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('step3.backToAcknowledgments')}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 disabled:bg-corsair-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {t('step3.processing')}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        {t('step3.signAndSubmit')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Contact info */}
          <div className="mt-12 bg-corsair-blue-900 rounded-2xl p-6 text-white">
            <h3 className="font-bold text-white mb-2">{t('questions.title')}</h3>
            <p className="text-corsair-gray-300 text-sm mb-4">
              {t('questions.description')}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="tel:+12143356652" className="flex items-center gap-2 text-corsair-gray-200 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                214-335-6652
              </a>
              <a href="mailto:corsairtacticalsolutions@gmail.com" className="flex items-center gap-2 text-corsair-gray-200 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                corsairtacticalsolutions@gmail.com
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function TrainingWaiverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-corsair-gray-50 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-corsair-blue-900 border-t-transparent rounded-full" />
        </div>
      }
    >
      <TrainingWaiverForm />
    </Suspense>
  );
}
