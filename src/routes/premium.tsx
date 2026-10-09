import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "EMINENT LOG Premium — ₦10,000 per month" },
      { name: "description", content: "EMINENT LOG Premium gives you access to every premium course, lesson and resource for ₦10,000 per month." },
      { property: "og:title", content: "EMINENT LOG Premium" },
      { property: "og:description", content: "Access every premium course for ₦10,000 per month." },
    ],
  }),
  component: Premium,
});

function Premium() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="rounded-3xl border bg-card p-8 shadow-card sm:p-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-amber-foreground">
          <Crown className="h-3.5 w-3.5" aria-hidden /> EMINENT LOG Premium
        </span>
        <h1 className="mt-4 text-3xl font-bold text-navy sm:text-4xl">One plan. Every premium course.</h1>
        <p className="mt-4 font-display text-4xl font-bold text-navy">
          ₦10,000 <span className="text-base font-medium text-muted-foreground">per month</span>
        </p>
        <ul className="mt-6 space-y-3">
          {["Access to all premium courses and lessons", "Download premium lesson resources", "Your progress is saved across every course"].map((t) => (
            <li key={t} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />{t}</li>
          ))}
        </ul>
        <div className="mt-8 rounded-xl border border-dashed bg-muted p-4 text-sm text-muted-foreground">
          Online payment with Korapay is being finalised. Subscriptions will open here shortly.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled aria-describedby="pay-note">Subscribe — coming soon</Button>
          <Button asChild variant="outline"><Link to="/courses" search={{ access: "free" }}>Browse free courses</Link></Button>
        </div>
        <p id="pay-note" className="sr-only">Payments are not yet available.</p>
      </div>
    </div>
  );
}
