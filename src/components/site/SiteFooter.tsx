import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo inverted />
          <p className="mt-4 max-w-sm text-sm text-navy-foreground/70">
            Learn. Create. Teach. Grow. Practical digital skills taught through real video lessons.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Learn</h2>
          <ul className="mt-3 space-y-2 text-sm text-navy-foreground/70">
            <li><Link to="/courses" className="hover:text-navy-foreground">Explore Courses</Link></li>
            <li><Link to="/categories" className="hover:text-navy-foreground">Categories</Link></li>
            <li><Link to="/premium" className="hover:text-navy-foreground">EMINENT LOG Premium</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Company</h2>
          <ul className="mt-3 space-y-2 text-sm text-navy-foreground/70">
            <li><Link to="/about" className="hover:text-navy-foreground">About</Link></li>
            <li><Link to="/contact" className="hover:text-navy-foreground">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-foreground/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-navy-foreground/60 sm:px-6">
          © {new Date().getFullYear()} EMINENT LOG. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
