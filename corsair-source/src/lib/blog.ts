export interface BlogArticle {
  slug:            string;
  title:           string;
  description:     string;
  date:            string;
  readTime:        string;
  category:        string;
  topic:           string;
  image:           string;
  imageAlt:        string;
  cta:             { label: string; href: string };
  relatedServices: { label: string; href: string }[];
  relatedCourses:  { label: string; href: string; cta: string }[];
  body:            ArticleSection[];
}

export interface ArticleSection {
  type:     'heading' | 'paragraph' | 'bullets' | 'callout';
  heading?: string;
  text?:    string;
  items?:   string[];
}

/* ═══════════════════════════════════════════════════════════════
   TRAINING CATEGORIES & TOPICS
   ═══════════════════════════════════════════════════════════════ */

export interface Category {
  id:     string;
  label:  string;
  icon:   string;
  topics: Topic[];
  badgeColor: { dot: string; badge: string };
}

export interface Topic {
  id:    string;
  label: string;
  description?: string;
}

export const trainingCategories: Category[] = [
  {
    id: 'professional-security',
    label: 'Professional Security Services',
    icon: 'shield',
    badgeColor: { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    topics: [
      { id: 'armed-security',      label: 'Armed Security' },
      { id: 'executive-protection', label: 'Executive Protection' },
      { id: 'property-management',  label: 'Property Management Security' },
      { id: 'hoa-security',        label: 'HOA Security' },
      { id: 'church-security',     label: 'Church Security' },
      { id: 'commercial-security',  label: 'Commercial Security' },
      { id: 'corporate-security',   label: 'Corporate Security' },
      { id: 'event-security',       label: 'Event Security' },
      { id: 'risk-assessments',     label: 'Risk Assessments' },
      { id: 'patrol-services',     label: 'Patrol Services' },
    ],
  },
  {
    id: 'security-officer-training',
    label: 'Security Officer Training',
    icon: 'badge',
    badgeColor: { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    topics: [
      { id: 'level-ii',            label: 'Level II Security Officer' },
      { id: 'level-iii',           label: 'Level III Commissioned Officer' },
      { id: 'level-iv',            label: 'Level IV Personal Protection Officer' },
      { id: 'continuing-education', label: 'Continuing Education' },
      { id: 'career-development',   label: 'Career Development' },
      { id: 'professional-standards', label: 'Professional Standards' },
      { id: 'texas-licensing',      label: 'Texas Licensing' },
    ],
  },
  {
    id: 'license-to-carry',
    label: 'License to Carry',
    icon: 'target',
    badgeColor: { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200' },
    topics: [
      { id: 'texas-ltc-requirements', label: 'Texas LTC Requirements' },
      { id: 'texas-laws',            label: 'Texas Laws' },
      { id: 'reciprocity',           label: 'Reciprocity' },
      { id: 'renewal',               label: 'Renewal' },
      { id: 'use-of-force',          label: 'Use of Force' },
      { id: 'ltc-faq',               label: 'Frequently Asked Questions' },
    ],
  },
  {
    id: 'firearms-safety',
    label: 'Firearms Safety',
    icon: 'lock',
    badgeColor: { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200' },
    topics: [
      { id: 'firearm-safety',        label: 'Firearm Safety' },
      { id: 'safe-storage',          label: 'Safe Storage' },
      { id: 'cleaning-maintenance',  label: 'Cleaning & Maintenance' },
      { id: 'transportation',        label: 'Transportation' },
      { id: 'home-firearm-safety',   label: 'Home Firearm Safety' },
    ],
  },
  {
    id: 'new-gun-owners',
    label: 'New Gun Owners',
    icon: 'star',
    badgeColor: { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    topics: [
      { id: 'first-firearm',         label: 'Choosing Your First Firearm' },
      { id: 'preparing-first-class', label: 'Preparing for Your First Class' },
      { id: 'beginner-mistakes',     label: 'Common Beginner Mistakes' },
      { id: 'good-habits',           label: 'Developing Good Habits' },
    ],
  },
  {
    id: 'defensive-shooting',
    label: 'Defensive Shooting',
    icon: 'crosshair',
    badgeColor: { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    topics: [
      { id: 'defensive-mindset',     label: 'Defensive Mindset' },
      { id: 'shooting-fundamentals', label: 'Shooting Fundamentals' },
      { id: 'tactical-movement',     label: 'Tactical Movement' },
      { id: 'range-drills',          label: 'Range Drills' },
      { id: 'scenario-training',     label: 'Scenario Training' },
    ],
  },
  {
    id: 'womens-training',
    label: "Women's Training",
    icon: 'heart',
    badgeColor: { dot: 'bg-pink-500',   badge: 'bg-pink-50 text-pink-700 border-pink-200' },
    topics: [
      { id: 'personal-protection-women', label: 'Personal Protection' },
      { id: 'confidence-building',   label: 'Confidence Building' },
      { id: 'situational-awareness', label: 'Situational Awareness' },
      { id: 'firearm-training-women', label: 'Firearm Training for Women' },
    ],
  },
  {
    id: 'shotgun-rifle',
    label: 'Shotgun & Rifle Training',
    icon: 'layers',
    badgeColor: { dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    topics: [
      { id: 'ar-15-fundamentals',    label: 'AR-15 Fundamentals' },
      { id: 'shotgun-fundamentals',  label: 'Shotgun Fundamentals' },
      { id: 'home-defense-long-guns', label: 'Home Defense with Long Guns' },
      { id: 'rifle-maintenance',     label: 'Rifle Maintenance' },
    ],
  },
  {
    id: 'church-safety',
    label: 'Church Safety',
    icon: 'church',
    badgeColor: { dot: 'bg-cyan-500',   badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    topics: [
      { id: 'houses-worship',        label: 'Protecting Houses of Worship' },
      { id: 'volunteer-security',    label: 'Volunteer Security Teams' },
      { id: 'emergency-response',    label: 'Emergency Response' },
      { id: 'active-threat-planning', label: 'Active Threat Planning' },
      { id: 'safety-team-leadership', label: 'Safety Team Leadership' },
    ],
  },
  {
    id: 'emergency-preparedness',
    label: 'Emergency Preparedness',
    icon: 'alert',
    badgeColor: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    topics: [
      { id: 'stop-the-bleed',        label: 'Stop the Bleed' },
      { id: 'first-aid',             label: 'First Aid' },
      { id: 'family-emergency-plan', label: 'Family Emergency Planning' },
      { id: 'disaster-preparedness', label: 'Disaster Preparedness' },
      { id: 'incident-response',     label: 'Incident Response' },
    ],
  },
];

export const getCategoryById = (id: string): Category | undefined =>
  trainingCategories.find((c) => c.id === id);

export const getTopicById = (topicId: string): { category: Category; topic: Topic } | undefined => {
  for (const cat of trainingCategories) {
    const t = cat.topics.find((tp) => tp.id === topicId);
    if (t) return { category: cat, topic: t };
  }
  return undefined;
};

/* ═══════════════════════════════════════════════════════════════
   ARTICLES (updated with topics + relatedCourses)
   ═══════════════════════════════════════════════════════════════ */

export const blogArticles: BlogArticle[] = [
  {
    slug:        'texas-church-security-posture',
    title:       'How Texas Churches Can Improve Their Security Posture',
    description: 'A practical guide for faith-based organizations on conducting risk assessments, preparing volunteers, and building an emergency response plan.',
    date:        'June 2026',
    readTime:    '7 min read',
    category:    'Church Safety',
    topic:       'houses-worship',
    image:       '/images/corsair-real/church-safety-specialty-01.png',
    imageAlt:    'Church safety and security specialist',
    cta:         { label: 'Request a Free Church Security Assessment', href: '/church-security' },
    relatedServices: [
      { label: 'Church Security Division',      href: '/church-security' },
      { label: 'The 4D Protection Model™',      href: '/4d-protection-model' },
      { label: 'Security Officer Training',      href: '/security-training' },
    ],
    relatedCourses: [
      { label: 'Church Security Services',      href: '/church-security',    cta: 'Request a Consultation' },
      { label: 'Security Officer Training',     href: '/security-training', cta: 'Register Now' },
    ],
    body: [
      {
        type: 'paragraph',
        text: 'Houses of worship are among the most open, welcoming environments in any community — and that openness, while spiritually vital, creates real security vulnerabilities. Across Texas, faith communities of every denomination are asking the same question: how do we keep our congregation safe without turning our sanctuary into a fortress?',
      },
      {
        type: 'paragraph',
        text: 'The answer is not walls and metal detectors. It is a structured, layered approach to security that begins long before a threat ever appears at your door. This guide walks through the five most important steps Texas churches can take right now.',
      },
      {
        type: 'heading',
        heading: '1. Conduct a Professional Risk Assessment',
      },
      {
        type: 'paragraph',
        text: "A risk assessment is not a walk-through with a checklist — it is a systematic analysis of your facility's physical layout, entry and exit points, sight lines, lighting, and the behavioral patterns of your congregation. A trained security professional will identify vulnerabilities that church staff and volunteers rarely notice because familiarity creates blind spots.",
      },
      {
        type: 'bullets',
        heading: 'A thorough assessment covers:',
        items: [
          'Perimeter access control and parking lot visibility',
          'Interior entry points and door hardware',
          "Sanctuary, nursery, and children's ministry areas",
          'Lighting adequacy across all hours of operation',
          'Communication systems and emergency notification capability',
          'First aid and trauma kit placement and accessibility',
        ],
      },
      {
        type: 'callout',
        text: 'Corsair Tactical Solutions offers free facility security assessments for Texas churches. No obligation — just an honest, professional evaluation written up and delivered to your leadership team.',
      },
      {
        type: 'heading',
        heading: '2. Build a Volunteer Safety Team',
      },
      {
        type: 'paragraph',
        text: 'Most churches already have volunteers who are veterans, law enforcement, or concealed-carry holders. The challenge is transforming those individuals from well-meaning bystanders into a coordinated security team with defined roles, clear communication protocols, and real training.',
      },
      {
        type: 'paragraph',
        text: 'A church safety team is not a militia — it is a group of trained, trusted members who know the facility, understand de-escalation, can identify early warning signs of threatening behavior, and are prepared to respond in the first critical minutes of an emergency before law enforcement arrives.',
      },
      {
        type: 'bullets',
        heading: 'Key roles to establish:',
        items: [
          'Greeter security — the first line of observation at entry points',
          'Perimeter patrol — discrete monitoring of parking areas and grounds',
          'Interior response team — trained and licensed members inside the sanctuary',
          'Communications lead — coordinates with church leadership and 911',
          'Medical response — Stop the Bleed or equivalent trained members',
        ],
      },
      {
        type: 'heading',
        heading: '3. Develop an Emergency Action Plan',
      },
      {
        type: 'paragraph',
        text: 'An Emergency Action Plan (EAP) is a written document that defines exactly what happens — and who does what — in the first 60 seconds of an emergency. It covers active threat response, medical emergencies, fire evacuation, and severe weather. Without a written plan, even trained volunteers will act inconsistently under stress.',
      },
      {
        type: 'bullets',
        heading: 'Your EAP should include:',
        items: [
          'Run-Hide-Fight or equivalent protocol adapted to your specific floor plan',
          'Designated assembly points for each ministry area',
          'Role-specific response cards for each team member',
          'Communication tree — who calls 911, who notifies the pastor, who manages the crowd',
          'Post-incident protocol — how to support congregation members after a traumatic event',
        ],
      },
      {
        type: 'heading',
        heading: '4. Train Regularly — Not Just Once',
      },
      {
        type: 'paragraph',
        text: 'Training a safety team once and calling it done is one of the most common mistakes church leadership makes. Skills decay. Volunteers change. Your facility changes. An effective church security program includes regular tabletop exercises, periodic live drills, and annual refresher training for every team member.',
      },
      {
        type: 'paragraph',
        text: 'Corsair Tactical Solutions provides ongoing training programs specifically designed for faith-based organizations — from basic situational awareness for volunteers to advanced armed officer certification for your security leads.',
      },
      {
        type: 'heading',
        heading: '5. Consider Professional Security Officers for High-Attendance Services',
      },
      {
        type: 'paragraph',
        text: "For Christmas, Easter, baptism Sundays, or any large-attendance event, your volunteer team may be stretched beyond its capacity. Licensed security officers — armed or unarmed, depending on your church's theology and needs — provide a visible deterrent and a trained, accountable presence when your congregation is at its largest.",
      },
      {
        type: 'paragraph',
        text: 'All Corsair Tactical Solutions security officers are DPS-licensed, background-checked, and trained in church-specific security protocols. We work alongside your volunteer team, not around them.',
      },
      {
        type: 'callout',
        text: 'Texas churches are a primary target for those seeking to cause harm precisely because they are open, trusting, and predictable. The churches that survive and protect their congregations are the ones that take security seriously before a crisis — not during one.',
      },
    ],
  },

  {
    slug:        'texas-business-workplace-safety',
    title:       'What Texas Businesses Should Know About Workplace Safety',
    description: 'From threat awareness to site evaluations, this guide helps Texas business owners and managers build a safer workplace environment.',
    date:        'June 2026',
    readTime:    '6 min read',
    category:    'Business Security',
    topic:       'commercial-security',
    image:       '/images/corsair-real/steve-security-uniform-01.jpg',
    imageAlt:    'Professional security officer in uniform',
    cta:         { label: 'Request a Business Security Consultation', href: '/contact' },
    relatedServices: [
      { label: 'Security Services',              href: '/security-services' },
      { label: 'Property Manager Services',      href: '/property-manager-services' },
      { label: 'Contact Us',                     href: '/contact' },
    ],
    relatedCourses: [
      { label: 'Security Services',              href: '/security-services',   cta: 'Request Security Proposal' },
      { label: 'Security Officer Training',     href: '/security-training', cta: 'Register Now' },
    ],
    body: [
      {
        type: 'paragraph',
        text: 'Workplace violence is the third-leading cause of fatal occupational injuries in the United States. In Texas alone, thousands of businesses operate without a documented threat response policy, a trained safety team, or even a clear emergency contact protocol. The gap between awareness and action costs lives — and businesses.',
      },
      {
        type: 'paragraph',
        text: 'This guide is for Texas business owners and managers who want to move from reactive to proactive on workplace safety — without creating a culture of fear or over-investing in unnecessary infrastructure.',
      },
      {
        type: 'heading',
        heading: 'Understand Your Threat Environment',
      },
      {
        type: 'paragraph',
        text: 'Not every business faces the same threat profile. A retail location in a high-traffic commercial corridor faces different risks than a professional services office in a Class A building. A warehouse with late-night operations has different vulnerabilities than a restaurant with alcohol service.',
      },
      {
        type: 'bullets',
        heading: 'The most common workplace threats in Texas businesses include:',
        items: [
          'Customer or client-initiated violence (retail, healthcare, service industries)',
          'Domestic violence entering the workplace (partner or family member of an employee)',
          'Disgruntled current or former employees',
          'Criminal opportunism — robbery, theft, trespassing',
          'Active threat scenarios at high-density workplaces',
        ],
      },
      {
        type: 'paragraph',
        text: 'A professional site evaluation maps your specific threat exposure against your current physical and procedural security posture. The result is not a sales pitch — it is an honest assessment of where your business is exposed and what a proportionate response looks like.',
      },
      {
        type: 'heading',
        heading: 'Build Employee Preparedness — Not Just Awareness',
      },
      {
        type: 'paragraph',
        text: 'Most workplace safety programs stop at the awareness stage: posters on the break room wall, an annual HR training, a slide deck about not letting tailgaters in through the badge door. Awareness is necessary but insufficient.',
      },
      {
        type: 'paragraph',
        text: 'Preparedness means your employees know what to do in the first 60 seconds of an emergency — and have practiced it. It means your supervisors can recognize the behavioral warning signs of an escalating situation before it becomes a crisis. It means your front-desk staff knows how to safely de-escalate an aggressive customer.',
      },
      {
        type: 'bullets',
        heading: 'Key preparedness components for Texas businesses:',
        items: [
          'Run-Hide-Fight protocol training — adapted to your specific floor plan',
          'Threat recognition and early intervention skills for supervisors',
          'De-escalation training for customer-facing employees',
          'Active shooter response — what to do, in what order, and why',
          'Post-incident psychological first aid for managers',
        ],
      },
      {
        type: 'heading',
        heading: 'Conduct a Physical Security Audit',
      },
      {
        type: 'paragraph',
        text: 'Physical security is not about adding more locks and cameras — it is about creating layers of deterrence, delay, and detection that give your employees time to respond and law enforcement time to arrive. Many businesses invest heavily in technology while leaving fundamental physical vulnerabilities unaddressed.',
      },
      {
        type: 'bullets',
        heading: 'A professional audit evaluates:',
        items: [
          'Access control — who can enter your facility and how',
          'Sight lines and camera coverage gaps',
          'Lighting in parking areas, entries, and loading zones',
          'Lock hardware and door frame integrity',
          'Reception and visitor management procedures',
          'Emergency communication systems',
        ],
      },
      {
        type: 'heading',
        heading: 'Know When to Bring In Professional Security',
      },
      {
        type: 'paragraph',
        text: 'Not every business needs a full-time licensed security officer on-site. But many businesses that have experienced a serious incident wish they had engaged professional security sooner. The calculus is simpler than most owners think: what is the cost of a serious workplace incident — the liability, the downtime, the human cost — compared to the cost of a trained, licensed security presence?',
      },
      {
        type: 'paragraph',
        text: 'Corsair Tactical Solutions provides licensed security officers (armed and unarmed), site evaluations, and employee safety training for Texas businesses of all sizes. Our officers are DPS-licensed, professionally trained, and experienced in commercial security environments.',
      },
      {
        type: 'callout',
        text: 'A business that plans for workplace safety rarely has to respond to a workplace safety crisis. The investment in preparation is almost always less than the cost of the incident it prevents.',
      },
    ],
  },

  {
    slug:        'texas-security-officer-licensing-levels',
    title:       'Understanding Texas Security Officer Licensing: Levels II, III, and IV',
    description: 'A complete breakdown of Texas DPS security officer license levels — what each covers, who it is for, and how to progress your security career.',
    date:        'June 2026',
    readTime:    '8 min read',
    category:    'Security Training',
    topic:       'texas-licensing',
    image:       '/images/corsair-real/level-3-armed-officer-01.png',
    imageAlt:    'Texas Level III armed security officer training',
    cta:         { label: 'Explore Security Officer Training Programs', href: '/security-training' },
    relatedServices: [
      { label: 'Level II Security Officer Course',  href: '/courses/level-2-security-officer' },
      { label: 'Level III Armed Officer Course',    href: '/courses/level-3-armed-security-officer' },
      { label: 'Level IV Bodyguard Training',       href: '/courses/level-4-bodyguard' },
    ],
    relatedCourses: [
      { label: 'Level III Security Officer Training', href: '/security-training', cta: 'Register Now' },
    ],
    body: [
      {
        type: 'paragraph',
        text: 'Texas has one of the most structured and rigorous security officer licensing systems in the country, administered by the Texas Department of Public Safety (DPS). If you are pursuing a career in security — or looking to advance within the profession — understanding the difference between License Levels II, III, and IV is essential.',
      },
      {
        type: 'paragraph',
        text: 'This guide breaks down each license level: what training is required, what it authorizes you to do, and how each level opens new career opportunities in Texas.',
      },
      {
        type: 'heading',
        heading: 'Level II — Commissioned Security Officer',
      },
      {
        type: 'paragraph',
        text: 'The Level II license is the entry point for professional security work in Texas. It authorizes you to work as an unarmed security officer in commercial, residential, and event security environments. To obtain a Level II license, you must complete a state-mandated 6-hour classroom course covering Texas security law, powers and limitations, emergency procedures, and professional conduct.',
      },
      {
        type: 'bullets',
        heading: 'Level II at a glance:',
        items: [
          '6 hours of state-required classroom instruction',
          'Covers Texas Occupations Code, Chapter 1702',
          'Authorizes unarmed security officer work',
          'Required before pursuing Level III',
          'Background check and DPS application required',
          'No firearm qualification required at this level',
        ],
      },
      {
        type: 'paragraph',
        text: 'Career paths for Level II officers include retail loss prevention, residential community security, event staff, hospital security (unarmed), and corporate reception security. It is a versatile entry-level credential that opens a broad range of employment opportunities across North Texas.',
      },
      {
        type: 'heading',
        heading: 'Level III — Armed Security Officer',
      },
      {
        type: 'paragraph',
        text: 'The Level III license is required before you can legally carry a firearm as a security officer in Texas. It builds on the Level II foundation with additional classroom instruction and a live-fire qualification component. Level III officers are authorized to work armed in environments that require a higher threat deterrent — banks, hospitals, nightclubs, courthouses, and high-value asset protection.',
      },
      {
        type: 'bullets',
        heading: 'Level III at a glance:',
        items: [
          'Requires active Level II license',
          '15 hours of additional classroom instruction',
          'Firearm safety, law, and use-of-force training',
          'Live-fire qualification at a licensed range',
          'Authorizes carrying of handgun while on duty',
          'Annual firearms requalification required',
        ],
      },
      {
        type: 'paragraph',
        text: 'Level III is where most security careers in Texas consolidate. Armed officers command significantly higher hourly rates and qualify for a wider range of assignments. Church security programs, bank protection, and contract security companies all require Level III as their baseline for armed positions.',
      },
      {
        type: 'callout',
        text: 'Corsair Tactical Solutions offers both Level II and Level III certification courses, including combined packages for career-changers and veterans entering the security profession. All instructors are DPS-certified.',
      },
      {
        type: 'heading',
        heading: 'Level IV — Personal Protection Officer (Bodyguard)',
      },
      {
        type: 'paragraph',
        text: 'The Level IV license — formally the Personal Protection Officer (PPO) certification — is the highest tier of individual security licensure in Texas. It authorizes the protection of specific individuals (principals) and is required for professional bodyguard and executive protection work. Level IV training is significantly more advanced than Levels II and III, covering threat assessment, advance work, motorcade operations, and evasive driving.',
      },
      {
        type: 'bullets',
        heading: 'Level IV at a glance:',
        items: [
          'Requires active Level III license',
          '15 hours of additional instruction specific to personal protection',
          'Covers advance work, threat assessment, and principal protection protocols',
          'Authorizes bodyguard and personal protection assignments',
          'Required for executive protection contracts and high-net-worth client work',
          'Most competitive compensation tier in Texas security',
        ],
      },
      {
        type: 'paragraph',
        text: 'Level IV officers work with corporate executives, high-net-worth families, entertainers, athletes, and government officials. The Texas executive protection market is growing significantly with the state\'s continued economic and population growth, creating strong demand for qualified Level IV officers across DFW, Houston, and San Antonio.',
      },
      {
        type: 'heading',
        heading: 'Which Level Should You Start With?',
      },
      {
        type: 'paragraph',
        text: 'If you are new to the security profession, start with Level II. It is a requirement for Levels III and IV, and the foundational knowledge it provides is genuinely useful at every stage of your career. If you are a veteran or law enforcement professional transitioning into security, you may be able to waive certain prerequisites — contact a DPS-approved training provider to review your specific situation.',
      },
      {
        type: 'paragraph',
        text: 'Corsair Tactical Solutions offers individual level courses and a combined Level III/IV package for professionals who want to advance quickly. Our instructors are active or retired law enforcement and security professionals — not classroom-only trainers.',
      },
    ],
  },

  {
    slug:        'texas-license-to-carry-guide',
    title:       'Texas License to Carry: What New Students Need to Know',
    description: 'Everything you need to know before attending your first Texas LTC class — eligibility, requirements, what to bring, and what to expect on qualification day.',
    date:        'June 2026',
    readTime:    '7 min read',
    category:    'License to Carry',
    topic:       'texas-ltc-requirements',
    image:       '/images/corsair-real/ltc-cert-basic-handgun-01.png',
    imageAlt:    'Texas License to Carry certification class',
    cta:         { label: 'Register for Texas LTC Certification', href: '/courses/texas-ltc-certification-basic-handgun' },
    relatedServices: [
      { label: 'Texas LTC Certification Course',   href: '/courses/texas-ltc-certification-basic-handgun' },
      { label: 'LTC Shooting Proficiency',          href: '/courses/texas-ltc-shooting-proficiency' },
      { label: 'Defensive Shooting Skills',         href: '/courses/defensive-shooting-skills' },
    ],
    relatedCourses: [
      { label: 'Texas License to Carry Certification / Basic Handgun', href: '/courses/texas-ltc-certification-basic-handgun', cta: 'Register Today' },
      { label: 'Defensive Shooting Skills', href: '/courses/defensive-shooting-skills', cta: 'Book Your Class' },
    ],
    body: [
      {
        type: 'paragraph',
        text: 'The Texas License to Carry (LTC) is the legal authorization to carry a handgun — concealed or openly — in most public places across the state. Since the passage of constitutional carry in 2021, Texans 21 and older can legally carry without a license in many circumstances. So why get the LTC?',
      },
      {
        type: 'bullets',
        heading: 'Key advantages of holding a Texas LTC:',
        items: [
          'Allows you to carry in some locations prohibited under constitutional carry',
          'Recognized by more than 40 other states through reciprocity agreements',
          'Allows faster NICS background check waiver when purchasing firearms',
          'Provides legal clarity and documented training history',
          'Required in some employment settings (security, armed professions)',
        ],
      },
      {
        type: 'heading',
        heading: 'Eligibility Requirements',
      },
      {
        type: 'paragraph',
        text: "Before enrolling in a Texas LTC course, confirm you meet the state's eligibility requirements. Your instructor can answer questions, but disqualifying factors exist that cannot be waived by training — it is better to know before you invest time and money.",
      },
      {
        type: 'bullets',
        heading: 'Basic eligibility for a Texas LTC:',
        items: [
          'Must be 21 years of age or older (18+ for active military)',
          'Must be a legal resident of the United States',
          'No felony convictions or pending felony charges',
          'No Class A or B misdemeanor convictions in the last 5 years',
          'No chemical dependency or controlled substance violations in the last 5 years',
          'No dishonorable discharge from the armed forces',
          'Not currently under a protective or restraining order',
          'No current delinquent tax liability',
        ],
      },
      {
        type: 'paragraph',
        text: "If you have any questions about your eligibility, the Texas DPS LTC FAQ at dps.texas.gov is the authoritative resource. Your instructor cannot provide legal advice about eligibility.",
      },
      {
        type: 'heading',
        heading: 'What to Expect in a Texas LTC Class',
      },
      {
        type: 'paragraph',
        text: 'A Texas LTC course includes two components: classroom instruction and a live-fire shooting proficiency test. The classroom portion covers Texas law — where you can and cannot carry, use-of-force law, and non-violent dispute resolution — and takes approximately 4 to 6 hours. The proficiency test is conducted on a live-fire range and must be administered by a DPS-certified instructor.',
      },
      {
        type: 'bullets',
        heading: 'Classroom topics include:',
        items: [
          'Texas laws on carrying handguns (Chapters 9, 46 of Texas Penal Code)',
          'Non-violent dispute resolution',
          'Proper storage of handguns',
          'Use of force and deadly force',
          'Locations where carry is prohibited',
          '30.06 and 30.07 sign law',
        ],
      },
      {
        type: 'heading',
        heading: 'The Shooting Proficiency Test',
      },
      {
        type: 'paragraph',
        text: 'The state requires you to shoot a minimum score from three distances — 3, 7, and 15 yards — using a silhouette target. The test uses a 50-point scoring system and you need a minimum score to pass. Most students who have spent time at the range before their LTC class pass comfortably.',
      },
      {
        type: 'paragraph',
        text: "If you have not shot much or at all, do not let that stop you from enrolling — but do consider taking a basic handgun skills course beforehand. At Corsair Tactical Solutions, we offer introductory firearm courses alongside our LTC program, and our instructors will work with you at the range to ensure you're confident before your qualification attempt.",
      },
      {
        type: 'bullets',
        heading: 'What to bring on class day:',
        items: [
          'Government-issued photo ID',
          'A handgun in good working condition (semiauto or revolver)',
          'At least 50 rounds of factory ammunition',
          'Eye protection and hearing protection',
          'Comfortable clothing and closed-toe shoes',
          'Payment for range fees and any additional add-ons',
          'Water and a light snack — class days are long',
        ],
      },
      {
        type: 'heading',
        heading: 'After the Class: Submitting Your Application',
      },
      {
        type: 'paragraph',
        text: 'Once you complete the classroom and range components, your instructor will provide you with a certificate of completion. You submit your LTC application online through the Texas DPS LTC Online Service, along with fingerprints, a passport-style photo, and the application fee ($40 for most applicants). Processing times vary — typically 60 to 90 days for first-time applicants.',
      },
      {
        type: 'callout',
        text: 'Corsair Tactical Solutions is a DPS-certified LTC provider serving the Dallas-Fort Worth metroplex and North Texas. Our class sizes are intentionally small — you get real instruction, not a crowded seminar. Ammunition and firearm rentals are available for students who need them.',
      },
    ],
  },
];

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return blogArticles.find((a) => a.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return blogArticles.map((a) => a.slug);
}

/* ═══════════════════════════════════════════════════════════════
   VIDEO REGISTRY
   ═══════════════════════════════════════════════════════════════ */

export interface TrainingVideo {
  id:          string;
  title:       string;
  description: string;
  embedId:     string;
  category:    string;
  duration?:   string;
  thumbnail?:  string;
}

export const trainingVideos: TrainingVideo[] = [
  /* Video embeds will be wired when Corsair Tactical uploads their training library to YouTube.
     Contact: amorebey@gmail.com for embed ID updates. */
];

export const videoCategories = [
  'Firearms Safety',
  'Instructor Tips',
  'Security Officer Training',
  'Defensive Shooting',
  'Church Security',
  'Executive Protection',
  'Equipment Reviews',
  'Scenario Discussions',
];

export const getVideosByCategory = (cat: string): TrainingVideo[] =>
  trainingVideos.filter((v) => v.category === cat);

export const getFeaturedVideo = (): TrainingVideo => trainingVideos[0];

/* ═══════════════════════════════════════════════════════════════
   TRAINING TIPS (rotating)
   ═══════════════════════════════════════════════════════════════ */

export interface TrainingTip {
  id:      string;
  type:    string;
  title:   string;
  text:    string;
}

export const trainingTips: TrainingTip[] = [
  { id: 't1',  type: 'Tip of the Week',        title: 'Treat Every Firearm as Loaded',                    text: 'Even if you just unloaded it yourself. The only safe assumption is that every firearm is loaded, always. This mindset prevents the vast majority of negligent discharges.' },
  { id: 't2',  type: 'Firearm Safety Reminder', title: 'Keep Your Finger Off the Trigger',                text: 'Until you have made the conscious decision to fire. Your trigger finger belongs along the frame — never inside the trigger guard — until your sights are on target and you intend to shoot.' },
  { id: 't3',  type: 'Security Officer Tip',   title: 'Scan Before You Approach',                        text: 'When approaching a suspicious individual or situation, scan the environment first. Look for accomplices, escape routes, and cover. Your safety depends on what you see before you act.' },
  { id: 't4',  type: 'Instructor Advice',        title: 'Dry Fire Daily for 10 Minutes',                   text: 'Dry fire is the single most cost-effective training method. It builds muscle memory for draw, grip, trigger press, and reload without ammunition cost. Always verify your firearm is unloaded first.' },
  { id: 't5',  type: 'Range Tip',              title: 'Call Your Shots Before the Target Turns',          text: 'In practice, verbalize where each shot will go before you press the trigger. This builds visual confirmation and eliminates surprise misses during qualification.' },
  { id: 't6',  type: 'Defensive Mindset Tip',   title: 'Avoidance Is Your First and Best Defense',        text: 'The best gunfight is the one you never enter. Situational awareness, verbal de-escalation, and physical retreat are all preferable to drawing a firearm. Train for all options, not just the last one.' },
  { id: 't7',  type: 'Tip of the Week',        title: 'Know the Backstop Before You Draw',                 text: 'In a defensive situation, your backstop matters as much as your target. Every round you fire must have a safe stopping point. Be aware of what is behind your threat before you press the trigger.' },
  { id: 't8',  type: 'Instructor Advice',        title: 'Train with the Gear You Carry',                     text: 'If you carry a Glock 19 with a spare magazine, train with that exact setup. Do not use a different holster, belt, or firearm at the range than you rely on in daily life. Muscle memory is specific.' },
];

export const getRandomTip = (): TrainingTip =>
  trainingTips[Math.floor(Math.random() * trainingTips.length)];

/* ═══════════════════════════════════════════════════════════════
   SCENARIO DISCUSSIONS
   ═══════════════════════════════════════════════════════════════ */

export interface ScenarioDiscussion {
  id:                string;
  title:             string;
  category:          string;
  situation:           string;
  threatAssessment:  string;
  instructorAnalysis: string;
  recommendedResponse: string;
  lessonsLearned:    string[];
  safetyTakeaways:   string[];
  discussionQuestions: string[];
  videoEmbedId?:     string;
}

export const scenarioDiscussions: ScenarioDiscussion[] = [
  {
    id: 'sc1',
    title: 'Parking Lot Approach After Evening Service',
    category: 'Church Safety',
    situation: 'A volunteer security team member notices an unfamiliar individual pacing near the church parking lot entrance during evening service. The individual is not wearing church-appropriate clothing for the weather, is carrying a backpack, and appears agitated. Several families are already walking toward the parking lot with children.',
    threatAssessment: 'The behavioral indicators — agitation, inappropriate clothing, pacing near an entry point — are consistent with pre-attack indicators. The backpack may contain weapons or materials. The proximity to families raises the urgency. However, not all agitated individuals are threats; the individual may be in mental health crisis, seeking help, or waiting for someone.',
    instructorAnalysis: 'This is a textbook "gray area" scenario. The team member cannot act with force based on suspicion alone, but they cannot ignore the indicators. The correct response involves three phases: observation, communication, and controlled engagement — always with backup nearby and the ability to escalate to 911 immediately.',
    recommendedResponse: '1. Alert the security team lead via radio. 2. Position a second team member at a safe observation distance. 3. Approach from a non-threatening angle (not directly from behind) with a warm greeting. 4. Ask if the individual needs help or directions. 5. Maintain a safe reactionary gap (minimum 21 feet). 6. If behavior escalates, retreat and direct families to re-enter the building while calling 911.',
    lessonsLearned: [
      'Pre-attack indicators should be taken seriously but never acted upon with force until a threat is confirmed.',
      'Always approach with backup — never confront a suspicious individual alone.',
      'A friendly greeting is the most effective first tool; it tests response while maintaining goodwill.',
      'Families should be directed to safe areas without causing panic.',
    ],
    safetyTakeaways: [
      'Maintain situational awareness during all services, not just sermons.',
      'Pre-position team members near parking areas during dismissal.',
      'Radio communication is essential — no team member should be without a working radio.',
    ],
    discussionQuestions: [
      'How do you balance suspicion with hospitality in a house of worship?',
      'What would you say when first approaching this individual?',
      'How should the team member position their body and hands?',
      'At what point should 911 be called proactively?',
    ],
    videoEmbedId: 'placeholder-sc1',
  },
  {
    id: 'sc2',
    title: 'Home Invasion: Awake in the Middle of the Night',
    category: 'Home Defense',
    situation: 'You are asleep when you hear glass breaking downstairs. Your bedroom is on the second floor. Your spouse is beside you and your two children are asleep in rooms across the hall. You have a handgun in a quick-access safe on your nightstand.',
    threatAssessment: 'Glass breaking indicates forced entry — a home invasion, not a common burglar. Home invaders typically move fast and may be armed. Your children are on the same floor as you but in separate rooms. You have the tactical advantage of elevation and familiarity with your home layout, but you must protect three people.',
    instructorAnalysis: 'The most common mistake in this scenario is leaving the bedroom to "clear the house." Clearing a structure is a law enforcement skill that requires multiple officers, training, and the ability to call for backup. As a homeowner, your priority is defending your family\'s position, not eliminating the threat from the entire house.',
    recommendedResponse: '1. Wake your spouse and give clear, calm instructions: call 911, stay in the bedroom with the door locked. 2. Retrieve your firearm from the safe. 3. Position yourself at the top of the stairs with a clear field of fire and hard cover. 4. Announce loudly that police have been called and that you are armed. 5. Do not go downstairs. 6. If the intruder advances up the stairs, you are justified in defending your position.',
    lessonsLearned: [
      'Never clear your house alone — your family is the priority, not the property.',
      '911 should be called immediately, even before retrieving your firearm if possible.',
      'Verbal warnings are a critical step — they may cause the intruder to flee, resolving the situation without violence.',
      'A locked bedroom door creates a barrier that buys critical seconds.',
    ],
    safetyTakeaways: [
      'Have a family emergency plan that includes where to shelter and who calls 911.',
      'A quick-access safe should be operable in total darkness within 5 seconds.',
      'Practice your response plan with your family during daylight first, then in darkness.',
      'Never leave your defensive position to investigate — the stairs are your choke point.',
    ],
    discussionQuestions: [
      'What if your children wake up and leave their rooms?',
      'How do you safely announce your presence without revealing your exact position?',
      'What happens if the intruder is armed and fires back?',
      'Should you turn on lights or leave them off?',
    ],
    videoEmbedId: 'placeholder-sc2',
  },
  {
    id: 'sc3',
    title: 'Retail Robbery: You Are a Concealed Carrier',
    category: 'Defensive Shooting',
    situation: 'You are in a convenience store at 10 PM when two masked individuals enter. One displays a handgun and orders everyone to the floor while the other jumps the counter to empty the register. You are legally carrying concealed. Five other customers are present, including two elderly individuals near the entrance.',
    threatAssessment: 'This is an active armed robbery with multiple assailants. The threat is immediate and lethal. However, engaging armed robbers in a crowded retail environment carries extreme risk of collateral injury. The robbers have the tactical advantage of surprise, numbers, and known weapon status. Your draw time and accuracy are unknown under stress.',
    instructorAnalysis: 'The legal and tactical question is not whether you CAN draw — it is whether you SHOULD draw. Intervening in a third-party robbery as a concealed carrier is legally defensible in Texas under certain conditions, but the risk of escalation and collateral damage is real. The default position for a concealed carrier in a retail robbery is to be a good witness, not a hero — unless the robbers escalate to violence against people.',
    recommendedResponse: '1. Move to cover while drawing as little attention as possible. 2. Observe and mentally record details: clothing, weapons, physical descriptions, tattoos, accents, direction of movement. 3. Do not draw unless the robbers threaten life (not property). 4. If a robber turns a weapon on a person, your decision to act becomes legally and morally clearer. 5. If you do act, prioritize hits on the nearest threat from behind cover. 6. Be prepared for the second robber to engage you.',
    lessonsLearned: [
      'Property is not worth your life or the lives of others — never intervene over merchandise.',
      'Observation is your first responsibility when you cannot safely act.',
      'Multiple assailants drastically change the tactical equation — you must address both threats or escape after the first.',
      'A concealed carrier who draws and misses may escalate the situation for everyone in the store.',
    ],
    safetyTakeaways: [
      'Train for accuracy under stress at realistic distances (7-15 feet, not 25 yards).',
      'Know your local laws on third-party intervention — Texas is generally permissive, but the burden of justification is on you.',
      'Consider carrying a flashlight with your firearm — 80% of defensive encounters occur in low light.',
      'After-action: be prepared to immediately re-holster and show your hands when police arrive.',
    ],
    discussionQuestions: [
      'What if one of the robbers points a gun at a child?',
      'How do you identify cover vs. concealment in a convenience store?',
      'Should you tell other customers to flee or stay still?',
      'What is the legal standard for using deadly force to protect property in Texas?',
    ],
  },
];

export const getScenarioById = (id: string): ScenarioDiscussion | undefined =>
  scenarioDiscussions.find((s) => s.id === id);

/* ═══════════════════════════════════════════════════════════════
   DOWNLOADABLE RESOURCES
   ═══════════════════════════════════════════════════════════════ */

export interface DownloadableResource {
  id:          string;
  title:       string;
  description: string;
  icon:        string;
  format:      'PDF' | 'DOCX';
  size?:       string;
  href:        string;
  category:    string;
}

export const downloadableResources: DownloadableResource[] = [
  { id: 'r1',  title: 'Home Defense Checklist',               description: 'Room-by-room security checklist for residential properties.',                           icon: 'home',       format: 'PDF', size: '1.2 MB', href: '#', category: 'Firearms Safety' },
  { id: 'r2',  title: 'Church Security Planning Guide',       description: 'Complete guide for building and training volunteer security teams.',                     icon: 'church',     format: 'PDF', size: '2.4 MB', href: '#', category: 'Church Safety' },
  { id: 'r3',  title: 'Firearm Safety Checklist',             description: 'Essential rules, storage guidelines, and transport requirements for Texas gun owners.',   icon: 'shield',     format: 'PDF', size: '0.8 MB', href: '#', category: 'Firearms Safety' },
  { id: 'r4',  title: 'Security Officer Equipment Checklist', description: 'Gear and equipment standards for Level II, III, and IV officers in Texas.',              icon: 'badge',      format: 'PDF', size: '1.1 MB', href: '#', category: 'Security Officer Training' },
  { id: 'r5',  title: 'Range Checklist',                      description: 'What to bring to the range — gear, ammunition, safety equipment, and documentation.',   icon: 'target',     format: 'PDF', size: '0.6 MB', href: '#', category: 'Defensive Shooting' },
  { id: 'r6',  title: 'Emergency Contact Form',               description: 'Printable emergency contact and medical information form for range bags and vehicles.',   icon: 'alert',      format: 'PDF', size: '0.4 MB', href: '#', category: 'Emergency Preparedness' },
  { id: 'r7',  title: 'Incident Report Template',             description: 'Professional incident report template for security officers and church safety teams.',      icon: 'file',       format: 'DOCX', size: '0.3 MB', href: '#', category: 'Professional Security' },
  { id: 'r8',  title: 'Family Safety Plan',                   description: 'Step-by-step guide to creating a family emergency plan with communication trees.',       icon: 'heart',      format: 'PDF', size: '1.5 MB', href: '#', category: 'Emergency Preparedness' },
  { id: 'r9',  title: 'Security Assessment Worksheet',        description: 'Self-assessment worksheet for evaluating your home, church, or business security.',      icon: 'clipboard',  format: 'PDF', size: '1.0 MB', href: '#', category: 'Professional Security' },
];

export const getResourcesByCategory = (cat: string): DownloadableResource[] =>
  downloadableResources.filter((r) => r.category === cat);

/* ═══════════════════════════════════════════════════════════════
   FILTER / SEARCH HELPERS
   ═══════════════════════════════════════════════════════════════ */

export function filterArticles(
  query: string,
  category?: string,
  topic?: string,
): BlogArticle[] {
  const q = query.toLowerCase().trim();
  return blogArticles.filter((a) => {
    const matchesQuery =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.topic.toLowerCase().includes(q);
    const matchesCategory = !category || a.category === category;
    const matchesTopic = !topic || a.topic === topic;
    return matchesQuery && matchesCategory && matchesTopic;
  });
}

export function getArticlesByCategory(categoryId: string): BlogArticle[] {
  const cat = getCategoryById(categoryId);
  if (!cat) return [];
  return blogArticles.filter((a) =>
    cat.topics.some((t) => t.id === a.topic) || a.category === cat.label
  );
}

export function getArticlesByTopic(topicId: string): BlogArticle[] {
  return blogArticles.filter((a) => a.topic === topicId);
}

export const getFeaturedArticle = (): BlogArticle => blogArticles[0];

export const getAllCategories = (): Category[] => trainingCategories;

/* ═══════════════════════════════════════════════════════════════
   RELATED CONTENT HELPERS
   ═══════════════════════════════════════════════════════════════ */

export function getRelatedArticles(currentSlug: string, max = 3): BlogArticle[] {
  const current = getBlogArticle(currentSlug);
  if (!current) return blogArticles.filter((a) => a.slug !== currentSlug).slice(0, max);
  return blogArticles
    .filter((a) => a.slug !== currentSlug)
    .sort((a, b) => {
      const aScore = (a.category === current.category ? 2 : 0) + (a.topic === current.topic ? 3 : 0);
      const bScore = (b.category === current.category ? 2 : 0) + (b.topic === current.topic ? 3 : 0);
      return bScore - aScore;
    })
    .slice(0, max);
}

export function getRelatedVideosForArticle(slug: string, max = 2): TrainingVideo[] {
  const article = getBlogArticle(slug);
  if (!article) return trainingVideos.slice(0, max);
  return trainingVideos
    .filter((v) => v.category === article.category || v.category.includes(article.topic))
    .slice(0, max)
    .concat(trainingVideos.filter((v) => v.category !== article.category).slice(0, max))
    .slice(0, max);
}

export function getRelatedCoursesForArticle(slug: string) {
  const article = getBlogArticle(slug);
  return article?.relatedCourses ?? [];
}

export function getRelatedServicesForArticle(slug: string) {
  const article = getBlogArticle(slug);
  return article?.relatedServices ?? [];
}
