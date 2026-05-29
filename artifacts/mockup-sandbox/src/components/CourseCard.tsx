import { Clock, BarChart2, DollarSign, ArrowRight } from "lucide-react";
import { type Course, LEVEL_COLORS } from "../data/courses";

export type LevelLabels = {
  Beginner: string;
  Intermediate: string;
  Advanced: string;
};

const CARD_CLASSES = {
  root: "flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group",
  body: "p-6 flex flex-col flex-1 gap-3",
  badgeRow: "flex items-center gap-2 h-7",
  title: "text-base font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.75rem]",
  description: "text-sm text-gray-500 leading-relaxed flex-1 line-clamp-3",
  meta: "flex flex-wrap gap-3 pt-2 border-t border-gray-100 text-xs text-gray-600 flex-shrink-0",
  metaItem: "flex items-center gap-1",
  metaIcon: "w-3.5 h-3.5",
  footer: "px-6 pb-5 flex-shrink-0",
  cta: "inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900 transition-colors group-hover:gap-2",
  ctaIcon: "w-3.5 h-3.5 transition-all",
} as const;

const BADGE_CLASSES =
  "text-xs font-semibold px-2.5 py-1 rounded-full" as const;

export function CourseCard({
  course,
  levelLabels,
}: {
  course: Course;
  levelLabels?: LevelLabels;
}) {
  const label = levelLabels ? levelLabels[course.level] : course.level;
  return (
    <div className={CARD_CLASSES.root}>
      <div className={CARD_CLASSES.body}>
        {/* Badge row — fixed height */}
        <div className={CARD_CLASSES.badgeRow}>
          <span
            className={`${BADGE_CLASSES} ${LEVEL_COLORS[course.level]}`}
          >
            {label}
          </span>
        </div>

        {/* Title — always 2 lines tall */}
        <h3 className={CARD_CLASSES.title}>
          {course.title}
        </h3>

        {/* Description — clamped to 3 lines, pushes metadata to bottom */}
        <p className={CARD_CLASSES.description}>
          {course.description}
        </p>

        {/* Metadata — always at the same vertical position */}
        <div className={CARD_CLASSES.meta}>
          <span className={CARD_CLASSES.metaItem}>
            <Clock className={CARD_CLASSES.metaIcon} />
            {course.duration}
          </span>
          <span className={CARD_CLASSES.metaItem}>
            <BarChart2 className={CARD_CLASSES.metaIcon} />
            {label}
          </span>
          <span className={CARD_CLASSES.metaItem}>
            <DollarSign className={CARD_CLASSES.metaIcon} />
            {course.price}
          </span>
        </div>
      </div>

      <div className={CARD_CLASSES.footer}>
        <a
          href={course.href}
          className={CARD_CLASSES.cta}
        >
          View Course <ArrowRight className={CARD_CLASSES.ctaIcon} />
        </a>
      </div>
    </div>
  );
}
