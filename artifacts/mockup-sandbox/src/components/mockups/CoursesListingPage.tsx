import { useState } from "react";
import { Clock, BarChart2, DollarSign, ArrowRight, Home } from "lucide-react";

type Level = "Beginner" | "Intermediate" | "Advanced";
type FilterTab = "All" | Level;

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

const TAB_ACTIVE_COLORS: Record<FilterTab, string> = {
  All: "bg-gray-900 text-white",
  Beginner: "bg-emerald-600 text-white",
  Intermediate: "bg-amber-500 text-white",
  Advanced: "bg-red-700 text-white",
};

const TABS: FilterTab[] = ["All", "Beginner", "Intermediate", "Advanced"];

const ALL_COURSES: Course[] = [
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

function tabCount(tab: FilterTab): number {
  if (tab === "All") return ALL_COURSES.length;
  return ALL_COURSES.filter((c) => c.level === tab).length;
}

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

export default function CoursesListingPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  const visibleCourses =
    activeTab === "All"
      ? ALL_COURSES
      : ALL_COURSES.filter((c) => c.level === activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Back to home"
            >
              <Home className="w-5 h-5" />
            </a>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700">
              All Courses
            </span>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {ALL_COURSES.length} courses available
          </span>
        </div>
      </header>

      <main>
        <section className="bg-white border-b border-gray-100 py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs font-semibold tracking-widest text-red-700 uppercase mb-3">
              Training Programs
            </p>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
              All Courses
            </h1>
            <p className="text-gray-500 max-w-2xl text-lg leading-relaxed">
              Structured firearms and security training for every skill level —
              from your very first day on the range to professional armed
              security certification.
            </p>
          </div>
        </section>

        {/* Filter tabs */}
        <section className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter courses by level">
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 ${
                      isActive
                        ? TAB_ACTIVE_COLORS[tab]
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                    <span
                      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      {tabCount(tab)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-14 px-4">
          <div className="max-w-6xl mx-auto">
            {visibleCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleCourses.map((course) => (
                  <CourseCard key={course.key} course={course} />
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-20">
                No courses found for this level.
              </p>
            )}
          </div>
        </section>

        <section className="bg-red-700 py-14 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-1">
                Not sure where to start?
              </h2>
              <p className="text-red-200 text-sm">
                Contact us and we'll match you to the right course.
              </p>
            </div>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-red-700 hover:bg-red-50 text-sm font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
            >
              Get in Touch <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
