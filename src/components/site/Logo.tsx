import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="EMINENT LOG home">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient font-display text-sm font-bold text-primary-foreground">
        EL
      </span>
      <span
        className={cn(
          "font-display text-base font-bold tracking-tight",
          inverted ? "text-navy-foreground" : "text-navy",
        )}
      >
        EMINENT LOG
      </span>
    </Link>
  );
}
