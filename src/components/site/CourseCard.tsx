import { Link } from "@tanstack/react-router";
import { BookOpen, Clock, Crown, Layers } from "lucide-react";
import type { CourseCardData } from "@/lib/catalog";
import { formatDuration } from "@/lib/catalog";

export function AccessBadge({ type }: { type: "free" | "premium" }) {
  return type === "premium" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-1 text-xs font-semibold text-amber-foreground">
      <Crown className="h-3.5 w-3.5" aria-hidden /> Premium
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
      Free
    </span>
  );
}

export function CourseCard({ course }: { course: CourseCardData }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-lg">
      <Link to="/courses/$slug" params={{ slug: course.slug }} className="block">
        <div className="aspect-video w-full overflow-hidden bg-secondary">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={`${course.title} course thumbnail`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-navy-deep p-6 text-center">
              <span className="font-display text-lg font-semibold text-navy-foreground line-clamp-3">{course.title}</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <AccessBadge type={course.access_type} />
          {course.category && <span className="text-xs font-medium text-muted-foreground">{course.category.name}</span>}
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-snug">
          <Link to="/courses/$slug" params={{ slug: course.slug }} className="hover:text-primary">
            {course.title}
          </Link>
        </h3>
        {course.short_description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.short_description}</p>
        )}
        {course.instructor && <p className="mt-3 text-sm text-foreground/80">By {course.instructor.name}</p>}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
          {course.module_count > 0 && (
            <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" aria-hidden />{course.module_count} modules</span>
          )}
          {course.lesson_count > 0 && (
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" aria-hidden />{course.lesson_count} lessons</span>
          )}
          {course.total_seconds != null && course.total_seconds > 0 && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{formatDuration(course.total_seconds)}</span>
          )}
        </div>
      </div>
    </article>
  );
}
