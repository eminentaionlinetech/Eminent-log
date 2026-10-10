import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, FileText, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublishedCourse } from "@/lib/courses.functions";
import { getLessonPlayback } from "@/lib/learning.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/learn/$slug")({
  validateSearch: (s: Record<string, unknown>): { lesson?: string | undefined } => ({
    lesson: typeof s["lesson"] === "string" ? s["lesson"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Learning — EMINENT LOG" }, { name: "robots", content: "noindex" }] }),
  component: Learn,
});

function Learn() {
  const { slug } = Route.useParams();
  const { lesson: lessonParam } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const playback = useServerFn(getLessonPlayback);

  const course = useQuery({ queryKey: ["course", slug], queryFn: () => getPublishedCourse({ data: { slug } }) });
  const courseId = course.data?.course.id;
  const lessons = useMemo(() => course.data?.curriculum.flatMap((m) => m.lessons) ?? [], [course.data]);

  const progress = useQuery({
    queryKey: ["progress", courseId, user.id],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase.from("lesson_progress").select("lesson_id, completed, position_seconds, last_accessed_at").eq("user_id", user.id).eq("course_id", courseId!);
      return data ?? [];
    },
  });
  const progById = useMemo(() => new Map((progress.data ?? []).map((p) => [p.lesson_id, p])), [progress.data]);

  const currentId = useMemo(() => {
    if (lessonParam && lessons.some((l) => l.id === lessonParam)) return lessonParam;
    if (!progress.data) return undefined;
    const recent = [...progress.data].sort((a, b) => b.last_accessed_at.localeCompare(a.last_accessed_at))[0];
    if (recent && !recent.completed) return recent.lesson_id;
    return (lessons.find((l) => !progById.get(l.id)?.completed) ?? lessons[0])?.id;
  }, [lessonParam, lessons, progress.data, progById]);

  const lesson = useQuery({
    queryKey: ["playback", currentId],
    enabled: !!currentId,
    staleTime: 1000 * 60 * 60,
    retry: false,
    queryFn: () => playback({ data: { lessonId: currentId! } }),
  });

  const idx = lessons.findIndex((l) => l.id === currentId);
  const prev = idx > 0 ? lessons[idx - 1] : undefined;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : undefined;
  const done = lessons.filter((l) => progById.get(l.id)?.completed).length;

  const save = useCallback(
    async (lessonId: string, position: number, completed: boolean) => {
      const { data, error } = await supabase.rpc("record_lesson_progress", { _lesson_id: lessonId, _position: Math.floor(position), _completed: completed });
      if (error) {
        if (completed) toast.error("We couldn't save your progress. Please check your connection.");
        return;
      }
      if (completed) {
        qc.invalidateQueries({ queryKey: ["progress", courseId] });
        qc.invalidateQueries({ queryKey: ["my-enrolments"] });
        const r = data as { course_completed?: boolean } | null;
        if (r?.course_completed) toast.success("Course completed — congratulations!");
      }
    },
    [qc, courseId],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const resumeAt = currentId ? Number(progById.get(currentId)?.position_seconds ?? 0) : 0;

  useEffect(() => {
    lastSaved.current = 0;
  }, [currentId]);

  // Save position when leaving the page or switching lessons.
  useEffect(() => {
    const id = currentId;
    return () => {
      const v = videoRef.current;
      if (id && v && v.currentTime > 0) void save(id, v.currentTime, false);
    };
  }, [currentId, save]);

  if (course.isLoading) return <Shell><div className="aspect-video animate-pulse rounded-2xl bg-muted" /></Shell>;
  if (!course.data) return <Shell><p>This course isn't available.</p><Button asChild className="mt-4"><Link to="/courses">Explore Courses</Link></Button></Shell>;

  const err = lesson.error instanceof Error ? lesson.error.message : null;
  const isCompleted = !!(currentId && progById.get(currentId)?.completed);

  return (
    <Shell>
      <Link to="/courses/$slug" params={{ slug }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden /> {course.data.course.title}</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {lessons.length === 0 ? (
            <p className="rounded-2xl border bg-card p-6 text-muted-foreground">No lessons have been published yet.</p>
          ) : err ? (
            <div className="rounded-2xl border bg-card p-6">
              {err.includes("NOT_ENROLLED") ? (
                <><p>You need to enrol in this course first.</p><Button asChild className="mt-4"><Link to="/courses/$slug" params={{ slug }}>Go to course page</Link></Button></>
              ) : err.includes("PREMIUM_REQUIRED") ? (
                <><p>This is a Premium course. An active subscription is required.</p><Button asChild className="mt-4"><Link to="/premium">View Premium</Link></Button></>
              ) : (
                <><p>We couldn't load this lesson.</p><Button className="mt-4" onClick={() => lesson.refetch()}>Try again</Button></>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl bg-navy-deep">
                {lesson.isLoading ? (
                  <div className="aspect-video animate-pulse" />
                ) : lesson.data?.video ? (
                  <video
                    key={lesson.data.id}
                    ref={videoRef}
                    src={lesson.data.video.url}
                    controls
                    playsInline
                    controlsList="nodownload"
                    className="aspect-video w-full"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      if (resumeAt > 5 && resumeAt < v.duration - 5) v.currentTime = resumeAt;
                    }}
                    onTimeUpdate={(e) => {
                      const t = e.currentTarget.currentTime;
                      if (currentId && Math.abs(t - lastSaved.current) >= 15) {
                        lastSaved.current = t;
                        void save(currentId, t, false);
                      }
                    }}
                    onPause={(e) => currentId && void save(currentId, e.currentTarget.currentTime, false)}
                    onEnded={(e) => currentId && void save(currentId, e.currentTarget.currentTime, true)}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center p-6 text-center text-sm text-navy-foreground/80">This lesson has no video yet.</div>
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Lesson {idx + 1} of {lessons.length}</p>
                  <h1 className="mt-1 text-2xl font-bold text-navy">{lesson.data?.title ?? lessons[idx]?.title}</h1>
                </div>
                {isCompleted ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="h-5 w-5" aria-hidden /> Completed</p>
                ) : (
                  <Button variant="outline" disabled={!currentId} onClick={() => currentId && save(currentId, videoRef.current?.currentTime ?? 0, true)}>Mark as complete</Button>
                )}
              </div>
              {lesson.data?.description && <p className="mt-4 whitespace-pre-line text-muted-foreground">{lesson.data.description}</p>}
              {!!lesson.data?.resources.length && (
                <section className="mt-6">
                  <h2 className="font-semibold">Resources</h2>
                  <ul className="mt-3 space-y-2">
                    {lesson.data.resources.map((r) => (
                      <li key={r.id}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm hover:border-primary">
                          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{r.title}</span>
                          {r.size != null && <span className="text-xs text-muted-foreground">{(r.size / 1024 / 1024).toFixed(1)} MB</span>}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="mt-8 flex justify-between gap-3">
                {prev ? <Button variant="outline" onClick={() => navigate({ to: ".", search: { lesson: prev.id } })}><ArrowLeft /> Previous</Button> : <span />}
                {next && <Button onClick={() => navigate({ to: ".", search: { lesson: next.id } })}>Next lesson <ArrowRight /></Button>}
              </div>
            </>
          )}
        </div>

        <aside className="rounded-2xl border bg-card p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <p className="text-sm font-semibold">Your progress</p>
          <Progress className="mt-2" value={lessons.length ? (done / lessons.length) * 100 : 0} aria-label="Course progress" />
          <p className="mt-1 text-xs text-muted-foreground">{done} of {lessons.length} lessons completed</p>
          <ol className="mt-4 space-y-4">
            {course.data.curriculum.map((m, mi) => (
              <li key={m.id}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module {mi + 1} · {m.title}</p>
                <ul className="mt-2 space-y-1">
                  {m.lessons.map((l) => {
                    const c = progById.get(l.id)?.completed;
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => navigate({ to: ".", search: { lesson: l.id } })}
                          aria-current={l.id === currentId ? "true" : undefined}
                          className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${l.id === currentId ? "bg-accent font-medium" : ""}`}
                        >
                          {c ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Completed" /> : l.id === currentId ? <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                          <span>{l.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>;
}
