import { ArrowRight } from "lucide-react";
import { HOMEPAGE_COURSES } from "../../data/courses";
import { CourseCard, type LevelLabels } from "../CourseCard";

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
