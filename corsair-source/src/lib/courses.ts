export interface SubCourse {
  name: string;
  description?: string;
}

export interface PricingOption {
  id: string;
  name: string;
  price: number;
  description?: string;
  badge?: string;
  savings?: string;
  popular?: boolean;
  priceLabel?: string;
}

export interface CourseFee {
  id: string;
  label: string;
  price: number;
  required: boolean;
  locked: boolean;
  description?: string;
}

export interface Course {
  slug: string;
  title: string;
  category: string;
  categoryTags: string[];
  tagline: string;
  description: string;
  longDescription: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  duration: string;
  level: string;
  price: string;
  keyPoints: string[];
  whatYouLearn: string[];
  whoIsItFor: string[];
  prerequisites: string[];
  whatToBring: string[];
  cta: string;
  pricingOptions: PricingOption[];
  requiredFees?: CourseFee[];
  optionalAddOns?: CourseFee[];
  urgencyMessage?: string;
  contactOnly?: boolean;
  subCourses?: SubCourse[];
  relatedOldSiteClasses?: string[];
}

export interface CourseCategory {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string;
  courses: string[]; // course slugs
}

/* ─── Category filter labels used on the Courses page ─── */
export const filterCategories = [
  'All',
  'License to Carry',
  'Beginner',
  'Defensive',
  'Private Training',
  'Security Training',
  'Rifle / Shotgun',
  "Women's Training",
  'Church / Business Safety',
  'First Aid / Medical',
  'Instructor / Professional',
] as const;

export type FilterCategory = (typeof filterCategories)[number];

/* ─── Course category groupings for page sections ─── */
export const courseCategories: CourseCategory[] = [
  {
    id: 'ltc',
    title: 'License to Carry & Certification',
    slug: 'license-to-carry',
    icon: '🪪',
    description:
      'State-approved Texas License to Carry courses with classroom instruction, legal education, and live-fire qualification.',
    courses: [
      'online-texas-ltc-assessment',
      'texas-ltc-wichita',
      'texas-ltc-certification-basic-handgun',
      'texas-ltc-shooting-proficiency',
    ],
  },
  {
    id: 'beginner',
    title: 'Beginner Firearm Training',
    slug: 'beginner-training',
    icon: '🎯',
    description:
      'Safe, supportive entry-level training for new and inexperienced shooters. Build confidence and fundamentals from day one.',
    courses: [
      'basic-handgun-skills-training',
      'first-shots-basic-firearm-training',
      'introduction-to-firearms',
    ],
  },
  {
    id: 'defensive',
    title: 'Defensive & Scenario-Based Training',
    slug: 'defensive-training',
    icon: '🛡️',
    description:
      'Real-world defensive skills including concealed carry, active shooter response, home defense, and scenario-based training.',
    courses: ['defensive-shooting-skills', 'concealed-carry-home-defense'],
  },
  {
    id: 'security',
    title: 'Security Training & Certification',
    slug: 'security-training',
    icon: '🔒',
    description:
      'Career-track certification for armed security officers, personal protection professionals, and unarmed security personnel.',
    courses: [
      'level-2-security-officer',
      'level-3-armed-security-officer',
      'level-4-bodyguard',
      'level-3-4-complete-package',
      'non-lethal-defense-training',
      'firearm-proficiency-requalification',
      'armed-first-responder',
    ],
  },
  {
    id: 'rifle-shotgun',
    title: 'Rifle & Shotgun Training',
    slug: 'rifle-shotgun-training',
    icon: '🎯',
    description:
      'Hands-on rifle and shotgun courses for students expanding beyond handguns. Safe handling, operation, and live-fire marksmanship training on the range.',
    courses: ['shotgun-course', 'ar-15-rifle-course'],
  },
  {
    id: 'first-aid-medical',
    title: 'First Aid & Medical Response',
    slug: 'first-aid-medical',
    icon: '🩺',
    description:
      'Hands-on Stop the Bleed and First Aid training for individuals, churches, businesses, schools, and security teams. Be ready to respond when seconds matter.',
    courses: ['stop-the-bleed-training', 'first-aid-training'],
  },
];

/* ─── All 15 individual course offerings ─── */
export const courses: Record<string, Course> = {
  /* ═══════════════════════════════════════════
     LICENSE TO CARRY & CERTIFICATION
     ═══════════════════════════════════════════ */

  'online-texas-ltc-assessment': {
    slug: 'online-texas-ltc-assessment',
    category: 'License to Carry & Certification',
    categoryTags: ['License to Carry', 'Beginner'],
    title: 'Online Texas License to Carry Assessment',
    tagline: 'Complete Your LTC Classroom Portion Online.',
    description:
      'Take the Texas LTC classroom portion online at your own pace, then schedule your live-fire proficiency qualification with Corsair at the range.',
    longDescription:
      'This course allows you to complete the Texas License to Carry classroom instruction online through the state-approved DPS portal. Once you finish the online portion, schedule your live-fire proficiency qualification with Corsair Tactical Solutions at the range. Convenient for busy schedules \u2014 study when you want, qualify when you\u2019re ready.',
    image: '/images/corsair-real/online-ltc-computer-01.jpg',
    imageAlt: 'Complete your Texas LTC classroom portion online at your own pace',
    duration: '4\u20136 hrs online + range',
    level: 'Beginner',
    price: 'From $49',
    keyPoints: [
      'Complete classroom portion online',
      'Self-paced learning',
      'Schedule range qualification separately',
      'State-approved curriculum',
    ],
    whatYouLearn: [
      'Texas laws on use of force and deadly force',
      'Handgun safety and proper storage',
      'Non-violent dispute resolution',
      'Proper shooting fundamentals',
      'Live-fire proficiency qualification (at range)',
    ],
    whoIsItFor: [
      'Students with scheduling constraints',
      'Anyone preferring self-paced online learning',
      'LTC applicants comfortable with basic handgun handling',
    ],
    prerequisites: [
      'Valid Texas ID or Driver\u2019s License',
      'No felony convictions',
      'Must be 21+ (18 for active military)',
      'Basic firearm handling experience recommended',
    ],
    whatToBring: [
      'Valid government-issued photo ID',
      'Semi-automatic handgun or revolver (.22 cal minimum)',
      '50 rounds of ammunition',
      'Eye and ear protection',
    ],
    cta: 'Register Online',
    pricingOptions: [
      {
        id: 'online-ltc',
        name: 'Online LTC Assessment',
        price: 49,
        description: 'Online classroom + range qualification',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access for proficiency test' },
    ],
    optionalAddOns: [
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the qualification' },
    ],
  },

  'texas-ltc-wichita': {
    slug: 'texas-ltc-wichita',
    category: 'License to Carry & Certification',
    categoryTags: ['License to Carry', 'Beginner'],
    title: 'Texas License to Carry Certification (Wichita)',
    tagline: 'LTC Certification in the Wichita Falls Area.',
    description:
      'Full Texas License to Carry certification course held in the Wichita Falls area. Classroom instruction, legal education, and live-fire qualification.',
    longDescription:
      'Our Texas License to Carry course is fully state-approved and meets all DPS requirements for LTC certification. This session is held in the Wichita Falls area for students in North Texas. Covers Texas laws regarding use of force and deadly force, handgun safety and storage, non-violent dispute resolution, and live-fire proficiency qualification.',
    image: '/images/corsair-real/range-lineup-01.jpg',
    imageAlt: 'Adult LTC class and range qualification training',
    duration: '6\u20138 hrs',
    level: 'Beginner',
    price: 'From $125',
    keyPoints: [
      'Wichita Falls area location',
      'State-approved DPS certification',
      'Texas gun laws & use of force',
      'Live-fire proficiency test',
    ],
    whatYouLearn: [
      'Texas laws on use of force and deadly force',
      'Handgun safety and proper storage',
      'Non-violent dispute resolution strategies',
      'Proper shooting fundamentals and stance',
      'Live-fire proficiency qualification',
    ],
    whoIsItFor: [
      'North Texas residents seeking LTC',
      'First-time gun owners in the Wichita Falls area',
      'Anyone needing LTC certification',
    ],
    prerequisites: [
      'Valid Texas ID or Driver\u2019s License',
      'No felony convictions',
      'Must be 21+ (18 for active military)',
    ],
    whatToBring: [
      'Valid government-issued photo ID',
      'Semi-automatic handgun or revolver (.22 cal minimum)',
      '50 rounds of ammunition',
      'Eye and ear protection',
    ],
    cta: 'Reserve Your Spot',
    pricingOptions: [
      {
        id: 'ltc-wichita',
        name: 'LTC Certification (Wichita)',
        price: 125,
        description: 'Complete LTC certification \u2014 classroom + range',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access for proficiency test' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the qualification' },
    ],
  },

  'texas-ltc-certification-basic-handgun': {
    slug: 'texas-ltc-certification-basic-handgun',
    category: 'License to Carry & Certification',
    categoryTags: ['License to Carry', 'Beginner'],
    title: 'Texas License to Carry Certification / Basic Handgun',
    tagline: 'LTC + Handgun Fundamentals. Two Courses, One Day.',
    description:
      'Combined Texas LTC certification with basic handgun fundamentals. Perfect for students who need both their LTC and foundational shooting skills in a single session.',
    longDescription:
      'This combined course gives you both the Texas License to Carry certification and basic handgun fundamentals training in one comprehensive session. Ideal for students who want their LTC but also need to build or reinforce core shooting skills. Covers Texas gun laws, use of force, safety, grip, stance, sight alignment, trigger control, and live-fire proficiency qualification.',
    image: '/images/corsair-real/ltc-cert-basic-handgun-01.png',
    imageAlt: 'Texas LTC Certification class with students learning at Corsair Tactical Solutions',
    duration: '6\u20137 hrs',
    level: 'Beginner',
    price: 'From $100',
    keyPoints: [
      'LTC certification + handgun fundamentals',
      'Two courses combined into one day',
      'Great value for new gun owners',
      'Live-fire qualification included',
    ],
    whatYouLearn: [
      'Texas laws on use of force and deadly force',
      'Four fundamental rules of firearm safety',
      'Proper grip, stance, and sight alignment',
      'Trigger control and breathing techniques',
      'Loading and unloading procedures',
      'Live-fire proficiency qualification',
    ],
    whoIsItFor: [
      'New gun owners who need LTC and fundamentals',
      'Students wanting both certifications efficiently',
      'First-time shooters seeking a complete foundation',
    ],
    prerequisites: [
      'Valid Texas ID or Driver\u2019s License',
      'No felony convictions',
      'Must be 21+ (18 for active military)',
    ],
    whatToBring: [
      'Valid government-issued photo ID',
      'Semi-automatic handgun or revolver (.22 cal minimum)',
      '50 rounds of ammunition',
      'Eye and ear protection',
    ],
    cta: 'Reserve Your Spot',
    urgencyMessage: 'Combined course saves you time and money \u2014 spots fill fast!',
    pricingOptions: [
      {
        id: 'ltc-bh-combo',
        name: 'LTC + Basic Handgun Combo',
        price: 100,
        description: 'LTC certification + handgun fundamentals in one day',
        popular: true,
        badge: 'Best Value',
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access for proficiency test' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the qualification' },
    ],
  },

  'texas-ltc-shooting-proficiency': {
    slug: 'texas-ltc-shooting-proficiency',
    category: 'License to Carry & Certification',
    categoryTags: ['License to Carry', 'Defensive'],
    title: 'Texas LTC Shooting Proficiency',
    tagline: 'Qualify for Your LTC. Pass the Range Test.',
    description:
      'Live-fire shooting proficiency qualification for the Texas License to Carry. Schedule your range qualification with a certified LTC instructor.',
    longDescription:
      'This session is for students who have completed the LTC classroom instruction (online or in-person) and need to complete the live-fire shooting proficiency qualification. A certified LTC instructor will guide you through the qualification course of fire and submit your passing score to DPS. Bring your own firearm and ammo, or rent from us.',
    image: '/images/corsair-real/ltc-shooting-proficiency-01.png',
    imageAlt: 'Handgun target qualification at the range for LTC proficiency',
    duration: '1\u20132 hrs',
    level: 'Beginner',
    price: 'From $70',
    keyPoints: [
      'Live-fire LTC qualification only',
      'Certified LTC instructor signs off',
      'DPS score submission included',
      'Firearm rental available',
    ],
    whatYouLearn: [
      'LTC qualification course of fire',
      'Proper shooting fundamentals review',
      'Timed shooting proficiency standards',
      'Range safety and commands',
    ],
    whoIsItFor: [
      'Students who completed online LTC classroom',
      'Anyone needing to re-qualify for LTC renewal',
      'Students who need only the range portion',
    ],
    prerequisites: [
      'Completed LTC classroom instruction',
      'Basic handgun handling experience',
      'Valid Texas ID or Driver\u2019s License',
    ],
    whatToBring: [
      'Valid government-issued photo ID',
      'Semi-automatic handgun or revolver (.22 cal minimum)',
      '50 rounds of ammunition',
      'Eye and ear protection',
    ],
    cta: 'Schedule Qualification',
    pricingOptions: [
      {
        id: 'ltc-prof',
        name: 'LTC Shooting Proficiency',
        price: 70,
        description: 'Live-fire qualification with instructor sign-off',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the qualification' },
    ],
  },

  /* ═══════════════════════════════════════════
     BEGINNER FIREARM TRAINING
     ═══════════════════════════════════════════ */

  'basic-handgun-skills-training': {
    slug: 'basic-handgun-skills-training',
    category: 'Beginner Firearm Training',
    categoryTags: ['Beginner', 'Private Training'],
    title: 'Basic Handgun Skills Training (Personal 1:1)',
    tagline: 'One-on-One Handgun Training at the Range.',
    description:
      'Private one-on-one handgun training session personalized to your skill level. Learn grip, stance, sight alignment, and shooting fundamentals with dedicated instructor attention.',
    longDescription:
      'This is a private, one-on-one handgun training session designed for students who want personalized instruction. Whether you\u2019re picking up a handgun for the first time or refining your fundamentals, your instructor will tailor the session to your exact needs. Covers the four rules of firearm safety, proper grip, stance, sight alignment, trigger control, loading/unloading, and live-fire practice. Completely judgment-free \u2014 learn at your pace.',
    image: '/images/corsair-real/basic-handgun-1on1-personal-01.jpg',
    imageAlt: 'Student reviewing her target at the indoor range during personal 1:1 handgun training with Corsair',
    imagePosition: 'object-center',
    duration: '1.5 hrs',
    level: 'Beginner',
    price: 'From $75',
    keyPoints: [
      '100% personalized 1-on-1 instruction',
      'Tailored to your experience level',
      'Judgment-free environment',
      'Hands-on range time included',
    ],
    whatYouLearn: [
      'Four fundamental rules of firearm safety',
      'Proper grip, stance, and sight alignment',
      'Trigger control and breathing techniques',
      'Loading and unloading procedures',
      'Basic marksmanship fundamentals',
    ],
    whoIsItFor: [
      'Complete beginners wanting personal attention',
      'Students uncomfortable in group settings',
      'Anyone wanting focused, one-on-one coaching',
    ],
    prerequisites: ['No prior experience required', 'Must be 18 years or older'],
    whatToBring: [
      'Valid government-issued ID',
      'Eye and ear protection',
      'Comfortable clothing and closed-toe shoes',
      'Firearm and ammunition (or rent from us)',
    ],
    cta: 'Book Your Session',
    urgencyMessage: 'Limited instructor availability \u2014 book early!',
    pricingOptions: [
      {
        id: 'bh-1session',
        name: '1 Session (1.5 hrs)',
        price: 75,
        description: 'Single private training session',
        popular: true,
      },
      {
        id: 'bh-3session',
        name: '3-Session Pack',
        price: 210,
        description: 'Three 1.5-hour sessions',
        savings: 'Save $15',
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the session' },
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
    ],
  },

  'first-shots-basic-firearm-training': {
    slug: 'first-shots-basic-firearm-training',
    category: 'Beginner Firearm Training',
    categoryTags: ['Beginner', "Women's Training"],
    title: 'First Shots Basic Firearm Training',
    tagline: 'Your First Time on the Range. Safe. Supportive. Fun.',
    description:
      'The perfect first class for brand-new shooters. Learn firearm safety, handling, and take your first shots on the range in a comfortable, supportive group environment.',
    longDescription:
      'First Shots is designed for people who have never fired a gun before. This beginner-friendly group class covers the absolute essentials: firearm safety rules, how a handgun works, proper grip and stance, and then you\u2019ll take your first supervised shots on the range. Small class sizes, patient instructors, and a completely judgment-free atmosphere make this the best way to start your firearms journey.',
    image: '/images/corsair-real/first-shots-training-02.jpg',
    imageAlt: 'First Shots class students proudly holding their targets after completing the beginner firearm training course',
    imagePosition: 'object-top',
    duration: '2\u20133 hrs',
    level: 'Beginner',
    price: 'From $50',
    keyPoints: [
      'No experience required',
      'Small group class (max 8)',
      'Firearm safety fundamentals',
      'Your first supervised shots on the range',
    ],
    whatYouLearn: [
      'Four fundamental rules of firearm safety',
      'How a semi-automatic handgun works',
      'Proper grip, stance, and sight alignment',
      'Trigger control basics',
      'Live-fire practice with instructor guidance',
    ],
    whoIsItFor: [
      'Complete beginners who have never shot before',
      'Nervous first-timers wanting a safe introduction',
      'Anyone curious about firearms in a no-pressure setting',
    ],
    prerequisites: ['No prior experience required', 'Must be 18 years or older'],
    whatToBring: [
      'Valid government-issued ID',
      'Eye and ear protection (or rent from us)',
      'Comfortable clothing and closed-toe shoes',
    ],
    cta: 'Reserve Your Spot',
    urgencyMessage: 'Perfect for first-time shooters \u2014 no experience needed!',
    pricingOptions: [
      {
        id: 'fs-group',
        name: 'Group Class',
        price: 50,
        description: 'Small group instruction (max 8 students)',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun for the session' },
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
    ],
  },

  'introduction-to-firearms': {
    slug: 'introduction-to-firearms',
    category: 'Beginner Firearm Training',
    categoryTags: ['Beginner'],
    title: 'Introduction to Firearms',
    tagline: 'Learn the Basics. Build Confidence. Start Safe.',
    description:
      'A comprehensive introduction to firearms covering safety, types of handguns, ammunition, and basic handling. Ideal for anyone considering firearm ownership.',
    longDescription:
      'Thinking about buying a firearm or just want to understand the basics? This classroom and range course covers everything a new or prospective gun owner needs to know. You\u2019ll learn about different types of handguns, ammunition calibers, safe storage, the four rules of firearm safety, and basic handling techniques. Includes supervised range time so you can try different firearms and find what works for you.',
    image: '/images/corsair-real/student-target-success-01.jpg',
    imageAlt: 'Safe handgun fundamentals and introduction to firearms training',
    duration: '3\u20134 hrs',
    level: 'Beginner',
    price: 'From $50',
    keyPoints: [
      'Classroom + range combo',
      'Try different firearm types',
      'Safe storage and handling',
      'No prior experience needed',
    ],
    whatYouLearn: [
      'Types of handguns (revolver vs semi-automatic)',
      'Ammunition types and calibers',
      'Safe storage and home safety',
      'Four fundamental rules of firearm safety',
      'Basic handling and live-fire practice',
    ],
    whoIsItFor: [
      'Anyone considering firearm ownership',
      'New gun owners wanting a solid foundation',
      'Students who want to try before they buy',
    ],
    prerequisites: ['No prior experience required', 'Must be 18 years or older'],
    whatToBring: [
      'Valid government-issued ID',
      'Eye and ear protection',
      'Comfortable clothing and closed-toe shoes',
    ],
    cta: 'Reserve Your Spot',
    pricingOptions: [
      {
        id: 'intro-group',
        name: 'Group Class',
        price: 50,
        description: 'Small group instruction with range time',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Try different handguns' },
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
    ],
  },

  /* ═══════════════════════════════════════════
     DEFENSIVE & SCENARIO-BASED TRAINING
     ═══════════════════════════════════════════ */

  'defensive-shooting-skills': {
    slug: 'defensive-shooting-skills',
    category: 'Defensive & Scenario-Based Training',
    categoryTags: ['Defensive', 'Private Training'],
    title: 'Defensive Shooting Skills',
    tagline: 'Train for Real-World Situations. Protect What Matters.',
    description:
      'Build real-world defensive shooting skills with holster work, movement, situational awareness, and controlled shooting drills at the range.',
    longDescription:
      'This is where skill meets reality. Learn how to react under pressure, draw from concealment, shoot on the move, and engage threats in realistic scenarios. Builds the muscle memory, mindset, and situational awareness needed to protect yourself and your family when it matters most. All drills are conducted under close instructor supervision with an emphasis on safety at all times.',
    image: '/images/corsair-real/defensive-shooting-skills-01.jpg',
    imageAlt: 'Student holding her target after completing Defensive Shooting Skills training at Corsair Tactical Solutions',
    imagePosition: 'object-center',
    duration: '4\u20136 hrs',
    level: 'Intermediate',
    price: 'From $50',
    keyPoints: [
      'Scenario-based defensive training',
      'Draw from holster & concealment',
      'Movement and target engagement',
      'Situational awareness mindset',
    ],
    whatYouLearn: [
      'Draw from holster and concealed carry',
      'Shooting on the move and from cover',
      'Multiple threat engagement',
      'Reload techniques under stress',
      'Malfunction clearing',
      'Low-light shooting fundamentals',
    ],
    whoIsItFor: [
      'LTC holders who want practical defensive skills',
      'Intermediate shooters ready to level up',
      'Anyone carrying for personal protection',
    ],
    prerequisites: [
      'Previous handgun training or equivalent experience',
      'Must be 21 years or older',
      'Valid LTC recommended',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Semi-automatic handgun with holster',
      '200 rounds of ammunition',
      'Spare magazines',
      'Eye and ear protection',
      'Concealment garment',
    ],
    cta: 'Level Up Your Skills',
    pricingOptions: [
      { id: 'dss-standard', name: 'Standard Course', price: 50, description: 'Core defensive skills' },
      {
        id: 'dss-advanced',
        name: 'Advanced Package',
        price: 125,
        description: 'Extended scenarios + low-light training',
        badge: 'Best Value',
        savings: 'Save $25',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the session' },
    ],
  },

  /* ═══════════════════════════════════════════
     SECURITY TRAINING & CERTIFICATION
     ═══════════════════════════════════════════ */

  'level-2-security-officer': {
    slug: 'level-2-security-officer',
    category: 'Security Training & Certification',
    categoryTags: ['Security Training', 'Beginner'],
    title: 'Level 2 Unarmed Security Officer',
    tagline: 'Texas DPS Level II Unarmed Security Certification.',
    description:
      'Texas DPS Level II unarmed security officer certification. Classroom training covering security law, use of force, emergency procedures, and Texas Private Security Bureau requirements.',
    longDescription:
      'This course meets all Texas DPS Private Security Bureau requirements for Level II unarmed security officer certification. The curriculum covers Texas security law, code of ethics, use of force, emergency procedures, report writing, and communications. Upon successful completion you are eligible to apply for your Level II registration card and legally work as an unarmed security officer in Texas.',
    image: '/images/corsair-real/level-2-unarmed-officer-01.png',
    imageAlt: 'Level II unarmed security officer training certification',
    duration: '1–2 days',
    level: 'Beginner',
    price: 'From $65',
    keyPoints: [
      'Texas DPS Level II certification',
      'State-required curriculum',
      'Security law & use of force',
      'Entry point for security career',
    ],
    whatYouLearn: [
      'Texas security officer laws and regulations',
      'Code of ethics and professional conduct',
      'Use of force and legal authority',
      'Emergency procedures and first response',
      'Report writing and documentation',
      'Communication and patrol techniques',
    ],
    whoIsItFor: [
      'Anyone entering the security industry',
      'Individuals pursuing a security career',
      'Existing security staff needing Texas DPS certification',
    ],
    prerequisites: [
      'Must be 18 years or older',
      'Clean criminal background',
      'Valid government-issued ID required',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Note-taking materials',
      'Comfortable clothing',
    ],
    cta: 'Start Level II Certification',
    pricingOptions: [
      {
        id: 'l2-base',
        name: 'Level II — Unarmed',
        price: 65,
        description: 'Complete unarmed security officer certification',
        popular: true,
      },
    ],
  },

  'level-3-armed-security-officer': {
    slug: 'level-3-armed-security-officer',
    category: 'Security Training & Certification',
    categoryTags: ['Security Training', 'Defensive', 'Instructor / Professional'],
    title: 'Level 3 Armed Security Officer \u2014 Commissioned',
    tagline: 'Level III Armed Security Certification. Carry on Duty.',
    description:
      'Texas DPS Level III commissioned armed security officer certification. Classroom instruction, use of force law, defensive tactics, and live-fire range qualification.',
    longDescription:
      'This course meets all Texas DPS Private Security Bureau requirements for Level III commissioned armed security officer certification. The curriculum includes classroom instruction on use of force law, defensive tactics, conflict resolution, and emergency response, plus live-fire range qualification. Upon successful completion, you will be eligible to apply for your Level III commission card and carry a firearm on duty.',
    image: '/images/corsair-real/level-3-armed-security-01.jpg',
    imageAlt: 'Level 3 armed security officers in defensive tactics training drill',
    duration: '3\u20135 days',
    level: 'Intermediate',
    price: 'From $130',
    keyPoints: [
      'Level III armed certification',
      'Live-fire range qualification',
      'Use of force law & defensive tactics',
      'Texas DPS compliant',
    ],
    whatYouLearn: [
      'Use of force law and legal authority',
      'Defensive tactics and control techniques',
      'Firearm proficiency and qualification',
      'Conflict resolution and de-escalation',
      'Emergency response procedures',
      'Report writing and documentation',
    ],
    whoIsItFor: [
      'Armed security officer applicants',
      'Level II officers upgrading to armed',
      'Security professionals needing Level III renewal',
    ],
    prerequisites: [
      'Must be 21 years or older',
      'Clean criminal background',
      'Valid Level II commission (recommended)',
      'Basic firearm handling experience',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Duty handgun, belt, and holster',
      '150 rounds of ammunition',
      'Eye and ear protection',
      'Note-taking materials',
    ],
    cta: 'Start Level III Certification',
    pricingOptions: [
      {
        id: 'l3-base',
        name: 'Level III \u2014 Armed',
        price: 130,
        description: 'Complete armed security officer certification',
        popular: true,
        badge: 'Most Popular',
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access for qualification' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the qualification' },
    ],
  },

  'level-4-bodyguard': {
    slug: 'level-4-bodyguard',
    category: 'Security Training & Certification',
    categoryTags: ['Security Training', 'Instructor / Professional'],
    title: 'Level 4 Bodyguard (Personal Protection Officer)',
    tagline: 'Level IV PPO Certification. Protect and Serve.',
    description:
      'Texas DPS Level IV Personal Protection Officer (bodyguard) certification. Advanced training in executive protection, threat assessment, and close-quarters defense.',
    longDescription:
      'This advanced course meets Texas DPS Private Security Bureau requirements for Level IV Personal Protection Officer certification. The curriculum covers executive protection principles, threat assessment, advance work, motorcade operations, close-quarters defense, and emergency medical response. Includes live-fire range qualification. Upon successful completion, you will be eligible to apply for your Level IV commission as a Personal Protection Officer.',
    image: '/images/corsair-real/level-4-bodyguard-01.jpg',
    imageAlt: 'Level 4 bodyguard escorting a principal to a vehicle — executive protection training',
    duration: '3\u20135 days',
    level: 'Advanced',
    price: 'From $225',
    keyPoints: [
      'Level IV PPO (bodyguard) certification',
      'Executive protection principles',
      'Threat assessment & advance work',
      'Live-fire qualification included',
    ],
    whatYouLearn: [
      'Executive protection principles and planning',
      'Threat assessment and risk management',
      'Advance work and route planning',
      'Close-quarters defense techniques',
      'Motorcade and movement operations',
      'Emergency medical response basics',
    ],
    whoIsItFor: [
      'Personal protection officer candidates',
      'Executive protection professionals',
      'Level III officers upgrading to PPO',
    ],
    prerequisites: [
      'Must be 21 years or older',
      'Valid Level III commission',
      'Clean criminal background',
      'Previous security or law enforcement experience recommended',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Duty handgun, belt, and holster',
      '200 rounds of ammunition',
      'Eye and ear protection',
      'Note-taking materials',
    ],
    cta: 'Start Level IV Certification',
    pricingOptions: [
      {
        id: 'l4-base',
        name: 'Level IV \u2014 PPO / Bodyguard',
        price: 225,
        description: 'Personal Protection Officer certification',
        popular: true,
        badge: 'Advanced',
      },
    ],
  },

  /* ═══════════════════════════════════════════
     CONCEALED CARRY & HOME DEFENSE
     ═══════════════════════════════════════════ */

  'concealed-carry-home-defense': {
    slug: 'concealed-carry-home-defense',
    category: 'Defensive & Scenario-Based Training',
    categoryTags: ['Defensive', 'Beginner'],
    title: 'Concealed Carry Home Defense',
    tagline: 'Fundamentals 2nd Edition — Home Defense & Carry Skills.',
    description:
      'Learn basic firearm handling, situational awareness, ammunition, and firearm storage. This 6.5-hour class includes live range time with instructors.',
    longDescription:
      'This 6.5-hour course uses the USCCA Concealed Carry & Home Defense Fundamentals curriculum. Students learn safe firearm handling, situational awareness, ammunition selection, proper storage, and practical defensive skills. The class includes dedicated range time with instructors so students reinforce every skill taught in the classroom. Perfect for new LTC holders and anyone serious about home defense.',
    image: '/images/corsair-real/concealed-carry-home-defense-01.jpg',
    imageAlt: 'Instructor demonstrating defensive control technique during Concealed Carry Home Defense class',
    imagePosition: 'object-center',
    duration: '6.5 hrs',
    level: 'Beginner',
    price: 'From $150',
    keyPoints: [
      'USCCA Fundamentals 2nd Edition curriculum',
      'Situational awareness & home defense',
      'Ammunition selection & safe storage',
      'Live range time with instructors',
    ],
    whatYouLearn: [
      'Safe firearm handling and operation',
      'Situational awareness and threat recognition',
      'Ammunition types and proper selection',
      'Firearm storage and home security',
      'Defensive shooting fundamentals',
      'Concealed carry best practices',
    ],
    whoIsItFor: [
      'New and intermediate shooters',
      'LTC holders wanting practical defensive skills',
      'Homeowners focused on personal protection',
    ],
    prerequisites: [
      'Must be 21 years or older',
      'Valid LTC or eligibility to carry',
      'Basic firearm handling experience recommended',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Semi-automatic handgun with holster',
      '100 rounds of ammunition',
      'Eye and ear protection',
      'Comfortable clothing and closed-toe shoes',
    ],
    cta: 'Reserve Your Spot',
    urgencyMessage: 'Limited class sizes — reserve early!',
    pricingOptions: [
      {
        id: 'cchd-standard',
        name: 'Concealed Carry Home Defense',
        price: 150,
        description: 'Full 6.5-hour course with range time',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the class' },
    ],
  },

  /* ═══════════════════════════════════════════
     SECURITY BUNDLES & SPECIALTY
     ═══════════════════════════════════════════ */

  'level-3-4-complete-package': {
    slug: 'level-3-4-complete-package',
    category: 'Security Training & Certification',
    categoryTags: ['Security Training', 'Instructor / Professional'],
    title: 'Level III + IV Complete Package',
    tagline: 'Everything You Need for the Highest Levels of Security.',
    description:
      'Complete training bundle including Level III Commissioned Officer, Level IV Personal Protection, and Texas LTC certification — the best value in professional security training.',
    longDescription:
      'This bundle gives security professionals everything they need: Level III commissioned armed security officer certification, Level IV Personal Protection Officer (bodyguard) certification, and Texas LTC certification — all included. Covers all Level III and IV curriculum, use of force law, defensive tactics, live-fire range qualification, executive protection principles, and threat assessment. MMPI required.',
    image: '/images/corsair-real/hilton-training-braids-01.jpg',
    imageAlt: 'Corsair instructor Hilton Jackson providing hands-on range coaching during Level III/IV security training',
    duration: '5–7 days',
    level: 'Advanced',
    price: 'From $400',
    keyPoints: [
      'All Level III curriculum included',
      'All Level IV curriculum included',
      'Texas LTC certification included',
      'MMPI required — best value bundle',
    ],
    whatYouLearn: [
      'Complete Level III armed officer curriculum',
      'Executive protection and Level IV PPO skills',
      'Texas LTC certification requirements',
      'Use of force law and legal authority',
      'Live-fire range qualification',
      'Threat assessment and emergency response',
    ],
    whoIsItFor: [
      'Aspiring high-level security professionals',
      'Level II officers pursuing full armed + PPO certification',
      'Anyone wanting the most comprehensive security package',
    ],
    prerequisites: [
      'Must be 21 years or older',
      'Valid Level II commission (recommended)',
      'Clean criminal background',
      'MMPI required',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Duty handgun, belt, and holster',
      '250 rounds of ammunition',
      'Eye and ear protection',
      'Note-taking materials',
    ],
    cta: 'Get the Full Package',
    urgencyMessage: 'Best value — all three certifications in one bundle!',
    pricingOptions: [
      {
        id: 'l34-bundle',
        name: 'Level III + IV Complete Package',
        price: 400,
        description: 'Level III + Level IV + Texas LTC — all included',
        popular: true,
        badge: 'Best Value',
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access for qualification' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the qualification' },
    ],
  },

  'non-lethal-defense-training': {
    slug: 'non-lethal-defense-training',
    category: 'Security Training & Certification',
    categoryTags: ['Security Training', 'Defensive'],
    title: 'Non-Lethal Defense Training',
    tagline: 'Personal Defense Spray, Less-Lethal Options & Situational Awareness.',
    description:
      'Comprehensive non-lethal defense training covering personal defensive spray, less-lethal options, and situational awareness for individuals, security teams, and organizations.',
    longDescription:
      'This course covers the full spectrum of non-lethal defense: personal defensive spray techniques, less-lethal weapon options and law, de-escalation and threat avoidance, and the use of force continuum. Offered through the Alliance Training Team, this training is available for individuals and group/organizational sessions. Perfect for security teams, businesses, and anyone seeking non-firearm defensive skills.',
    image: '/images/corsair-real/classroom-training-group-01.jpg',
    imageAlt: 'Non-lethal defense training classroom instruction',
    duration: 'Varies',
    level: 'All Levels',
    price: 'Call for Pricing',
    keyPoints: [
      'Personal defensive spray techniques',
      'Less-lethal weapon options & law',
      'De-escalation & threat avoidance',
      'Individual & group sessions available',
    ],
    whatYouLearn: [
      'Personal defensive spray deployment',
      'Less-lethal weapon options and legal use',
      'De-escalation and conflict avoidance',
      'Use of force continuum',
      'Situational awareness fundamentals',
    ],
    whoIsItFor: [
      'Individuals wanting non-firearm defensive skills',
      'Security teams and organizations',
      'Businesses seeking staff safety training',
    ],
    prerequisites: [
      'No prior experience required',
      'Must be 18 years or older',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Comfortable clothing',
      'Note-taking materials',
    ],
    cta: 'Call to Schedule',
    contactOnly: true,
    pricingOptions: [
      {
        id: 'nlt-standard',
        name: 'Non-Lethal Defense Training',
        price: 0,
        priceLabel: 'Call for Pricing',
        description: 'Contact us to schedule — individual & group rates available',
        popular: true,
      },
    ],
  },

  'firearm-proficiency-requalification': {
    slug: 'firearm-proficiency-requalification',
    category: 'Security Training & Certification',
    categoryTags: ['Security Training', 'Instructor / Professional'],
    title: 'Firearm Proficiency Re-Qualification',
    tagline: 'Annual Re-Qual for Level III & IV Security Officers.',
    description:
      'Firearm recertification for currently commissioned security personnel requiring annual or periodic re-qualification to maintain their licensure.',
    longDescription:
      'Currently commissioned Level III and Level IV security officers are required by Texas DPS to periodically re-qualify with their firearm to maintain their commission. This re-qualification session includes a live-fire qualification course conducted by a certified instructor, DPS-compliant documentation, and sign-off for license renewal. Schedule your re-qual at a time that works for you.',
    image: '/images/corsair-real/firearm-requalification-01.png',
    imageAlt: 'Security officer firearm re-qualification at indoor range',
    duration: '1–2 hrs',
    level: 'Intermediate',
    price: 'From $75',
    keyPoints: [
      'Live-fire qualification course',
      'DPS-compliant documentation',
      'Level III & IV officers',
      'Flexible scheduling',
    ],
    whatYouLearn: [
      'Live-fire qualification course of fire',
      'Current firearms safety review',
      'DPS re-qualification standards',
      'Documentation for license renewal',
    ],
    whoIsItFor: [
      'Commissioned Level III armed security officers',
      'Level IV PPO officers needing re-qual',
      'Security professionals maintaining licensure',
    ],
    prerequisites: [
      'Valid Level III or Level IV commission card',
      'Must be 21 years or older',
      'Bring duty firearm and holster',
    ],
    whatToBring: [
      'Valid Level III or IV commission card',
      'Duty handgun and holster',
      '50 rounds of duty ammunition',
      'Eye and ear protection',
    ],
    cta: 'Schedule Re-Qual',
    pricingOptions: [
      {
        id: 'requalify',
        name: 'Firearm Re-Qualification',
        price: 75,
        description: 'Live-fire qual with DPS documentation',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammunition Purchase (50 Rounds)', price: 14, required: false, locked: false, description: '50 rounds of 9mm ammunition' },
      { id: 'firearm-rental', label: 'Gun Rental', price: 12.99, required: false, locked: false, description: 'Handgun rental for the session' },
    ],
  },

  'armed-first-responder': {
    slug: 'armed-first-responder',
    category: 'Church & Business Safety',
    categoryTags: ['Church / Business Safety', 'Security Training', 'Defensive', 'First Aid / Medical'],
    title: 'Armed First Responder',
    tagline: 'Advanced Certification for Texas LTC Holders Ready to Serve.',
    description:
      'Advanced 3-day certification for qualified Texas LTC holders who want to serve as armed first responders in churches, schools, or other organizations.',
    longDescription:
      'The Armed First Responder course is an advanced 3-day intensive certification designed for Texas LTC holders who want to take on the responsibility of protecting their congregation, school, or organization. The curriculum includes classroom instruction and testing, shooting proficiency qualification, and tactical drills and scenarios. Valid Texas LTC is required. Graduates earn a Specialty Certification as an Armed First Responder.',
    image: '/images/corsair-real/armed-first-responder-01.png',
    imageAlt: 'Armed first responder training for church and school security',
    duration: '3 days',
    level: 'Advanced',
    price: 'From $595',
    keyPoints: [
      'Valid Texas LTC required',
      'Classroom instruction & testing',
      'Shooting proficiency qualification',
      'Tactical drills & scenarios',
    ],
    whatYouLearn: [
      'Armed first responder doctrine and responsibilities',
      'Legal authority and use of force in church/school settings',
      'Shooting proficiency qualification',
      'Tactical drills and scenario-based training',
      'Team coordination and communication',
      'Emergency response protocols',
    ],
    whoIsItFor: [
      'Texas LTC holders serving in church security',
      'School and organizational protection volunteers',
      'Armed security team members seeking advanced certification',
    ],
    prerequisites: [
      'Valid Texas LTC required',
      'Must be 21 years or older',
      'Clean criminal background',
      'Previous firearm training recommended',
    ],
    whatToBring: [
      'Valid Texas LTC card',
      'Valid government-issued ID',
      'Semi-automatic handgun with holster',
      '200 rounds of ammunition',
      'Eye and ear protection',
      'Note-taking materials',
    ],
    cta: 'Register Now',
    urgencyMessage: '3-day intensive — limited seats available!',
    pricingOptions: [
      {
        id: 'afr-cert',
        name: 'Armed First Responder Certification',
        price: 595,
        description: '3-day intensive with classroom, qual, and tactical drills',
        popular: true,
        badge: 'Specialty Certification',
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access for qualification' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: 'Ammo Package (200 rds 9mm)', price: 80, required: false, locked: false, description: '200 rounds of 9mm ammunition' },
    ],
  },

  /* ═════════════════════════════════════════════
     RIFLE & SHOTGUN TRAINING
     ═════════════════════════════════════════════ */

  'shotgun-course': {
    slug: 'shotgun-course',
    category: 'Rifle & Shotgun Training',
    categoryTags: ['Rifle / Shotgun', 'Beginner'],
    title: 'Shotgun Course',
    tagline: 'Master the Shotgun. Expert Instruction at the Range.',
    description:
      'Hands-on shotgun training covering safe handling, operation, stance, aiming, and live-fire fundamentals. Learn from experienced instructors in a structured range environment.',
    longDescription:
      'This shotgun course provides hands-on instruction for students who want to learn or improve their shotgun skills. Covering safe handling, proper stance, sight alignment, loading and unloading, and live-fire drills on the range. Whether you are new to shotguns or looking to build confidence and proficiency, this course is taught by experienced instructors in a safe, structured environment.',
    image: '/images/corsair-real/shotgun-course-01.png',
    imageAlt: 'Shotgun training at an indoor range with instructor',
    duration: '2–4 hrs',
    level: 'Beginner',
    price: 'From $75',
    keyPoints: [
      'Safe shotgun handling & operation',
      'Proper stance, aim, and technique',
      'Live-fire range drills',
      'Beginner-friendly instruction',
    ],
    whatYouLearn: [
      'Safe shotgun handling and operation',
      'Loading and unloading procedures',
      'Proper stance, shouldering, and aiming',
      'Ammunition types and selection',
      'Live-fire target drills on the range',
    ],
    whoIsItFor: [
      'New shotgun owners wanting proper training',
      'Hunters looking to improve proficiency',
      'Anyone interested in shotgun fundamentals',
    ],
    prerequisites: [
      'No prior experience required',
      'Must be 18 years or older',
      'Valid government-issued ID required',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Eye and ear protection',
      'Comfortable clothing and closed-toe shoes',
      'Shotgun and ammunition (or rent from us)',
    ],
    cta: 'Reserve Your Spot',
    pricingOptions: [
      {
        id: 'shotgun-base',
        name: 'Shotgun Course',
        price: 75,
        description: 'Full shotgun fundamentals course with live-fire range time',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: '50 Rounds of Ammo', price: 35, required: false, locked: false, description: '50 rounds of shotgun ammunition' },
      { id: 'shotgun-rental', label: 'Rent a Shotgun', price: 25, required: false, locked: false, description: 'Shotgun rental for the session' },
    ],
  },

  'ar-15-rifle-course': {
    slug: 'ar-15-rifle-course',
    category: 'Rifle & Shotgun Training',
    categoryTags: ['Rifle / Shotgun', 'Beginner'],
    title: 'AR-15 Rifle Course',
    tagline: 'Learn the AR-15 Platform. Accurate, Confident, and Safe.',
    description:
      'Comprehensive AR-15 training covering safe handling, operation, marksmanship fundamentals, and live-fire range drills with experienced instructors.',
    longDescription:
      'This AR-15 rifle course covers everything you need to confidently and safely operate the AR-15 platform. From basic handling, safety, and components to proper stance, sight alignment, trigger control, and live-fire marksmanship drills. Whether you are new to the AR-15 or building on existing skills, our instructors provide expert, hands-on guidance throughout the session.',
    image: '/images/corsair-real/ar-15-rifle-course-02.png',
    imageAlt: 'AR-15 rifle with red dot optic and Fiocchi ammunition — Corsair Tactical Solutions',
    imagePosition: 'object-contain',
    duration: '3–5 hrs',
    level: 'Beginner',
    price: 'From $90',
    keyPoints: [
      'AR-15 safe handling & operation',
      'Marksmanship fundamentals',
      'Live-fire range drills',
      'Expert instructor coaching',
    ],
    whatYouLearn: [
      'AR-15 components, safe handling, and operation',
      'Proper stance, grip, and cheek weld',
      'Sight alignment and trigger control',
      'Loading, unloading, and malfunction clearing',
      'Live-fire marksmanship drills',
    ],
    whoIsItFor: [
      'New AR-15 owners wanting proper training',
      'Intermediate shooters building rifle skills',
      'Anyone wanting to learn the AR-15 platform safely',
    ],
    prerequisites: [
      'No prior rifle experience required',
      'Must be 18 years or older',
      'Valid government-issued ID required',
    ],
    whatToBring: [
      'Valid government-issued ID',
      'Eye and ear protection',
      'Comfortable clothing and closed-toe shoes',
      'AR-15 and ammunition (or rent from us)',
    ],
    cta: 'Reserve Your Spot',
    pricingOptions: [
      {
        id: 'ar15-base',
        name: 'AR-15 Rifle Course',
        price: 90,
        description: 'Full AR-15 fundamentals course with live-fire range time',
        popular: true,
      },
    ],
    requiredFees: [
      { id: 'range-fee', label: 'Range Fee', price: 25, required: true, locked: true, description: 'Indoor range access' },
    ],
    optionalAddOns: [
      { id: 'ammo-package', label: '50 Rounds of Ammo', price: 40, required: false, locked: false, description: '50 rounds of AR-15 ammunition' },
      { id: 'ar15-rental', label: 'Rent an AR-15 Rifle', price: 35, required: false, locked: false, description: 'AR-15 rental for the session' },
    ],
  },

  /* ═══════════════════════════════════════════
     FIRST AID & MEDICAL RESPONSE
     ═══════════════════════════════════════════ */

  'stop-the-bleed-training': {
    slug: 'stop-the-bleed-training',
    category: 'First Aid & Medical Response',
    categoryTags: ['First Aid / Medical', 'Church / Business Safety'],
    title: 'Stop the Bleed Training',
    tagline: 'Take Immediate Action. Save a Life.',
    description:
      'Uncontrolled bleeding can cause death in as little as five minutes. Stop the Bleed training teaches participants how to take immediate, life-saving action during a traumatic injury event until professional medical care arrives.',
    longDescription:
      'Uncontrolled bleeding can cause death in as little as five minutes. Stop the Bleed training teaches participants how to take immediate action during a traumatic injury event until professional medical care arrives.\n\nTraining includes identifying life-threatening bleeding, wound packing techniques, direct pressure application, tourniquet selection and proper application, improvised bleeding control methods, casualty assessment, trauma kit familiarization, and active threat and mass casualty response considerations.\n\nOur instructors bring real-world experience from military, security, emergency response, and protective services environments. We focus on practical skills, situational awareness, and confidence-building to ensure participants can perform effectively under stress.',
    image: '/images/corsair-real/stop-the-bleed-training-02.jpg',
    imageAlt: 'Stop the Bleed Training — Corsair Tactical Solutions',
    imagePosition: 'object-center',
    duration: '2–3 hrs',
    level: 'All Levels',
    price: '$75',
    keyPoints: [
      'Identify life-threatening bleeding',
      'Wound packing techniques',
      'Tourniquet selection & application',
      'Improvised bleeding control',
      'Trauma kit familiarization',
      'Mass casualty response',
    ],
    whatYouLearn: [
      'Identify and respond to life-threatening bleeding',
      'Apply direct pressure and wound packing',
      'Select and properly apply a tourniquet',
      'Use improvised materials for bleeding control',
      'Perform a rapid casualty assessment',
      'Familiarize with trauma kit contents',
      'Understand active threat and mass casualty considerations',
    ],
    whoIsItFor: [
      'Churches and faith-based organizations',
      'Security officers and safety teams',
      'Corporate offices and businesses',
      'Schools and educational institutions',
      'Event staff and volunteers',
      'Families and community groups',
    ],
    prerequisites: ['No prior medical training required'],
    whatToBring: ['Comfortable clothing suitable for hands-on exercises', 'Notebook (optional)'],
    cta: 'Register Today',
    pricingOptions: [
      {
        id: 'stop-the-bleed-standard',
        name: 'Stop the Bleed Training',
        price: 75,
        description: 'Full hands-on Stop the Bleed course',
        popular: true,
      },
    ],
    requiredFees: [],
    optionalAddOns: [],
  },

  'first-aid-training': {
    slug: 'first-aid-training',
    category: 'First Aid & Medical Response',
    categoryTags: ['First Aid / Medical', 'Church / Business Safety'],
    title: 'First Aid Training',
    tagline: 'Recognize. Respond. Reassure.',
    description:
      'Practical First Aid training that equips individuals, churches, businesses, schools, and security teams with the skills to recognize and respond to common medical emergencies — confidently and effectively.',
    longDescription:
      'Emergencies don’t wait for first responders to arrive. Corsair Tactical Solutions provides practical, hands-on First Aid training designed to equip individuals, churches, businesses, schools, security teams, and community organizations with the skills needed to respond confidently during a medical emergency.\n\nOur training focuses on real-world scenarios and proven life-saving techniques that can make the difference between life and death while waiting for EMS personnel to arrive.\n\nParticipants will learn how to recognize and respond to: medical assessments and patient care, CPR awareness and emergency response procedures, choking emergencies, cardiac emergencies, stroke recognition, seizure response, diabetic emergencies, allergic reactions and anaphylaxis, burns, fractures, and sprains, heat-related and cold-weather injuries, emergency scene management, and activation of emergency medical services.',
    image: '/images/corsair-real/first-aid-training-02.jpg',
    imageAlt: 'First Aid Training — Corsair Tactical Solutions',
    imagePosition: 'object-center',
    duration: '2–4 hrs',
    level: 'All Levels',
    price: '$75',
    keyPoints: [
      'CPR awareness & emergency response',
      'Choking & cardiac emergencies',
      'Stroke & seizure recognition',
      'Allergic reactions & anaphylaxis',
      'Burns, fractures & sprains',
      'Emergency scene management',
    ],
    whatYouLearn: [
      'Medical assessments and patient care fundamentals',
      'CPR awareness and emergency response procedures',
      'Respond to choking and cardiac emergencies',
      'Recognize stroke, seizure, and diabetic emergencies',
      'Manage allergic reactions and anaphylaxis',
      'Treat burns, fractures, sprains, and weather-related injuries',
      'Manage an emergency scene and activate EMS',
    ],
    whoIsItFor: [
      'Churches and faith-based organizations',
      'Security officers and safety teams',
      'Corporate offices and businesses',
      'Schools and educational institutions',
      'Healthcare support staff',
      'Event staff and volunteers',
      'Families and community groups',
    ],
    prerequisites: ['No prior medical training required'],
    whatToBring: ['Comfortable clothing suitable for hands-on exercises', 'Notebook (optional)'],
    cta: 'Register Today',
    pricingOptions: [
      {
        id: 'first-aid-standard',
        name: 'First Aid Training',
        price: 75,
        description: 'Full hands-on First Aid course',
        popular: true,
      },
    ],
    requiredFees: [],
    optionalAddOns: [],
  },

};
/* ─── Helper functions ──────────────────────────────────────────────── */

export function getCourseBySlug(slug: string): Course | undefined {
  return courses[slug];
}

export function getAllCourses(): Course[] {
  return Object.values(courses);
}

export function getCoursesByCategory(categoryId: string): Course[] {
  const category = courseCategories.find((c) => c.id === categoryId);
  if (!category) return [];
  return category.courses.map((slug) => courses[slug]).filter(Boolean);
}
/* ─── Homepage featured course slugs ──────────────────────────────── */
/**
 * Ordered list of courses to show in the Featured Training Programs section on the homepage.
 * Add a slug here and it automatically appears — no message file edits needed.
 */
export const homepageSlugs: string[] = [
  // Row 1 – Security Officer Training
  'level-2-security-officer',
  'level-3-armed-security-officer',
  'level-4-bodyguard',
  'level-3-4-complete-package',
  // Row 2 – Firearms Training
  'texas-ltc-certification-basic-handgun',
  'basic-handgun-skills-training',
  'shotgun-course',
  'ar-15-rifle-course',
];

export function getHomepageCourses(): Course[] {
  return homepageSlugs.map((slug) => courses[slug]).filter(Boolean);
}

