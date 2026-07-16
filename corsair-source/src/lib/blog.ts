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
    title:       'Church Security in Texas: What Actually Works',
    description: 'Fourteen years of working with DFW faith communities. Here is what an honest church security program looks like — and the mistakes most congregations make before anything happens.',
    date:        'June 2026',
    readTime:    '6 min read',
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
        text: 'Most churches I assess in DFW have one thing in common: they recognize the problem but have no plan. The pastor knows the headlines. A couple of deacons carry. The whole thing is held together by good intentions. That is not security — that is a response waiting to happen.',
      },
      {
        type: 'paragraph',
        text: 'You do not need metal detectors or a dedicated armed officer at every service. You need a structured, layered approach that starts long before a threat appears at your door.',
      },
      {
        type: 'heading',
        heading: 'Start With the Walk-Through Nobody Wants to Do',
      },
      {
        type: 'paragraph',
        text: 'Before you can build a plan, you need an honest picture of your vulnerabilities. That means walking your facility with fresh eyes — not the eyes of someone who has been coming here for twenty years and knows every face.',
      },
      {
        type: 'paragraph',
        text: 'I do this assessment differently than most consultants. I walk in like a stranger. I notice where I can go without being greeted. I look at the nursery entrance, the side doors, the parking lot coverage after dark. Familiarity creates blind spots. Your people have them. A professional from outside does not.',
      },
      {
        type: 'bullets',
        heading: 'A solid assessment covers:',
        items: [
          'Entry points and who actually controls access during services',
          'Sight lines from the lobby to the parking lot',
          "Nursery and children's ministry areas — often the weakest point in the building",
          'Lighting after dark across all parts of the property',
          'Whether your emergency communication system actually works',
          'Where first aid kits are, and whether anyone knows how to use them',
        ],
      },
      {
        type: 'callout',
        text: 'Corsair Tactical Solutions offers free facility security assessments for Texas churches. No sales pitch — just a professional walk-through, written up and delivered to your leadership team.',
      },
      {
        type: 'heading',
        heading: 'Build a Team From Who You Already Have',
      },
      {
        type: 'paragraph',
        text: 'Almost every congregation I work with already has members who are veterans, retired law enforcement, or licensed carriers. The challenge is not finding them — it is organizing them.',
      },
      {
        type: 'paragraph',
        text: 'A church safety team is not a militia. It is a small group of trained, trusted members with defined roles and a shared understanding of your facility. Their job is to be the first 60 seconds of response — not the final solution, but the bridge to one.',
      },
      {
        type: 'bullets',
        heading: 'The roles every team needs:',
        items: [
          'Greeters who observe as well as welcome — the first line of awareness at entry',
          'Perimeter coverage during dismissal, when the parking lot is most exposed',
          'Interior response — licensed, trained members inside the sanctuary who know the protocol',
          'A communications lead who knows when to call 911 and how to reach the pastor',
          'Medical response — at minimum, someone trained in Stop the Bleed',
        ],
      },
      {
        type: 'heading',
        heading: 'Your Emergency Plan Has to Be Written Down',
      },
      {
        type: 'paragraph',
        text: 'I ask every church I consult: "If something happened in the next service, what would your team do?" The answer is usually a pause, then a general description of who would call 911. That is not a plan.',
      },
      {
        type: 'paragraph',
        text: 'A written Emergency Action Plan assigns specific tasks to specific roles for four scenarios: active threat, medical emergency, fire, and severe weather. Run-Hide-Fight is a framework, not a plan. Your plan is what your people do with that framework in your specific building, on your specific floor plan, with your specific team.',
      },
      {
        type: 'heading',
        heading: 'Train Again After You Think You Are Done',
      },
      {
        type: 'paragraph',
        text: 'The most common mistake church leadership makes: they train a safety team, check the box, and consider it done. Six months later two members have moved, one is off the rotation, and nobody can find the emergency contact card.',
      },
      {
        type: 'paragraph',
        text: 'An effective church security program includes quarterly tabletop exercises, annual live drills, and refresher training whenever the team changes. Corsair Tactical Solutions provides ongoing training for faith-based organizations — from situational awareness for volunteers to armed officer certification for your security leads.',
      },
      {
        type: 'callout',
        text: 'The Texas churches that have survived attacks are the ones that took security seriously before the attack. Not after the headline. Not after the close call. Before.',
      },
    ],
  },

  {
    slug:        'texas-business-workplace-safety',
    title:       'Workplace Safety in Texas: Moving From Policy to Preparedness',
    description: 'Most Texas businesses have a safety policy. Most have never tested it. Here is what separates documentation from actual preparedness.',
    date:        'June 2026',
    readTime:    '5 min read',
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
        text: 'Here is something I have noticed after years of doing security assessments for Texas businesses: the companies with the thickest employee safety handbooks are often among the least prepared for an actual incident. A 40-page policy is not a safe workplace. It is documentation.',
      },
      {
        type: 'heading',
        heading: 'Know Your Actual Threat Profile',
      },
      {
        type: 'paragraph',
        text: 'A dry-cleaning shop in a suburban strip mall faces different threats than a property management office downtown. A restaurant with late-night alcohol service has different vulnerabilities than a law office. Most generic workplace safety advice ignores this entirely and treats all businesses as interchangeable.',
      },
      {
        type: 'bullets',
        heading: 'The most common workplace threats in Texas businesses:',
        items: [
          'Customer or client violence — especially in retail, healthcare, and service industries',
          'Domestic violence following an employee to work',
          'Disgruntled former employees — the threat most businesses dismiss until it is too late',
          'Criminal opportunism: robbery, theft, trespassing',
          'Active threat situations at high-density workplaces',
        ],
      },
      {
        type: 'paragraph',
        text: 'A professional site evaluation maps your specific exposure. It is not a sales pitch — it is an honest read of where you are actually vulnerable and what a proportionate response looks like. Not every business needs an on-site officer. Some just need a protocol and thirty minutes of staff training.',
      },
      {
        type: 'heading',
        heading: 'Preparedness Is Not the Same as Awareness',
      },
      {
        type: 'paragraph',
        text: 'Awareness is a poster in the break room. Preparedness is what your employees actually do in the first 60 seconds of a serious incident.',
      },
      {
        type: 'paragraph',
        text: 'Your front-desk staff is often the first person to encounter an aggressive visitor. Have they practiced a de-escalation conversation? Your supervisors are supposed to recognize behavioral warning signs before a situation escalates. Have they been trained to do that, or are they working from instinct? Most workplace safety programs stop at awareness and call it preparedness. They are not the same thing.',
      },
      {
        type: 'callout',
        text: 'The employees most likely to find themselves in the middle of a serious incident are usually the ones who have received the least targeted training for it.',
      },
      {
        type: 'heading',
        heading: 'Physical Security: Layers, Not Just Locks',
      },
      {
        type: 'bullets',
        heading: 'What a professional security audit evaluates:',
        items: [
          'Access control and visitor management at entry points',
          'Camera coverage and lighting gaps — especially in parking areas and loading zones',
          'Lock hardware and door frame integrity',
          'Reception protocols for unannounced or aggressive visitors',
          'Emergency communication inside the building',
        ],
      },
      {
        type: 'paragraph',
        text: 'The goal is not maximum security. The goal is enough layered deterrence that a threat takes longer to penetrate — buying your people time to respond and law enforcement time to arrive.',
      },
      {
        type: 'heading',
        heading: 'When to Bring in a Professional',
      },
      {
        type: 'paragraph',
        text: 'Not every business needs a full-time licensed security officer. But the calculation is simpler than most owners realize: what does one serious workplace incident cost — the liability, the downtime, the human cost — compared to a trained, licensed security presence?',
      },
      {
        type: 'paragraph',
        text: 'Corsair Tactical Solutions provides licensed security officers (armed and unarmed), site evaluations, and employee preparedness training for Texas businesses. Our officers are DPS-licensed and experienced in commercial environments. Call 214-335-6652 or submit a consultation request online.',
      },
    ],
  },

  {
    slug:        'texas-security-officer-licensing-levels',
    title:       'Texas Security Licensing: Levels II, III, and IV Explained',
    description: 'What each license level actually authorizes, what the training requires, and which one to start with — from an instructor who has certified hundreds of Texas security officers.',
    date:        'June 2026',
    readTime:    '7 min read',
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
        text: 'Texas has one of the most structured security licensing systems in the country, administered by the Department of Public Safety. That is good news for anyone building a career here: a Texas Level III credential carries real weight with employers, and the training that earns it is standardized and substantive.',
      },
      {
        type: 'paragraph',
        text: 'The question I hear most from students: what is the difference between Level II and Level III, and do I really need both? Short answer: yes. Here is the longer one.',
      },
      {
        type: 'heading',
        heading: 'Level II: The Starting Point',
      },
      {
        type: 'paragraph',
        text: 'Level II is the entry point for the Texas security profession. It authorizes unarmed work — access control, patrol, observation, and basic security duties at commercial and residential properties.',
      },
      {
        type: 'paragraph',
        text: 'The DPS requires 6 hours of classroom instruction and a background check. You will learn Texas law as it applies to security officers, use-of-force doctrine, and the fundamentals of professional conduct on assignment.',
      },
      {
        type: 'bullets',
        items: [
          'Authorizes unarmed security work across Texas',
          'Minimum 6 classroom hours plus background check',
          'Required prerequisite for Level III and Level IV',
          'Annual renewal with continuing education',
        ],
      },
      {
        type: 'paragraph',
        text: 'Level II officers work retail loss prevention, hospital security, HOA and apartment patrols, and access control at commercial properties. In DFW, starting pay typically runs $15 to $20 per hour. Most professionals who plan a security career treat Level II as a 30-to-90-day step on the way to Level III.',
      },
      {
        type: 'heading',
        heading: 'Level III: Where Most Security Careers Live',
      },
      {
        type: 'paragraph',
        text: 'Level III is the commissioned security officer license. It authorizes you to carry a firearm on duty, and that changes everything about the assignments you qualify for and the rate you can command.',
      },
      {
        type: 'paragraph',
        text: 'Requirements: an active Level II license, 15 additional hours of classroom instruction covering firearm safety, Texas law, and use-of-force doctrine, and a live-fire qualification administered by a DPS-certified instructor. You shoot from 3, 7, and 15 yards on a timed course of fire. Students who come in with solid range fundamentals pass without issue. Students who have not trained recently struggle.',
      },
      {
        type: 'bullets',
        heading: 'Level III at a glance:',
        items: [
          'Requires active Level II license',
          '15 additional classroom hours covering firearms law, safety, and use of force',
          'Live-fire range qualification administered by a DPS-certified instructor',
          'Annual requalification to maintain the license',
          'Authorizes armed assignments across virtually every security sector',
        ],
      },
      {
        type: 'paragraph',
        text: 'Armed security pay in DFW typically runs $18 to $28 per hour for patrol and assigned work, with higher rates for church security, executive protection support, and specialized assignments. Level III officers are in genuine demand — churches, commercial properties, property management companies, and event security firms all need them.',
      },
      {
        type: 'callout',
        text: 'Most experienced security officers I know wish they had gotten their Level III sooner. The difference in assignment quality and pay is real. If you are already working with a Level II, do not wait.',
      },
      {
        type: 'heading',
        heading: 'Level IV: Personal Protection Officer',
      },
      {
        type: 'paragraph',
        text: 'Level IV is the Personal Protection Officer (PPO) license — the highest individual tier in Texas security. It is required for professional bodyguard and executive protection work: protecting specific individuals (principals), conducting advance work, and motorcade operations.',
      },
      {
        type: 'bullets',
        heading: 'Level IV at a glance:',
        items: [
          'Requires active Level III license',
          '15 additional hours of PPO-specific instruction',
          'Covers threat assessment, advance work, and principal protection protocols',
          'Authorizes bodyguard and personal protection assignments',
          'Required for executive protection contracts in Texas',
        ],
      },
      {
        type: 'paragraph',
        text: 'At Level IV you are working with corporate executives, high-net-worth families, athletes, entertainers, and government officials. The Texas executive protection market has grown steadily with the state\'s population — demand for qualified Level IV officers in DFW, Houston, and San Antonio is real.',
      },
      {
        type: 'heading',
        heading: 'Which Level Should You Start With?',
      },
      {
        type: 'paragraph',
        text: 'Start with Level II. It is required for everything above it, and the foundational training is useful throughout your career. If you are a veteran or retiring from law enforcement, contact a DPS-approved provider first — some prerequisites may be waived based on your background.',
      },
      {
        type: 'paragraph',
        text: 'Corsair Tactical Solutions offers Level II, Level III, and combined packages for professionals who want to move quickly. Our instructors are working or retired law enforcement and security professionals.',
      },
    ],
  },

  {
    slug:        'texas-license-to-carry-guide',
    title:       'What to Expect in a Texas LTC Class',
    description: 'Practical advice from an instructor who has run hundreds of LTC classes in North Texas — what the class covers, how the range qualification works, and what first-timers get wrong.',
    date:        'June 2026',
    readTime:    '6 min read',
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
        text: 'The question I get most before LTC class: will I pass the shooting test? Almost everyone does. The ones who struggle are the ones who come in completely cold — have not touched a handgun in years, or ever. If that describes you, I will tell you what to do about it before we get to the range.',
      },
      {
        type: 'heading',
        heading: 'Why Get an LTC When Constitutional Carry Is Legal?',
      },
      {
        type: 'paragraph',
        text: 'Since September 2021, Texans 21 and older can legally carry a handgun without a license in most places. So why spend the time and money on an LTC?',
      },
      {
        type: 'bullets',
        items: [
          'Carry in some locations where constitutional carry does not apply',
          'More than 40 states recognize the Texas LTC through reciprocity — matters when you travel',
          'The NICS background check waiver speeds up handgun purchases at licensed dealers',
          'Documented training history — matters legally if you ever have to use your firearm',
          'Some employers and security assignments require it alongside their own credentials',
        ],
      },
      {
        type: 'paragraph',
        text: 'Most of my students get the LTC for the reciprocity and the legal clarity. Constitutional carry is valuable. But an LTC is documentation that you went through formal training — and that matters to a prosecutor, an employer, and sometimes a civil court.',
      },
      {
        type: 'heading',
        heading: 'Eligibility: Know This Before You Register',
      },
      {
        type: 'paragraph',
        text: 'Basic requirements: 21 years old (18 for active military), legal U.S. resident, no felony convictions, no Class A or B misdemeanor convictions in the last five years, no chemical dependency violations in the last five years, no dishonorable discharge, no current protective or restraining orders, no delinquent tax liability.',
      },
      {
        type: 'paragraph',
        text: 'If any of that applies to you, check the Texas DPS LTC FAQ at dps.texas.gov before you enroll. I can answer training questions, but I cannot give legal advice about eligibility.',
      },
      {
        type: 'heading',
        heading: 'What the Classroom Covers',
      },
      {
        type: 'paragraph',
        text: 'The classroom runs 4 to 6 hours. We cover Texas carry law (Chapters 9 and 46 of the Penal Code), what the 30.06 and 30.07 signs mean, use-of-force and deadly force doctrine, and non-violent dispute resolution.',
      },
      {
        type: 'paragraph',
        text: 'Pay attention to the use-of-force section. It is the most important thing a carrier can know, and it is the part most people remember least from their LTC class. Understanding when you are and are not legally justified in using deadly force is not a checkbox. It is the foundation of responsible carry.',
      },
      {
        type: 'heading',
        heading: 'The Range Qualification',
      },
      {
        type: 'paragraph',
        text: 'You shoot 50 rounds from three distances: 3, 7, and 15 yards on a silhouette target. You need a minimum score to pass. Most students who have shot regularly in the past few months pass comfortably.',
      },
      {
        type: 'paragraph',
        text: 'Students who have not touched a gun in a year or more are the ones who get anxious on qualification day. If that is you, come to one of our introductory firearm sessions first, or put in some range time on your own. Twenty-five rounds of deliberate practice at 7 yards is better preparation than most people realize.',
      },
      {
        type: 'bullets',
        heading: 'What to bring on class day:',
        items: [
          'Government-issued photo ID',
          'A handgun in good working condition (semiauto or revolver)',
          'At least 50 rounds of factory-loaded ammunition — no reloads on the qualification line',
          'Eye and ear protection',
          'Closed-toe shoes and clothes you can move in',
          'Water and a snack — class runs long, and hungry students make worse shooters',
        ],
      },
      {
        type: 'callout',
        text: 'I have been teaching LTC classes in North Texas since 2010. The students who do best are not always the most confident ones walking in — they are the ones who came ready to listen. We keep class sizes small deliberately. You will get real instruction, not a seat in a seminar.',
      },
      {
        type: 'heading',
        heading: 'After Class: Submitting Your Application',
      },
      {
        type: 'paragraph',
        text: 'After completing both components, your instructor provides a certificate of completion. Submit your LTC application online through the Texas DPS LTC Online Service: fingerprints, a passport-style photo, and the $40 application fee for most applicants. Processing typically takes 60 to 90 days for first-time applicants.',
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
  { id: 'v1', title: 'Firearm Safety Rules Every Shooter Must Know',           description: 'The four fundamental rules of firearm safety explained by a DPS-certified instructor.',        embedId: 'placeholder-1', category: 'Firearms Safety',        duration: '4:32' },
  { id: 'v2', title: 'Choosing Your First Handgun — A Beginner\'s Guide',       description: 'What new gun owners should consider when selecting their first firearm for home defense.',    embedId: 'placeholder-2', category: 'Firearms Safety',        duration: '6:15' },
  { id: 'v3', title: 'Level III Security Officer Qualification',                description: 'A walkthrough of the Texas Level III firearms qualification course.',                         embedId: 'placeholder-3', category: 'Security Officer Training', duration: '8:40' },
  { id: 'v4', title: 'Church Security Volunteer Best Practices',              description: 'How church safety teams prepare for and respond to potential threats.',                      embedId: 'placeholder-4', category: 'Church Security',        duration: '5:22' },
  { id: 'v5', title: 'Defensive Shooting Fundamentals: Grip, Stance, Draw',   description: 'Core skills for developing a reliable defensive draw and accurate fire under pressure.',     embedId: 'placeholder-5', category: 'Defensive Shooting',     duration: '7:10' },
  { id: 'v6', title: 'Executive Protection: Advance Work Basics',             description: 'How PPOs conduct advance work and route planning before a principal arrives.',             embedId: 'placeholder-6', category: 'Executive Protection',   duration: '9:05' },
  { id: 'v7', title: 'Texas LTC Shooting Proficiency Walkthrough',            description: 'Step-by-step guide to passing the Texas LTC range qualification at 3, 7, and 15 yards.', embedId: 'placeholder-7', category: 'License to Carry',       duration: '5:48' },
  { id: 'v8', title: 'Situational Awareness for Everyday Carry',                description: 'How to maintain awareness in public spaces without appearing paranoid or anxious.',          embedId: 'placeholder-8', category: 'Defensive Shooting',     duration: '4:55' },
  { id: 'v9', title: 'Home Firearm Storage and Child Safety',                 description: 'Best practices for securing firearms at home, including quick-access options for adults.',  embedId: 'placeholder-9', category: 'Firearms Safety',        duration: '3:40' },
  { id: 'v10', title: 'De-escalation Techniques for Security Professionals',  description: 'Verbal and physical techniques security officers use to de-escalate confrontations safely.',  embedId: 'placeholder-10', category: 'Security Officer Training', duration: '6:30' },
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
