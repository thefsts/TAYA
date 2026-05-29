export type Level = "Beginner" | "Intermediate" | "Advanced";

export interface Course {
  key: string;
  title: string;
  description: string;
  duration: string;
  level: Level;
  price: string;
  href: string;
}

export const LEVEL_COLORS: Record<Level, string> = {
  Beginner: "bg-emerald-100 text-emerald-800",
  Intermediate: "bg-amber-100 text-amber-800",
  Advanced: "bg-red-100 text-red-800",
};

export const ALL_COURSES: Course[] = [
  {
    key: "ltc",
    title: "Texas License to Carry / Basic Handgun",
    description:
      "LTC certification plus handgun fundamentals — two courses combined into one day. Great value for new gun owners.",
    duration: "8–10 hrs",
    level: "Beginner",
    price: "From $100",
    href: "/courses/ltc",
  },
  {
    key: "firstShots",
    title: "First Shots Basic Firearm Training",
    description:
      "The perfect first class for brand-new shooters. Learn safety, handling, and take your first shots in a supportive group environment.",
    duration: "2–3 hrs",
    level: "Beginner",
    price: "From $50",
    href: "/courses/first-shots",
  },
  {
    key: "defensiveShooting",
    title: "Defensive Shooting Skills",
    description:
      "Build real-world defensive skills with holster work, movement, situational awareness, and controlled shooting drills at the range.",
    duration: "4–6 hrs",
    level: "Intermediate",
    price: "From $50",
    href: "/courses/defensive-shooting",
  },
  {
    key: "basicHandgun",
    title: "Basic Handgun Skills (Personal 1:1)",
    description:
      "Private one-on-one handgun training personalized to your skill level. Learn grip, stance, sight alignment, and fundamentals.",
    duration: "1.5 hrs",
    level: "Beginner",
    price: "From $70",
    href: "/courses/basic-handgun",
  },
  {
    key: "level3Security",
    title: "Level 3 Armed Security Officer",
    description:
      "Texas DPS Level III commissioned armed security certification. Classroom, use of force law, defensive tactics, and live-fire range qualification.",
    duration: "3–5 days",
    level: "Intermediate",
    price: "From $130",
    href: "/courses/level-3-security",
  },
  {
    key: "texasLtcCertification",
    title: "Texas License to Carry Certification",
    description:
      "State-approved Texas LTC certification with classroom instruction, legal education, and live-fire qualification.",
    duration: "6–8 hrs",
    level: "Beginner",
    price: "From $100",
    href: "/courses/texas-ltc-certification",
  },
  {
    key: "concealedCarryHomeDefense",
    title: "Concealed Carry Home Defense",
    description:
      "Learn firearm handling, situational awareness, ammunition, and home defense. This 6.5-hour class includes live range time with instructors.",
    duration: "6.5 hrs",
    level: "Beginner",
    price: "From $150",
    href: "/courses/concealed-carry-home-defense",
  },
  {
    key: "level34Bundle",
    title: "Level III + IV Complete Package",
    description:
      "Complete bundle: Level III Commissioned Officer, Level IV Personal Protection, and Texas LTC — all in one. The best value in professional security training.",
    duration: "5–7 days",
    level: "Advanced",
    price: "From $400",
    href: "/courses/level-3-4-bundle",
  },
  {
    key: "armedFirstResponder",
    title: "Armed First Responder",
    description:
      "Advanced 3-day certification for Texas LTC holders who serve as armed first responders in churches, schools, or organizations.",
    duration: "3 days",
    level: "Advanced",
    price: "From $595",
    href: "/courses/armed-first-responder",
  },
  {
    key: "nonLethalDefense",
    title: "Non-Lethal Defense",
    description:
      "Practical training in non-lethal self-defense tools including pepper spray, tasers, and personal safety techniques for everyday situations.",
    duration: "2–3 hrs",
    level: "Beginner",
    price: "From $40",
    href: "/courses/non-lethal-defense",
  },
  {
    key: "firearmRequalification",
    title: "Firearm Re-Qualification",
    description:
      "Keep your credentials current with a focused live-fire re-qualification session for LTC holders, security officers, and armed professionals.",
    duration: "1–2 hrs",
    level: "Intermediate",
    price: "From $35",
    href: "/courses/firearm-requalification",
  },
];

export const HOMEPAGE_COURSES = ALL_COURSES.slice(0, 6);
