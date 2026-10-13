import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="EMINENT LOG home">
      {inverted ? (
        <img src="/assets/eminent-log-logo.png" alt="EMINENT LOG — Knowledge That Moves You Forward." width={768} height={768} className="h-auto w-64 max-w-full" loading="lazy" />
      ) : (
        <>
      <img src="/assets/eminent-log-symbol.png" alt="" width={334} height={334} className="h-10 w-10 shrink-0 rounded-md object-contain" />
      <span
        className={cn(
          "font-display text-base font-bold",
          inverted ? "text-navy-foreground" : "text-navy",
        )}
      >
        EMINENT LOG
      </span>
        </>
      )}
    </Link>
  );
}
