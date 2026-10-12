import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Manage students — EMINENT LOG" }, { name: "description", content: "Manage students for EMINENT LOG administrators." }, { property: "og:title", content: "Manage students — EMINENT LOG" }, { property: "og:description", content: "Manage students for EMINENT LOG administrators." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Students });

function Students() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const [p, e] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("enrolments").select("user_id, completed_at, course:courses(title)"),
      ]);
      return { profiles: p.data ?? [], enrolments: e.data ?? [] };
    },
  });
  async function toggle(id: string, status: string) {
    const next = status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("profiles").update({ account_status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Students & enrolments</h1>
      <ul className="mt-6 divide-y rounded-2xl border bg-card">
        {q.isLoading ? <li className="p-4 text-sm text-muted-foreground">Loading…</li> : !q.data?.profiles.length ? (
          <li className="p-4 text-sm text-muted-foreground">No registered users yet.</li>
        ) : q.data.profiles.map((p) => {
          const en = q.data.enrolments.filter((e) => e.user_id === p.id);
          return (
            <li key={p.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.full_name || "—"} <span className="text-sm font-normal text-muted-foreground">{p.email}</span></p>
                <p className="text-xs text-muted-foreground">Joined {new Date(p.created_at).toLocaleDateString()} · {en.length ? en.map((e) => `${e.course?.title}${e.completed_at ? " (completed)" : ""}`).join(", ") : "No enrolments"}</p>
              </div>
              <Button size="sm" variant={p.account_status === "active" ? "outline" : "default"} onClick={() => toggle(p.id, p.account_status)}>
                {p.account_status === "active" ? "Suspend" : "Reactivate"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
