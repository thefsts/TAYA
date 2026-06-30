'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const FOUR_DS = [
  {
    number: '01',
    word:    'Deter',
    icon:    (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    headline: 'The First Line of Defense',
    body: 'Visible security measures discourage threats before they become incidents. Professional security presence, controlled access, and environmental design signal that a location is protected and prepared — most criminal activity is prevented before it begins.',
    bullets: [
      'Professional uniformed security presence',
      'Vehicle patrols and perimeter coverage',
      'Security signage and lighting assessments',
      'Access control and controlled entry points',
    ],
    accent: 'corsair-red-500',
    borderColor: 'border-corsair-red-500/30',
  },
  {
    number: '02',
    word:    'Detect',
    icon:    (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    headline: 'Early Identification Creates Better Outcomes',
    body: 'Once deterrence is in place, trained professionals continuously monitor for suspicious activity. Early detection creates valuable time and space to evaluate developing situations before they escalate.',
    bullets: [
      'Professional officer observation',
      'Surveillance systems integration',
      'Situational awareness and behavioral recognition',
      'Patrol reporting and incident documentation',
    ],
    accent: 'corsair-blue-400',
    borderColor: 'border-corsair-blue-400/30',
  },
  {
    number: '03',
    word:    'Deflect',
    icon:    (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    headline: 'The Corsair Tactical Solutions Difference',
    body: 'Rather than moving directly from detection to physical intervention, Corsair Tactical Solutions emphasizes communication, professionalism, and conflict resolution. Officers are trained to redirect potentially dangerous situations without unnecessary force whenever possible.',
    bullets: [
      'Verbal de-escalation techniques',
      'Conflict management and professional communication',
      'Trauma-informed response techniques',
      'Crisis intervention principles',
    ],
    accent: 'corsair-blue-400',
    borderColor: 'border-corsair-blue-400/30',
  },
  {
    number: '04',
    word:    'Defend',
    icon:    (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    headline: 'Professional Response When Necessary',
    body: 'Physical intervention represents the final phase of the model and is only utilized when all previous layers have been exhausted or when an immediate threat to life or safety exists. Every action is guided by professional judgment, applicable laws, and company policy.',
    bullets: [
      'Texas DPS Level III & IV licensed officers',
      'Protective intervention and emergency response',
      'Coordination with law enforcement',
      'Post-incident documentation and reporting',
    ],
    accent: 'corsair-red-500',
    borderColor: 'border-corsair-red-500/30',
  },
];

function PhaseCard({ d, index }: { d: typeof FOUR_DS[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const cardBg = index % 2 === 0 ? 'bg-corsair-blue-900' : 'bg-corsair-blue-800';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
      className={`${cardBg} rounded-2xl overflow-hidden shadow-lg border ${d.borderColor}`}
    >
      <div className="p-8 md:p-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Animated ghost letter */}
          <div className="flex-shrink-0 hidden md:flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 0.08, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[7rem] font-black leading-none text-white select-none w-24 text-center"
            >
              {d.word[0]}
            </motion.div>
            <span className="text-xs font-bold text-corsair-red-400 -mt-3">{d.number}</span>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <motion.span
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.15, type: 'spring', stiffness: 200 }}
                className={`text-${d.accent}`}
              >
                {d.icon}
              </motion.span>
              <h3 className="text-3xl md:text-4xl font-black text-white">{d.word}</h3>
            </div>
            <p className="text-base font-semibold text-corsair-red-400 mb-3">{d.headline}</p>
            <p className="text-white/70 leading-relaxed mb-6">{d.body}</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {d.bullets.map((b, i) => (
                <motion.li
                  key={b}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                  className="flex items-center gap-2 text-white/65 text-sm"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : {}}
                    transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 300 }}
                    className="w-4 h-4 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0"
                  >
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.span>
                  {b}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Animated Timeline Connector ─── */
function TimelineConnector() {
  return (
    <div className="hidden lg:flex flex-col items-center py-2">
      <motion.div
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="w-0.5 h-16 bg-gradient-to-b from-corsair-red-500 to-corsair-blue-400 origin-top"
      />
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        className="w-3 h-3 rounded-full bg-corsair-red-500 shadow-lg shadow-corsair-red-500/30"
      />
    </div>
  );
}

/* ─── Application Card with Hover ─── */
function ApplicationCard({ app, i }: { app: { icon: string; title: string; desc: string }; i: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group bg-corsair-gray-50 rounded-xl p-6 border border-corsair-gray-200 hover:border-corsair-red-200 hover:shadow-lg transition-all duration-300 cursor-default"
    >
      <span className="text-3xl mb-4 block group-hover:scale-110 transition-transform duration-300">{app.icon}</span>
      <h3 className="font-bold text-corsair-blue-900 mb-2">{app.title}</h3>
      <p className="text-sm text-corsair-gray-600 leading-relaxed">{app.desc}</p>
    </motion.div>
  );
}

export default function FourDClient() {
  const applications = [
    { icon: '✝️', title: 'Houses of Worship',       desc: 'The 4D model is the backbone of every church security program we design.' },
    { icon: '🏢', title: 'Corporate Facilities',     desc: 'From office parks to industrial sites, 4D scales to any environment.' },
    { icon: '🎉', title: 'Special Events',            desc: 'Dynamic threat environments require adaptive 4D application.' },
    { icon: '🏘️', title: 'Residential Communities', desc: 'HOA and multi-family communities benefit from layered 4D protection.' },
    { icon: '🎓', title: 'Educational Institutions', desc: 'School safety teams trained on the 4D framework for all threat scenarios.' },
    { icon: '🏥', title: 'Healthcare Facilities',    desc: 'Patient and staff protection through comprehensive 4D implementation.' },
  ];

  return (
    <>
      {/* The Four Dimensions with animated timeline */}
      <section className="bg-corsair-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">The Four Dimensions</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3">
              Deter &middot; Detect &middot; Deflect &middot; Defend
            </h2>
          </div>
          <div className="space-y-6 lg:space-y-0">
            {FOUR_DS.map((d, i) => (
              <div key={d.word}>
                {i > 0 && <TimelineConnector />}
                <PhaseCard d={d} index={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Applications</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
              Where We Apply the 4D Model™
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.map((app, i) => (
              <ApplicationCard key={app.title} app={app} i={i} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
