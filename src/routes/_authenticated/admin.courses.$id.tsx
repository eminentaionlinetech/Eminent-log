import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/site/States";
import { MediaIcon, MediaPicker } from "@/components/admin/MediaPicker";
import { slugify, formatDuration } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/courses/$id")({
  component: CourseEditor,
});

const lines = (s: FormDataEntryValue | null) =>
  String(s ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50);

function useCourse(id: string) {
  return useQuery({
    queryKey: ["admin-course", id],
    queryFn: async () => {
      const [c, m, l, cats, inst] = await Promise.all([
        supabase.from("courses").select("*").eq("id", id).single(),
        supabase.from("modules").select("*").eq("course_id", id).order("position"),
        supabase
          .from("lessons")
          .select("*, video:media!lessons_video_media_id_fkey(id,title,duration_seconds), resources:lesson_resources(id, title, media:media(id,title,kind))")
          .eq("course_id", id)
          .order("position"),
        supabase.from("categories").select("id,name").order("position"),
        supabase.from("instructors").select("id,name").order("name"),
      ]);
      if (c.error) throw c.error;
      return { course: c.data, modules: m.data ?? [], lessons: l.data ?? [], categories: cats.data ?? [], instructors: inst.data ?? [] };
    },
  });
}

function CourseEditor() {
  const { id } = Route.useParams();
  const q = useCourse(id);
  if (q.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  return <Editor data={q.data} />;
}

type Data = NonNullable<ReturnType<typeof useCourse>["data"]>;

function Editor({ data }: { data: Data }) {
  const { course, modules, lessons } = data;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-course", course.id] });
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };
  const [thumbOpen, setThumbOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const publishedLessons = lessons.filter((l) => l.is_published).length;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    const slug = slugify(String(fd.get("slug") ?? "")) || slugify(title);
    if (!title) return toast.error("Title is required");
    setSaving(true);
    const { error } = await supabase
      .from("courses")
      .update({
        title,
        slug,
        short_description: String(fd.get("short_description") ?? "").trim() || null,
        description: String(fd.get("description") ?? "").trim() || null,
        category_id: String(fd.get("category_id") ?? "") || null,
        instructor_id: String(fd.get("instructor_id") ?? "") || null,
        access_type: fd.get("access_type") === "premium" ? "premium" : "free",
        learning_outcomes: lines(fd.get("learning_outcomes")),
        requirements: lines(fd.get("requirements")),
        intended_audience: String(fd.get("intended_audience") ?? "").trim() || null,
        featured: fd.get("featured") === "on",
      })
      .eq("id", course.id);
    setSaving(false);
    if (error) return toast.error(error.message.includes("duplicate") ? "That URL is already used by another course" : error.message);
    toast.success("Course saved");
    refresh();
  }

  async function setStatus(status: "draft" | "published") {
    if (status === "published" && publishedLessons === 0) return toast.error("Publish at least one lesson before publishing the course.");
    const { error } = await supabase
      .from("courses")
      .update({ status, published_at: status === "published" ? course.published_at ?? new Date().toISOString() : course.published_at })
      .eq("id", course.id);
    if (error) return toast.error(error.message);
    toast.success(status === "published" ? "Course is now public" : "Course unpublished");
    refresh();
  }

  async function setThumb(url: string | null) {
    const { error } = await supabase.from("courses").update({ thumbnail_url: url }).eq("id", course.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${course.title}" and all its modules and lessons? Uploaded media stays in the library.`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) return toast.error(error.message);
    toast.success("Course deleted");
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
    navigate({ to: "/admin/courses" });
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/courses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All courses</Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold text-navy">{course.title}</h1>
          <div className="flex flex-wrap gap-2">
            {course.status === "published" ? (
              <>
                <Button asChild variant="outline" size="sm"><Link to="/courses/$slug" params={{ slug: course.slug }}>View public page</Link></Button>
                <Button variant="outline" size="sm" onClick={() => setStatus("draft")}><EyeOff /> Unpublish</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setStatus("published")}><Eye /> Publish</Button>
            )}
            <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}><Trash2 /> Delete</Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: <strong>{course.status === "published" ? "Published" : "Draft — not visible to students"}</strong> · {modules.length} modules · {lessons.length} lessons ({publishedLessons} published)
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="font-semibold">Thumbnail</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted sm:w-64">
            {course.thumbnail_url ? <img src={course.thumbnail_url} alt="Course thumbnail" className="h-full w-full object-cover" /> : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setThumbOpen(true)}>{course.thumbnail_url ? "Replace" : "Choose or upload"}</Button>
            {course.thumbnail_url && <Button variant="ghost" onClick={() => setThumb(null)}>Remove</Button>}
          </div>
        </div>
        <MediaPicker open={thumbOpen} onOpenChange={setThumbOpen} kind="image" title="Course thumbnail" onPick={(m) => setThumb(m.public_url)} />
      </section>

      <form onSubmit={save} className="space-y-5 rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="font-semibold">Course details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" name="title" defaultValue={course.title} />
          <Field label="URL (e.g. mastering-website-design)" name="slug" defaultValue={course.slug} />
        </div>
        <Field label="Short description" name="short_description" defaultValue={course.short_description ?? ""} />
        <Area label="Full description" name="description" defaultValue={course.description ?? ""} rows={6} />
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Category" name="category_id" defaultValue={course.category_id ?? ""} options={data.categories.map((c) => [c.id, c.name])} empty="No category" />
          <SelectField label="Instructor" name="instructor_id" defaultValue={course.instructor_id ?? ""} options={data.instructors.map((c) => [c.id, c.name])} empty="Not shown" />
          <SelectField label="Access" name="access_type" defaultValue={course.access_type} options={[["free", "Free"], ["premium", "Premium"]]} />
        </div>
        <Area label="Learning outcomes (one per line)" name="learning_outcomes" defaultValue={course.learning_outcomes.join("\n")} rows={4} />
        <Area label="Requirements (one per line)" name="requirements" defaultValue={course.requirements.join("\n")} rows={3} />
        <Area label="Who this course is for" name="intended_audience" defaultValue={course.intended_audience ?? ""} rows={3} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={course.featured} className="h-4 w-4" /> Feature on the homepage</label>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save details"}</Button>
      </form>

      <Curriculum data={data} refresh={refresh} />
    </div>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Input id={`f-${name}`} name={name} defaultValue={defaultValue} maxLength={300} />
    </div>
  );
}
function Area({ label, name, defaultValue, rows }: { label: string; name: string; defaultValue: string; rows: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Textarea id={`f-${name}`} name={name} defaultValue={defaultValue} rows={rows} maxLength={10000} />
    </div>
  );
}
function SelectField({ label, name, defaultValue, options, empty }: { label: string; name: string; defaultValue: string; options: string[][]; empty?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <select id={`f-${name}`} name={name} defaultValue={defaultValue} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

async function swap(table: "modules" | "lessons", a: { id: string; position: number }, b: { id: string; position: number }, idxA: number, idxB: number) {
  // Use index-based positions so legacy duplicate positions normalise.
  const r1 = await supabase.from(table).update({ position: idxB + 1 }).eq("id", a.id);
  const r2 = await supabase.from(table).update({ position: idxA + 1 }).eq("id", b.id);
  if (r1.error || r2.error) toast.error("Couldn't reorder");
}

function Curriculum({ data, refresh }: { data: Data; refresh: () => void }) {
  const { course, modules, lessons } = data;
  const [editing, setEditing] = useState<string | null>(null);

  async function addModule() {
    const title = prompt("Module title");
    if (!title?.trim()) return;
    const { error } = await supabase.from("modules").insert({ course_id: course.id, title: title.trim(), position: modules.length + 1 });
    if (error) return toast.error(error.message);
    refresh();
  }
  async function renameModule(id: string, current: string) {
    const title = prompt("Rename module", current);
    if (!title?.trim() || title === current) return;
    const { error } = await supabase.from("modules").update({ title: title.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function deleteModule(id: string, title: string) {
    if (!confirm(`Delete module "${title}" and its lessons?`)) return;
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function addLesson(moduleId: string, count: number) {
    const title = prompt("Lesson title");
    if (!title?.trim()) return;
    const { error } = await supabase.from("lessons").insert({ course_id: course.id, module_id: moduleId, title: title.trim(), position: count + 1 });
    if (error) return toast.error(error.message);
    refresh();
  }
  async function deleteLesson(id: string, title: string) {
    if (!confirm(`Delete lesson "${title}"?`)) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function togglePublish(id: string, val: boolean) {
    const { error } = await supabase.from("lessons").update({ is_published: val }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  const editingLesson = lessons.find((l) => l.id === editing) ?? null;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Curriculum</h2>
        <Button size="sm" onClick={addModule}><Plus /> Add module</Button>
      </div>
      {modules.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No modules yet.</p>}
      <ol className="mt-4 space-y-4">
        {modules.map((m, i) => {
          const ml = lessons.filter((l) => l.module_id === m.id);
          return (
            <li key={m.id} className="rounded-xl border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 p-3">
                <p className="min-w-0 font-medium"><span className="text-xs font-semibold text-primary">MODULE {String(i + 1).padStart(2, "0")}</span><br />{m.title}</p>
                <div className="flex gap-1">
                  <IconBtn label="Move up" disabled={i === 0} onClick={async () => { await swap("modules", m, modules[i - 1]!, i, i - 1); refresh(); }}><ArrowUp /></IconBtn>
                  <IconBtn label="Move down" disabled={i === modules.length - 1} onClick={async () => { await swap("modules", m, modules[i + 1]!, i, i + 1); refresh(); }}><ArrowDown /></IconBtn>
                  <IconBtn label="Rename module" onClick={() => renameModule(m.id, m.title)}><Pencil /></IconBtn>
                  <IconBtn label="Delete module" onClick={() => deleteModule(m.id, m.title)}><Trash2 /></IconBtn>
                </div>
              </div>
              <ul className="divide-y">
                {ml.map((l, j) => (
                  <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium"><span className="text-muted-foreground">Lesson {String(j + 1).padStart(2, "0")} · </span>{l.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.is_published ? "Published" : "Unpublished"} · {l.video ? `Video${l.video.duration_seconds ? ` (${formatDuration(Number(l.video.duration_seconds))})` : ""}` : "No video yet"} · {l.resources.length} resources
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="mr-2 flex items-center gap-2 text-xs"><Switch checked={l.is_published} onCheckedChange={(v) => togglePublish(l.id, v)} aria-label="Published" /> Live</label>
                      <IconBtn label="Move up" disabled={j === 0} onClick={async () => { await swap("lessons", l, ml[j - 1]!, j, j - 1); refresh(); }}><ArrowUp /></IconBtn>
                      <IconBtn label="Move down" disabled={j === ml.length - 1} onClick={async () => { await swap("lessons", l, ml[j + 1]!, j, j + 1); refresh(); }}><ArrowDown /></IconBtn>
                      <IconBtn label="Edit lesson" onClick={() => setEditing(l.id)}><Pencil /></IconBtn>
                      <IconBtn label="Delete lesson" onClick={() => deleteLesson(l.id, l.title)}><Trash2 /></IconBtn>
                    </div>
                  </li>
                ))}
                <li className="p-2"><Button variant="ghost" size="sm" onClick={() => addLesson(m.id, ml.length)}><Plus /> Add lesson</Button></li>
              </ul>
            </li>
          );
        })}
      </ol>
      {editingLesson && <LessonDialog lesson={editingLesson} onClose={() => setEditing(null)} refresh={refresh} />}
    </section>
  );
}

function IconBtn({ label, children, ...p }: { label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={label} title={label} {...p}>
      {children}
    </Button>
  );
}

type LessonT = Data["lessons"][number];

function LessonDialog({ lesson, onClose, refresh }: { lesson: LessonT; onClose: () => void; refresh: () => void }) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return toast.error("Title is required");
    setBusy(true);
    const { error } = await supabase.from("lessons").update({ title, description: String(fd.get("description") ?? "").trim() || null }).eq("id", lesson.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lesson saved");
    refresh();
  }
  async function setVideo(id: string | null) {
    const { error } = await supabase.from("lessons").update({ video_media_id: id }).eq("id", lesson.id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function addResource(mediaId: string, title: string) {
    const { error } = await supabase.from("lesson_resources").insert({ lesson_id: lesson.id, media_id: mediaId, title, position: lesson.resources.length + 1 });
    if (error) return toast.error(error.message.includes("duplicate") ? "That file is already attached" : error.message);
    refresh();
  }
  async function removeResource(id: string) {
    const { error } = await supabase.from("lesson_resources").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit lesson</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="l-title">Title</Label><Input id="l-title" name="title" defaultValue={lesson.title} maxLength={200} /></div>
          <div className="space-y-1.5"><Label htmlFor="l-desc">Description</Label><Textarea id="l-desc" name="description" defaultValue={lesson.description ?? ""} rows={5} maxLength={10000} /></div>
          <Button type="submit" size="sm" disabled={busy}>Save lesson</Button>
        </form>
        <div className="mt-4 space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Video</h3>
          {lesson.video ? (
            <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span className="flex min-w-0 items-center gap-2"><MediaIcon kind="video" /><span className="truncate">{lesson.video.title}</span></span>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" onClick={() => setVideoOpen(true)}>Change</Button>
                <Button size="sm" variant="ghost" onClick={() => setVideo(null)}>Detach</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setVideoOpen(true)}>Attach video</Button>
          )}
        </div>
        <div className="mt-4 space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Resources</h3>
          {lesson.resources.length === 0 && <p className="text-sm text-muted-foreground">No resources available for this lesson.</p>}
          <ul className="space-y-1">
            {lesson.resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">{r.media && <MediaIcon kind={r.media.kind} />}<span className="truncate">{r.title}</span></span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove resource" onClick={() => removeResource(r.id)}><X /></Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={() => setResOpen(true)}><Plus /> Add resource</Button>
        </div>
        <MediaPicker open={videoOpen} onOpenChange={setVideoOpen} kind="video" title="Lesson video" onPick={(m) => setVideo(m.id)} />
        <MediaPicker open={resOpen} onOpenChange={setResOpen} title="Lesson resource" onPick={(m) => addResource(m.id, m.title)} />
      </DialogContent>
    </Dialog>
  );
}
