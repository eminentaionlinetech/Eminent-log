import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { siteContentQuery } from "@/lib/settings";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { title: "About EMINENT LOG — Learn. Create. Teach. Grow." },
      { name: "description", content: "EMINENT LOG is a learning platform for practical digital skills, built for learners who want to grow personally and professionally." },
      { property: "og:title", content: "About EMINENT LOG" },
      { property: "og:description", content: "A learning platform for practical digital skills." },
    ],
  }),
  component: About,
});

function About() {
  const { data, isLoading } = useQuery(siteContentQuery);
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-sm font-semibold text-primary">About us</p>
      <h1 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">{data?.about_title || "Learn. Create. Teach. Grow."}</h1>
      {isLoading ? (
        <div className="mt-6 space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
      ) : (
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-foreground/85">
          {(data?.about_body ||
            "EMINENT LOG is an online learning platform for practical digital skills. We bring structured video courses, downloadable resources and clear progress tracking together, so learners can build skills they can use in their work, business and career.")
            .split(/\n\s*\n/)
            .map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild><Link to="/courses">Explore Courses</Link></Button>
        <Button asChild variant="outline"><Link to="/contact">Contact us</Link></Button>
      </div>
    </div>
  );
}
