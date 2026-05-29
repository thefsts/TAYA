import { Clock, BarChart2, DollarSign, ArrowRight } from "lucide-react";
import { type Course, LEVEL_COLORS } from "../data/courses";

export type LevelLabels = {
  Beginner: string;
  Intermediate: string;
  Advanced: string;
};

export function CourseCard({
  course,
  levelLabels,
}: {
  course: Course;
  levelLabels?: LevelLabels;
}) {
  const label = levelLabels ? levelLabels[course.level] : course.level;
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
