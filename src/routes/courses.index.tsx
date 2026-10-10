import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { CourseCardData } from "@/lib/catalog";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/site/CourseCard";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/site/States";
import { categoriesQuery, publishedCoursesQuery } from "@/lib/catalog";

type Search = { q?: string | undefined; category?: string | undefined; access?: "free" | "premium" | undefined; sort?: "newest" | "title" | undefined };

export const Route = createFileRoute("/courses/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    category: typeof s["category"] === "string" && s["category"] ? s["category"] : undefined,
    access: s["access"] === "free" || s["access"] === "premium" ? s["access"] : undefined,
    sort: s["sort"] === "title" ? "title" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Explore Courses — EMINENT LOG" },
      { name: "description", content: "Search and filter EMINENT LOG courses by category, instructor and free or premium access." },
      { property: "og:title", content: "Explore Courses — EMINENT LOG" },
      { property: "og:description", content: "Search and filter practical digital skills courses." },
    ],
  }),
  component: Catalogue,
});

const PAGE = 12;

function Catalogue() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/courses/" });
  const courses = useQuery(publishedCoursesQuery);
  const cats = useQuery(categoriesQuery);
  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const filtered = useMemo(() => {
    const q = (search.q ?? "").toLowerCase().trim();
    let list = (courses.data ?? []).filter((c) => {
      if (search.category && c.category?.slug !== search.category) return false;
      if (search.access && c.access_type !== search.access) return false;
      if (!q) return true;
      return [c.title, c.short_description, c.description, c.category?.name, c.instructor?.name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
    if (search.sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [courses.data, search]);

  const hasFilters = !!(search.q || search.category || search.access || search.sort);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-navy sm:text-4xl">Explore Courses</h1>
      <p className="mt-2 text-muted-foreground">Find the right course by title, topic, category or instructor.</p>

      <div className="mt-8 grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Search courses</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            defaultValue={search.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder="Search courses…"
            className="h-11 pl-9"
          />
        </label>
        <select
          aria-label="Category"
          className="h-11 rounded-md border bg-background px-3 text-sm"
          value={search.category ?? ""}
          onChange={(e) => set({ category: e.target.value || undefined })}
        >
          <option value="">All categories</option>
          {cats.data?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
        <select
          aria-label="Access type"
          className="h-11 rounded-md border bg-background px-3 text-sm"
          value={search.access ?? ""}
          onChange={(e) => set({ access: (e.target.value || undefined) as Search["access"] })}
        >
          <option value="">Free & Premium</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <select
          aria-label="Sort"
          className="h-11 rounded-md border bg-background px-3 text-sm"
          value={search.sort ?? "newest"}
          onChange={(e) => set({ sort: e.target.value === "title" ? "title" : undefined })}
        >
          <option value="newest">Newest</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate({ search: {}, replace: true })}>
          <X /> Clear filters
        </Button>
      )}

      <div className="mt-8">
        {courses.isLoading ? (
          <CardGridSkeleton />
        ) : courses.isError ? (
          <ErrorState onRetry={() => courses.refetch()} />
        ) : (courses.data?.length ?? 0) === 0 ? (
          <EmptyState title="No courses available yet." description="New courses are being prepared. Check back soon." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No courses found." description="Try a different search or clear your filters." />
        ) : (
          <Paged list={filtered} />
        )}
      </div>
    </div>
  );
}


function Paged({ list }: { list: CourseCardData[] }) {
  const [count, setCount] = useState(PAGE);
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">{list.length} course{list.length === 1 ? "" : "s"}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, count).map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
      {count < list.length && (
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => setCount((n) => n + PAGE)}>Load more</Button>
        </div>
      )}
    </>
  );
}
