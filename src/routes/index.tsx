import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, Crown, GraduationCap, PlayCircle, ShieldCheck, Target, UserPlus } from "lucide-react";
import heroImg from "@/assets/hero-learner.jpg";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/site/CourseCard";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/site/States";
import { categoriesQuery, publishedCoursesQuery } from "@/lib/catalog";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { title: "EMINENT LOG — Learn New Skills. Unlock New Possibilities." },
      { name: "description", content: "Practical digital skills taught through engaging video lessons. Website design, graphic design, online business and more." },
      { property: "og:title", content: "EMINENT LOG — Learn. Create. Teach. Grow." },
      { property: "og:description", content: "Practical digital skills taught through engaging video lessons." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const courses = useQuery(publishedCoursesQuery);
  const cats = useQuery(categoriesQuery);
  const featured = (courses.data ?? []).slice().sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 6);

  return (
    <>
      <section className="relative overflow-hidden bg-card">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Learn. Create. Teach. Grow.
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] text-navy sm:text-5xl lg:text-6xl">
              Learn New Skills. <span className="text-primary">Unlock New Possibilities.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Discover practical knowledge, learn from engaging video lessons and develop the skills you need to grow
              personally and professionally.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to="/courses">Explore Courses <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6">
                {user ? <Link to="/dashboard">Start Learning</Link> : <Link to="/auth" search={{ mode: "register" }}>Start Learning</Link>}
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 -z-0 rounded-[2rem] bg-brand-gradient opacity-10" aria-hidden />
            <img
              src={heroImg}
              alt="A learner studying on a laptop in a modern workspace"
              width={1280}
              height={1024}
              className="relative aspect-[5/4] w-full rounded-3xl object-cover shadow-card"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-navy">Featured Courses</h2>
            <p className="mt-2 text-muted-foreground">Courses available on EMINENT LOG right now.</p>
          </div>
          {featured.length > 0 && (
            <Button asChild variant="ghost"><Link to="/courses">View all <ArrowRight /></Link></Button>
          )}
        </div>
        <div className="mt-8">
          {courses.isLoading ? (
            <CardGridSkeleton count={3} />
          ) : courses.isError ? (
            <ErrorState onRetry={() => courses.refetch()} />
          ) : featured.length === 0 ? (
            <EmptyState title="No courses available yet." description="New courses are being prepared. Check back soon." />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          )}
        </div>
      </section>

      {(cats.data?.length ?? 0) > 0 && (
        <section className="bg-card py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-navy">Learning Categories</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cats.data!.map((c) => (
                <Link
                  key={c.id}
                  to="/courses"
                  search={{ category: c.slug }}
                  className="group rounded-2xl border bg-background p-6 transition-colors hover:border-primary"
                >
                  <GraduationCap className="h-6 w-6 text-primary" aria-hidden />
                  <h3 className="mt-4 font-semibold">{c.name}</h3>
                  {c.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Browse <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-navy">Why EMINENT LOG</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { icon: Target, t: "Practical by design", d: "Every course focuses on skills you can apply to real projects, clients and careers." },
            { icon: PlayCircle, t: "Learn by watching", d: "Structured video lessons, organised into clear modules you can follow at your pace." },
            { icon: ShieldCheck, t: "Progress you can trust", d: "Your progress is saved as you learn, so you always know where to continue." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border bg-card p-6 shadow-card">
              <f.icon className="h-6 w-6 text-primary" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-navy">How Learning Works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              { icon: UserPlus, t: "Create your account", d: "Register for free in under a minute." },
              { icon: BookOpenCheck, t: "Choose a course", d: "Browse by category or search for a skill." },
              { icon: PlayCircle, t: "Watch the lessons", d: "Follow modules and download resources." },
              { icon: GraduationCap, t: "Complete & grow", d: "Finish every lesson to complete the course." },
            ].map((s, i) => (
              <li key={s.t} className="rounded-2xl border bg-background p-6">
                <span className="font-display text-sm font-semibold text-primary">Step {String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-navy p-8 text-navy-foreground md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/20 px-3 py-1 text-xs font-semibold text-amber">
              <Crown className="h-3.5 w-3.5" aria-hidden /> EMINENT LOG Premium
            </span>
            <h2 className="mt-4 text-3xl font-bold">Unlock every premium course</h2>
            <p className="mt-3 text-navy-foreground/75">
              One monthly plan gives you access to all premium courses, lessons and resources on EMINENT LOG.
            </p>
          </div>
          <div className="md:text-right">
            <p className="font-display text-4xl font-bold">₦10,000<span className="text-base font-medium text-navy-foreground/70"> / month</span></p>
            <Button asChild size="lg" className="mt-5 h-12 bg-amber px-6 text-amber-foreground hover:bg-amber/90">
              <Link to="/premium">Learn about Premium</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-6">
        <h2 className="text-3xl font-bold text-navy">Ready to start learning?</h2>
        <p className="mt-3 text-muted-foreground">Create a free account and begin your first course today.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg">
            {user ? <Link to="/dashboard">Go to my dashboard</Link> : <Link to="/auth" search={{ mode: "register" }}>Create free account</Link>}
          </Button>
        </div>
      </section>
    </>
  );
}
