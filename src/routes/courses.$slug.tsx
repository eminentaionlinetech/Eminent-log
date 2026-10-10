import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Crown, FileText, Lock, PlayCircle } from "lucide-react";
import { getPublishedCourse } from "@/lib/courses.functions";
import { AccessBadge } from "@/components/site/CourseCard";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/catalog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/courses/$slug")({
  loader: async ({ params }) => {
    const res = await getPublishedCourse({ data: { slug: params.slug } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Course not found — EMINENT LOG" }, { name: "robots", content: "noindex" }] };
    const c = loaderData.course;
    const desc = c.short_description || `Learn ${c.title} on EMINENT LOG.`;
    const meta = [
      { title: `${c.title} — EMINENT LOG` },
      { name: "description", content: desc },
      { property: "og:title", content: c.title },
      { property: "og:description", content: desc },
    ];
    if (c.thumbnail_url?.startsWith("https://")) {
      meta.push({ property: "og:image", content: c.thumbnail_url }, { name: "twitter:image", content: c.thumbnail_url } as never);
    }
    return { meta };
  },
  notFoundComponent: CourseNotFound,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">We couldn't load this course</h1>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  ),
  component: CourseDetail,
});

function CourseNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-navy">Course not found</h1>
      <p className="mt-2 text-muted-foreground">This course doesn't exist or isn't published yet.</p>
      <Button asChild className="mt-6"><Link to="/courses">Explore Courses</Link></Button>
    </div>
  );
}

function CourseDetail() {
  const { course, curriculum } = Route.useLoaderData();
  const lessonCount = curriculum.reduce((n, m) => n + m.lessons.length, 0);
  const allLessons = curriculum.flatMap((m) => m.lessons);
  const totalSeconds =
    allLessons.length > 0 && allLessons.every((l) => l.duration_seconds != null)
      ? allLessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0)
      : null;
  const resourceCount = allLessons.reduce((n, l) => n + l.resource_count, 0);

  return (
    <>
      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_1fr] lg:py-16">
          <div>
            <nav aria-label="Breadcrumb" className="text-sm text-navy-foreground/70">
              <Link to="/courses" className="hover:text-navy-foreground">Courses</Link>
              {course.category && (
                <>
                  <span className="mx-2">/</span>
                  <Link to="/courses" search={{ category: course.category.slug }} className="hover:text-navy-foreground">{course.category.name}</Link>
                </>
              )}
            </nav>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{course.title}</h1>
            {course.short_description && <p className="mt-4 text-lg text-navy-foreground/80">{course.short_description}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-navy-foreground/80">
              <AccessBadge type={course.access_type} />
              {course.instructor && <span>By {course.instructor.name}</span>}
              {curriculum.length > 0 && <span>{curriculum.length} modules</span>}
              {lessonCount > 0 && <span>{lessonCount} lessons</span>}
              {totalSeconds != null && totalSeconds > 0 && <span>{formatDuration(totalSeconds)}</span>}
              {resourceCount > 0 && <span>{resourceCount} resources</span>}
            </div>
          </div>
          <div className="lg:row-span-2">
            <div className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-card">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={`${course.title} thumbnail`} className="aspect-video w-full object-cover" />
              ) : (
                <div className="grid aspect-video place-items-center bg-navy-deep p-6 text-center font-display text-lg font-semibold text-navy-foreground">
                  {course.title}
                </div>
              )}
              <div className="p-6">
                <EnrolPanel courseId={course.id} accessType={course.access_type} hasLessons={lessonCount > 0} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-12">
          {course.learning_outcomes.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-navy">What you'll learn</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {course.learning_outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{o}</li>
                ))}
              </ul>
            </section>
          )}
          {course.description && (
            <section>
              <h2 className="text-2xl font-bold text-navy">About this course</h2>
              <div className="mt-4 space-y-4 leading-relaxed text-foreground/85">
                {course.description.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>
          )}
          {curriculum.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-navy">Course structure</h2>
              <div className="mt-5 space-y-3">
                {curriculum.map((m, i) => <ModuleBlock key={m.id} index={i} module={m} premium={course.access_type === "premium"} />)}
              </div>
            </section>
          )}
          {course.requirements.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-navy">Requirements</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-foreground/85">{course.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
          )}
          {course.intended_audience && (
            <section>
              <h2 className="text-2xl font-bold text-navy">Who this course is for</h2>
              <p className="mt-4 whitespace-pre-line text-foreground/85">{course.intended_audience}</p>
            </section>
          )}
        </div>
        {course.instructor && (
          <aside>
            <div className="rounded-2xl border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Instructor</h2>
              <div className="mt-4 flex items-center gap-4">
                {course.instructor.photo_url && (
                  <img src={course.instructor.photo_url} alt={course.instructor.name} className="h-14 w-14 rounded-full object-cover" loading="lazy" />
                )}
                <div>
                  <p className="font-semibold">{course.instructor.name}</p>
                  {course.instructor.title && <p className="text-sm text-muted-foreground">{course.instructor.title}</p>}
                </div>
              </div>
              {course.instructor.bio && <p className="mt-4 whitespace-pre-line text-sm text-foreground/80">{course.instructor.bio}</p>}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

type ModuleT = Awaited<ReturnType<typeof getPublishedCourse>>["curriculum"][number];

function ModuleBlock({ module, index, premium }: { module: ModuleT; index: number; premium: boolean }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button className="flex w-full items-center justify-between gap-4 p-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Module {String(index + 1).padStart(2, "0")}</p>
          <p className="mt-1 font-semibold">{module.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
          {module.lessons.length > 0 && <span>{module.lessons.length} lessons</span>}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </div>
      </button>
      {open && (
        <ul className="border-t">
          {module.lessons.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">Lessons for this module are being prepared.</li>
          ) : (
            module.lessons.map((l, j) => (
              <li key={l.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                <span className="flex min-w-0 items-center gap-3">
                  {l.has_video ? <PlayCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className="truncate"><span className="text-muted-foreground">Lesson {String(j + 1).padStart(2, "0")} · </span>{l.title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {l.duration_seconds != null && formatDuration(l.duration_seconds)}
                  {premium && <Lock className="h-3.5 w-3.5" aria-label="Premium lesson" />}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function EnrolPanel({ courseId, accessType, hasLessons }: { courseId: string; accessType: "free" | "premium"; hasLessons: boolean }) {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const state = useQuery({
    queryKey: ["enrolment-state", courseId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: enr }, { data: canAccess }] = await Promise.all([
        supabase.from("enrolments").select("id, completed_at").eq("course_id", courseId).eq("user_id", user!.id).maybeSingle(),
        supabase.rpc("can_access_course", { _user_id: user!.id, _course_id: courseId }),
      ]);
      return { enrolment: enr, canAccess: !!canAccess };
    },
  });

  async function enrol() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("enrolments").insert({ user_id: user.id, course_id: courseId });
    setBusy(false);
    if (error) {
      toast.error("We couldn't enrol you. Please try again.");
      return;
    }
    toast.success("You're enrolled!");
    qc.invalidateQueries({ queryKey: ["enrolment-state", courseId] });
    qc.invalidateQueries({ queryKey: ["my-enrolments"] });
  }

  if (loading || (user && state.isLoading)) return <div className="h-11 animate-pulse rounded-md bg-muted" />;

  if (!user) {
    return (
      <>
        <Button asChild className="h-11 w-full"><Link to="/auth" search={{ mode: "register" }}>Register to enrol</Link></Button>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/auth" className="font-medium text-primary">Log in</Link>
        </p>
      </>
    );
  }

  if (state.data?.enrolment) {
    return (
      <>
        <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="h-5 w-5" aria-hidden />
          {state.data.enrolment.completed_at ? "Course completed" : "You're enrolled"}
        </p>
        <Button asChild variant="outline" className="mt-4 h-11 w-full"><Link to="/dashboard">Go to my courses</Link></Button>
      </>
    );
  }

  if (!state.data?.canAccess) {
    return (
      <>
        <p className="flex items-center gap-2 text-sm font-medium"><Crown className="h-4 w-4 text-amber" aria-hidden /> This is a Premium course.</p>
        <p className="mt-1 text-sm text-muted-foreground">An active EMINENT LOG Premium subscription is required.</p>
        <Button asChild className="mt-4 h-11 w-full"><Link to="/premium">View Premium</Link></Button>
      </>
    );
  }

  return (
    <>
      <Button className="h-11 w-full" onClick={enrol} disabled={busy || !hasLessons}>
        {busy ? "Enrolling…" : accessType === "free" ? "Enrol for free" : "Enrol now"}
      </Button>
      {!hasLessons && <p className="mt-3 text-center text-sm text-muted-foreground">Enrolment opens once the first lessons are published.</p>}
    </>
  );
}
