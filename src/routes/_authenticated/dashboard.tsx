import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/site/States";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessBadge } from "@/components/site/CourseCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — EMINENT LOG" },
      { name: "description", content: "Your courses, progress and account on EMINENT LOG." },
      { property: "og:title", content: "My Dashboard — EMINENT LOG" },
      { property: "og:description", content: "Your EMINENT LOG learning dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const enrolments = useQuery({
    queryKey: ["my-enrolments", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrolments")
        .select("id, enrolled_at, completed_at, last_accessed_at, course:courses(id, slug, title, thumbnail_url, access_type)")
        .eq("user_id", user.id)
        .order("last_accessed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const ids = (data ?? []).map((e) => e.course?.id).filter(Boolean) as string[];
      const [{ data: progress }, { data: lessons }] = await Promise.all([
        ids.length ? supabase.from("lesson_progress").select("course_id, completed").eq("user_id", user.id).in("course_id", ids) : Promise.resolve({ data: [] }),
        ids.length ? supabase.from("lessons").select("id, course_id").in("course_id", ids) : Promise.resolve({ data: [] }),
      ]);
      return (data ?? []).map((e) => {
        const total = (lessons ?? []).filter((l) => l.course_id === e.course?.id).length;
        const done = (progress ?? []).filter((p) => p.course_id === e.course?.id && p.completed).length;
        return { ...e, total, done };
      });
    },
  });
  const sub = useQuery({
    queryKey: ["my-subscription", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("status, current_period_end").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const list = enrolments.data ?? [];
  const completed = list.filter((e) => e.completed_at);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-navy">My Dashboard</h1>
      <p className="mt-1 text-muted-foreground">{user.email}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="text-xl font-semibold">My Courses</h2>
          <div className="mt-4">
            {enrolments.isLoading ? (
              <Skeleton className="h-32 w-full rounded-2xl" />
            ) : enrolments.isError ? (
              <ErrorState onRetry={() => enrolments.refetch()} />
            ) : list.length === 0 ? (
              <EmptyState
                title="You haven't enrolled in any courses yet."
                description="My Courses is empty. Browse the catalogue to find your first course."
                action={<Button asChild><Link to="/courses">Explore Courses</Link></Button>}
              />
            ) : (
              <ul className="space-y-4">
                {list.map((e) =>
                  e.course ? (
                    <li key={e.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-card sm:flex-row sm:items-center">
                      <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-navy-deep sm:w-40">
                        {e.course.thumbnail_url && <img src={e.course.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <AccessBadge type={e.course.access_type} />
                        <h3 className="mt-2 font-semibold">
                          <Link to="/courses/$slug" params={{ slug: e.course.slug }} className="hover:text-primary">{e.course.title}</Link>
                        </h3>
                        {e.completed_at ? (
                          <p className="mt-2 text-sm font-medium text-success">Completed</p>
                        ) : e.total > 0 && e.done > 0 ? (
                          <div className="mt-3">
                            <Progress value={(e.done / e.total) * 100} aria-label="Course progress" />
                            <p className="mt-1 text-xs text-muted-foreground">{e.done} of {e.total} lessons completed</p>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">Not started yet</p>
                        )}
                      </div>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
          {completed.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">{completed.length} course{completed.length === 1 ? "" : "s"} completed.</p>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <h2 className="flex items-center gap-2 font-semibold"><Crown className="h-4 w-4 text-amber" aria-hidden /> Premium</h2>
            {sub.isLoading ? (
              <Skeleton className="mt-3 h-5 w-32" />
            ) : sub.data?.status === "active" && sub.data.current_period_end && new Date(sub.data.current_period_end) > new Date() ? (
              <p className="mt-2 text-sm">Active until {new Date(sub.data.current_period_end).toLocaleDateString()}</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sub.data ? `Status: ${sub.data.status.replace("_", " ")}` : "You don't have a Premium subscription."}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/premium">View Premium</Link></Button>
              </>
            )}
          </div>
          <ProfileCard userId={user.id} />
          <PasswordCard email={user.email ?? ""} />
        </aside>
      </div>
    </div>
  );
}

function ProfileCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle()).data,
  });
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("full_name") ?? "").trim().slice(0, 100);
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name || null }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error("Couldn't save your profile");
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }
  return (
    <form onSubmit={save} className="rounded-2xl border bg-card p-6 shadow-card">
      <h2 className="font-semibold">Profile</h2>
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="pf-name">Full name</Label>
        {profile.isLoading ? <Skeleton className="h-10" /> : <Input id="pf-name" name="full_name" defaultValue={profile.data?.full_name ?? ""} maxLength={100} />}
      </div>
      <Button type="submit" size="sm" className="mt-4" disabled={busy}>Save</Button>
    </form>
  );
}

function PasswordCard({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    setBusy(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (authErr) {
      setBusy(false);
      return toast.error("Your current password is incorrect");
    }
    const { error } = await supabase.auth.updateUser({ password: next, current_password: current } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Password changed");
  }
  return (
    <form onSubmit={change} className="rounded-2xl border bg-card p-6 shadow-card">
      <h2 className="font-semibold">Change password</h2>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5"><Label htmlFor="pw-current">Current password</Label><Input id="pw-current" name="current" type="password" autoComplete="current-password" /></div>
        <div className="space-y-1.5"><Label htmlFor="pw-next">New password</Label><Input id="pw-next" name="next" type="password" autoComplete="new-password" /></div>
      </div>
      <Button type="submit" size="sm" className="mt-4" disabled={busy}>Update password</Button>
    </form>
  );
}
