import { useState } from "react";
import { ArrowRight, Home } from "lucide-react";
import { ALL_COURSES } from "../../data/courses";
import { CourseCard } from "../CourseCard";

type FilterTab = "All" | "Beginner" | "Intermediate" | "Advanced";

const TAB_ACTIVE_COLORS: Record<FilterTab, string> = {
  All: "bg-gray-900 text-white",
  Beginner: "bg-emerald-600 text-white",
  Intermediate: "bg-amber-500 text-white",
  Advanced: "bg-red-700 text-white",
};

const TABS: FilterTab[] = ["All", "Beginner", "Intermediate", "Advanced"];

const PAGE_CLASSES = {
  root: "min-h-screen bg-gray-50",
  header: "bg-white border-b border-gray-200 sticky top-0 z-10",
  headerInner: "max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4",
  breadcrumbRow: "flex items-center gap-3",
  breadcrumbHome: "text-gray-400 hover:text-gray-700 transition-colors",
  breadcrumbHomeIcon: "w-5 h-5",
  breadcrumbSep: "text-gray-300",
  breadcrumbLabel: "text-sm font-semibold text-gray-700",
  headerCount: "text-xs text-gray-400 font-medium",
  heroSection: "bg-white border-b border-gray-100 py-12 px-4",
  heroInner: "max-w-6xl mx-auto",
  heroEyebrow: "text-xs font-semibold tracking-widest text-red-700 uppercase mb-3",
  heroTitle: "text-4xl font-extrabold text-gray-900 mb-3",
  heroSubtitle: "text-gray-500 max-w-2xl text-lg leading-relaxed",
  filterSection: "bg-white border-b border-gray-200 px-4 py-4",
  filterInner: "max-w-6xl mx-auto",
  filterTabList: "flex flex-wrap gap-2",
  filterTab: "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400",
  filterTabInactive: "bg-gray-100 text-gray-600 hover:bg-gray-200",
  filterTabBadge: "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold",
  filterTabBadgeActive: "bg-white/25 text-white",
  filterTabBadgeInactive: "bg-gray-300 text-gray-600",
  gridSection: "py-14 px-4",
  gridInner: "max-w-6xl mx-auto",
  grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5",
  emptyMessage: "text-gray-400 text-sm text-center py-20",
  ctaSection: "bg-red-700 py-14 px-4",
  ctaInner: "max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6",
  ctaTitle: "text-2xl font-extrabold text-white mb-1",
  ctaSubtitle: "text-red-200 text-sm",
  ctaButton: "inline-flex items-center gap-2 bg-white text-red-700 hover:bg-red-50 text-sm font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap",
  ctaButtonIcon: "w-4 h-4",
} as const;

function tabCount(tab: FilterTab): number {
  if (tab === "All") return ALL_COURSES.length;
  return ALL_COURSES.filter((c) => c.level === tab).length;
}

export default function CoursesListingPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  const visibleCourses =
    activeTab === "All"
      ? ALL_COURSES
      : ALL_COURSES.filter((c) => c.level === activeTab);

  return (
    <div className={PAGE_CLASSES.root}>
      <header className={PAGE_CLASSES.header}>
        <div className={PAGE_CLASSES.headerInner}>
          <div className={PAGE_CLASSES.breadcrumbRow}>
            <a
              href="/"
              className={PAGE_CLASSES.breadcrumbHome}
              aria-label="Back to home"
            >
              <Home className={PAGE_CLASSES.breadcrumbHomeIcon} />
            </a>
            <span className={PAGE_CLASSES.breadcrumbSep}>/</span>
            <span className={PAGE_CLASSES.breadcrumbLabel}>
              All Courses
            </span>
          </div>
          <span className={PAGE_CLASSES.headerCount}>
            {ALL_COURSES.length} courses available
          </span>
        </div>
      </header>

      <main>
        <section className={PAGE_CLASSES.heroSection}>
          <div className={PAGE_CLASSES.heroInner}>
            <p className={PAGE_CLASSES.heroEyebrow}>
              Training Programs
            </p>
            <h1 className={PAGE_CLASSES.heroTitle}>
              All Courses
            </h1>
            <p className={PAGE_CLASSES.heroSubtitle}>
              Structured firearms and security training for every skill level —
              from your very first day on the range to professional armed
              security certification.
            </p>
          </div>
        </section>

        {/* Filter tabs */}
        <section className={PAGE_CLASSES.filterSection}>
          <div className={PAGE_CLASSES.filterInner}>
            <div className={PAGE_CLASSES.filterTabList} role="tablist" aria-label="Filter courses by level">
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab)}
                    className={`${PAGE_CLASSES.filterTab} ${
                      isActive
                        ? TAB_ACTIVE_COLORS[tab]
                        : PAGE_CLASSES.filterTabInactive
                    }`}
                  >
                    {tab}
                    <span
                      className={`${PAGE_CLASSES.filterTabBadge} ${
                        isActive
                          ? PAGE_CLASSES.filterTabBadgeActive
                          : PAGE_CLASSES.filterTabBadgeInactive
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

        <section className={PAGE_CLASSES.gridSection}>
          <div className={PAGE_CLASSES.gridInner}>
            {visibleCourses.length > 0 ? (
              <div className={PAGE_CLASSES.grid}>
                {visibleCourses.map((course) => (
                  <CourseCard key={course.key} course={course} />
                ))}
              </div>
            ) : (
              <p className={PAGE_CLASSES.emptyMessage}>
                No courses found for this level.
              </p>
            )}
          </div>
        </section>

        <section className={PAGE_CLASSES.ctaSection}>
          <div className={PAGE_CLASSES.ctaInner}>
            <div>
              <h2 className={PAGE_CLASSES.ctaTitle}>
                Not sure where to start?
              </h2>
              <p className={PAGE_CLASSES.ctaSubtitle}>
                Contact us and we'll match you to the right course.
              </p>
            </div>
            <a
              href="/contact"
              className={PAGE_CLASSES.ctaButton}
            >
              Get in Touch <ArrowRight className={PAGE_CLASSES.ctaButtonIcon} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
