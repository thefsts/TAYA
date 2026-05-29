import { Clock, BarChart2, DollarSign, ArrowRight } from "lucide-react";

type Level = "Beginner" | "Intermediate" | "Advanced";

interface Course {
  key: string;
  title: string;
  description: string;
  duration: string;
  level: Level;
  price: string;
  href: string;
}

const LEVEL_COLORS: Record<Level, string> = {
  Beginner: "bg-emerald-100 text-emerald-800",
  Intermediate: "bg-amber-100 text-amber-800",
  Advanced: "bg-red-100 text-red-800",
};

const courses: Course[] = [
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
];

function CourseCard({ course }: { course: Course }) {
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
      <div className="p-6 flex flex-col flex-1 gap-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LEVEL_COLORS[course.level]}`}
          >
            {course.level}
          </span>
        </div>

        <h3 className="text-base font-bold text-gray-900 leading-snug">
          {course.title}
        </h3>

        <p className="text-sm text-gray-500 leading-relaxed flex-1">
          {course.description}
        </p>

        <div className="flex flex-wrap gap-3 pt-1 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5" />
            {course.level}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            {course.price}
          </span>
        </div>
      </div>

      <div className="px-6 pb-5">
        <a
          href={course.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900 transition-colors group-hover:gap-2"
        >
          View Course <ArrowRight className="w-3.5 h-3.5 transition-all" />
        </a>
      </div>
    </div>
  );
}

export default function HomepageCoursesSection() {
  return (
    <section className="bg-gray-50 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest text-red-700 uppercase mb-2">
            Training Programs
          </p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                Popular Courses
              </h2>
              <p className="text-gray-500 max-w-xl">
                Structured training for every skill level — from your first time
                on the range to professional security certification.
              </p>
            </div>
            <a
              href="/courses"
              className="inline-flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              View All Courses <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <CourseCard key={course.key} course={course} />
          ))}
        </div>
      </div>
    </section>
  );
}
