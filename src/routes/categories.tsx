import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, GraduationCap } from "lucide-react";
import { categoriesQuery, publishedCoursesQuery } from "@/lib/catalog";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/site/States";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { title: "Course Categories — EMINENT LOG" },
      { name: "description", content: "Browse EMINENT LOG learning categories: website design, graphic design, online business and digital skills." },
      { property: "og:title", content: "Course Categories — EMINENT LOG" },
      { property: "og:description", content: "Browse learning categories on EMINENT LOG." },
    ],
  }),
  component: Categories,
});

function Categories() {
  const cats = useQuery(categoriesQuery);
  const courses = useQuery(publishedCoursesQuery);
  const countFor = (id: string) => (courses.data ?? []).filter((c) => c.category?.id === id).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-navy sm:text-4xl">Categories</h1>
      <p className="mt-2 text-muted-foreground">Choose a learning area to see its courses.</p>
      <div className="mt-8">
        {cats.isLoading ? (
          <CardGridSkeleton count={4} />
        ) : cats.isError ? (
          <ErrorState onRetry={() => cats.refetch()} />
        ) : !cats.data?.length ? (
          <EmptyState title="No categories yet." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cats.data.map((c) => {
              const n = countFor(c.id);
              return (
                <Link key={c.id} to="/courses" search={{ category: c.slug }} className="group rounded-2xl border bg-card p-6 shadow-card hover:border-primary">
                  <GraduationCap className="h-7 w-7 text-primary" aria-hidden />
                  <h2 className="mt-4 text-xl font-semibold">{c.name}</h2>
                  {c.description && <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>}
                  <div className="mt-4 flex items-center justify-between text-sm">
                    {courses.data && (
                      <span className="text-muted-foreground">
                        {n === 0 ? "No published courses yet" : `${n} course${n === 1 ? "" : "s"}`}
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
