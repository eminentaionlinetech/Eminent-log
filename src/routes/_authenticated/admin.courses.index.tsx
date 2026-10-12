import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/site/States";
import { Skeleton } from "@/components/ui/skeleton";
import { slugify } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/courses/")({
  head: () => ({ meta: [{ title: "Manage courses — EMINENT LOG" }, { name: "description", content: "Manage courses for EMINENT LOG administrators." }, { property: "og:title", content: "Manage courses — EMINENT LOG" }, { property: "og:description", content: "Manage courses for EMINENT LOG administrators." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AdminCourses,
});

function AdminCourses() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const courses = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, status, access_type, thumbnail_url, updated_at, category:categories(name), modules(count), lessons(count)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
    if (!title) return;
    const { data, error } = await supabase.from("courses").insert({ title, slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}` }).select("id").single();
    if (error) return toast.error(error.message);
    setOpen(false);
    navigate({ to: "/admin/courses/$id", params: { id: data.id } });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Courses</h1>
        <Button onClick={() => setOpen(true)}><Plus /> New course</Button>
      </div>
      <div className="mt-6">
        {courses.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : courses.isError ? (
          <ErrorState onRetry={() => courses.refetch()} />
        ) : !courses.data?.length ? (
          <EmptyState title="No courses yet." description="Create your first course to get started." />
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {courses.data.map((c) => {
              const mods = (c.modules as unknown as { count: number }[])[0]?.count ?? 0;
              const les = (c.lessons as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <li key={c.id}>
                  <Link to="/admin/courses/$id" params={{ id: c.id }} className="flex flex-col gap-2 p-4 hover:bg-accent sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.category?.name ?? "No category"} · {mods} modules · {les} lessons · {c.access_type === "premium" ? "Premium" : "Free"}
                        {!c.thumbnail_url && " · no thumbnail"}
                      </p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {c.status === "published" ? "Published" : "Draft — not public"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="nc-title">Course title</Label><Input id="nc-title" name="title" required maxLength={200} /></div>
            <Button type="submit">Create draft</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
