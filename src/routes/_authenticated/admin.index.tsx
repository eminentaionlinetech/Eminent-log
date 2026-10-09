import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

async function count(table: "courses" | "profiles" | "enrolments" | "media" | "categories", filter?: (q: any) => any) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

function Overview() {
  const stats = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [published, drafts, students, enrolments, media, categories] = await Promise.all([
        count("courses", (q) => q.eq("status", "published")),
        count("courses", (q) => q.eq("status", "draft")),
        count("profiles"),
        count("enrolments"),
        count("media"),
        count("categories"),
      ]);
      return { published, drafts, students, enrolments, media, categories };
    },
  });
  const cards = [
    { label: "Published courses", v: stats.data?.published, to: "/admin/courses" },
    { label: "Draft courses", v: stats.data?.drafts, to: "/admin/courses" },
    { label: "Registered users", v: stats.data?.students, to: "/admin/students" },
    { label: "Enrolments", v: stats.data?.enrolments, to: "/admin/students" },
    { label: "Media files", v: stats.data?.media, to: "/admin/media" },
    { label: "Categories", v: stats.data?.categories, to: "/admin/categories" },
  ] as const;
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Admin overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Live figures from your database.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-2xl border bg-card p-5 shadow-card hover:border-primary">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            {stats.isLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 font-display text-3xl font-bold">{c.v}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
