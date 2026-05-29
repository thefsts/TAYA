import { Clock, BarChart2, DollarSign, ArrowRight } from "lucide-react";
import { type Course, type Level, LEVEL_COLORS, HOMEPAGE_COURSES } from "../../data/courses";

type LevelLabels = Record<Level, string>;

type MessagesModule = {
  common?: {
    levels?: Record<string, string>;
  };
};

const localeMessages = import.meta.glob<MessagesModule>(
  "../../../../../messages/*.json",
  { eager: true, import: "default" }
);

const LEVEL_LABELS_BY_LOCALE: Record<string, LevelLabels> = Object.fromEntries(
  Object.entries(localeMessages).map(([path, mod]) => {
    const locale = path.match(/\/(\w+)\.json$/)?.[1] ?? "en";
    const levels = mod?.common?.levels ?? {};
    const labels: LevelLabels = {
      Beginner: levels["Beginner"] ?? "Beginner",
      Intermediate: levels["Intermediate"] ?? "Intermediate",
      Advanced: levels["Advanced"] ?? "Advanced",
    };
    return [locale, labels];
  })
);

const FALLBACK_LABELS: LevelLabels = {
  Beginner: "Beginner",
  Intermediate: "Intermediate",
  Advanced: "Advanced",
};

function getLocale(): string {
  if (typeof window === "undefined") return "en";
  const param = new URLSearchParams(window.location.search).get("locale");
  return param && param in LEVEL_LABELS_BY_LOCALE ? param : "en";
}

function useLevelLabels(): LevelLabels {
  return LEVEL_LABELS_BY_LOCALE[getLocale()] ?? FALLBACK_LABELS;
}

function CourseCard({
  course,
  levelLabels,
}: {
  course: Course;
  levelLabels: LevelLabels;
}) {
  const label = levelLabels[course.level];
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
      <div className="p-6 flex flex-col flex-1 gap-3">
        {/* Badge row — fixed height */}
        <div className="flex items-center gap-2 h-7">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LEVEL_COLORS[course.level]}`}
          >
            {label}
          </span>
        </div>

        {/* Title — always 2 lines tall */}
        <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.75rem]">
          {course.title}
        </h3>

        {/* Description — clamped to 3 lines, pushes metadata to bottom */}
        <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-3">
          {course.description}
        </p>

        {/* Metadata — always at the same vertical position */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 text-xs text-gray-600 flex-shrink-0">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5" />
            {label}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            {course.price}
          </span>
        </div>
      </div>

      <div className="px-6 pb-5 flex-shrink-0">
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
  const levelLabels = useLevelLabels();
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
          {HOMEPAGE_COURSES.map((course) => (
            <CourseCard key={course.key} course={course} levelLabels={levelLabels} />
          ))}
        </div>
      </div>
    </section>
  );
}
