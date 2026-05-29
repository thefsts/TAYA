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

const SECTION_CLASSES = {
  root: "bg-gray-50 py-16 px-4",
  inner: "max-w-6xl mx-auto",
  header: "mb-10",
  eyebrow: "text-xs font-semibold tracking-widest text-red-700 uppercase mb-2",
  headingRow: "flex items-start justify-between gap-4 flex-wrap",
  headingGroup: "",
  title: "text-3xl font-extrabold text-gray-900 mb-2",
  subtitle: "text-gray-500 max-w-xl",
  viewAllButton: "inline-flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap",
  viewAllIcon: "w-4 h-4",
  grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5",
} as const;

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
    <section className={SECTION_CLASSES.root}>
      <div className={SECTION_CLASSES.inner}>
        <div className={SECTION_CLASSES.header}>
          <p className={SECTION_CLASSES.eyebrow}>
            Training Programs
          </p>
          <div className={SECTION_CLASSES.headingRow}>
            <div className={SECTION_CLASSES.headingGroup}>
              <h2 className={SECTION_CLASSES.title}>
                Popular Courses
              </h2>
              <p className={SECTION_CLASSES.subtitle}>
                Structured training for every skill level — from your first time
                on the range to professional security certification.
              </p>
            </div>
            <a
              href="/courses"
              className={SECTION_CLASSES.viewAllButton}
            >
              View All Courses <ArrowRight className={SECTION_CLASSES.viewAllIcon} />
            </a>
          </div>
        </div>

        <div className={SECTION_CLASSES.grid}>
          {HOMEPAGE_COURSES.map((course) => (
            <CourseCard key={course.key} course={course} levelLabels={levelLabels} />
          ))}
        </div>
      </div>
    </section>
  );
}
