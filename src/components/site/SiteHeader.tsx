import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Explore Courses" },
  { to: "/categories", label: "Categories" },
  { to: "/premium", label: "Premium" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setOpen(false);
    navigate({ to: "/auth", replace: true });
  }

  const authLinks = loading ? null : user ? (
    <>
      {isAdmin && (
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">Admin</Link>
        </Button>
      )}
      <Button asChild variant="outline" size="sm">
        <Link to="/dashboard">My Dashboard</Link>
      </Button>
      <Button variant="ghost" size="sm" onClick={signOut}>
        Log out
      </Button>
    </>
  ) : (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link to="/auth">Login</Link>
      </Button>
      <Button asChild size="sm">
        <Link to="/auth" search={{ mode: "register" }}>
          Register
        </Link>
      </Button>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">{authLinks}</div>
        <button
          className="grid h-10 w-10 place-items-center rounded-md border lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t bg-card lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3" aria-label="Mobile">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-md px-3 py-3 text-base font-medium text-foreground"
                activeProps={{ className: "text-primary" }}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-wrap gap-2 border-t pt-3" onClick={() => setOpen(false)}>
              {authLinks}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
