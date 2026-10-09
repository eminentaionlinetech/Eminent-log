import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — EMINENT LOG" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const LINKS = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/courses", label: "Courses" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/instructors", label: "Instructors" },
  { to: "/admin/media", label: "Media" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/payments", label: "Payments" },
  { to: "/admin/content", label: "Site content" },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:w-52 lg:shrink-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  activeOptions={{ exact: "exact" in l }}
                  className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  activeProps={{ className: "bg-navy text-navy-foreground hover:bg-navy hover:text-navy-foreground" }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
