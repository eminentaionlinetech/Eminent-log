import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { confirmPremiumPayment, getPaymentsConfigured, startPremiumCheckout } from "@/lib/premium.functions";

export const Route = createFileRoute("/premium")({
  validateSearch: (s: Record<string, unknown>): { reference?: string | undefined } => ({
    reference: typeof s["reference"] === "string" ? s["reference"].slice(0, 40) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "EMINENT LOG Premium — ₦10,000 per month" },
      { name: "description", content: "EMINENT LOG Premium gives you access to every premium course, lesson and resource for ₦10,000 per month." },
      { property: "og:title", content: "EMINENT LOG Premium" },
      { property: "og:description", content: "Access every premium course for ₦10,000 per month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Premium,
});

const REASONS: Record<string, string> = {
  not_configured: "Online payments are awaiting configuration. Please check back soon.",
  no_email: "Your account has no email address, which Korapay needs for your receipt.",
  suspended: "Your account is suspended. Please contact us.",
  provider: "Korapay couldn't start the payment. Please try again shortly.",
  error: "Something went wrong. Please try again.",
};

function Premium() {
  const { user, loading } = useAuth();
  const { reference } = Route.useSearch();
  const qc = useQueryClient();
  const start = useServerFn(startPremiumCheckout);
  const confirm = useServerFn(confirmPremiumPayment);
  const getConfig = useServerFn(getPaymentsConfigured);
  const [busy, setBusy] = useState(false);
  const [payState, setPayState] = useState<"idle" | "checking" | "success" | "pending" | "failed">("idle");

  const config = useQuery({ queryKey: ["payments-configured"], queryFn: () => getConfig() });
  const sub = useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("subscriptions").select("status, current_period_end").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const active = sub.data?.status === "active" && !!sub.data.current_period_end && new Date(sub.data.current_period_end) > new Date();

  useEffect(() => {
    if (!reference || !user) return;
    let cancelled = false;
    let tries = 0;
    setPayState("checking");
    async function poll() {
      try {
        const r = await confirm({ data: { reference: reference! } });
        if (cancelled) return;
        if (r.status === "success") {
          setPayState("success");
          qc.invalidateQueries();
          return;
        }
        if (r.status === "failed") return setPayState("failed");
        if (++tries < 6) setTimeout(poll, 4000);
        else setPayState("pending");
      } catch {
        if (!cancelled) setPayState("pending");
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [reference, user, confirm, qc]);

  async function subscribe() {
    setBusy(true);
    try {
      const r = await start();
      if (r.ok) {
        window.location.href = r.checkoutUrl;
        return;
      }
      toast.error(REASONS[r.reason] ?? REASONS["error"]);
    } catch {
      toast.error(REASONS["error"]);
    }
    setBusy(false);
  }

  const configured = config.data?.configured;

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

        {payState === "checking" && (
          <p role="status" className="mt-8 flex items-center gap-2 rounded-xl border bg-muted p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Confirming your payment with Korapay…</p>
        )}
        {payState === "success" && (
          <p role="status" className="mt-8 flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-4 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Payment confirmed. Premium is now active.</p>
        )}
        {payState === "pending" && (
          <p role="status" className="mt-8 rounded-xl border bg-muted p-4 text-sm">Your payment hasn't been confirmed yet. If you completed it, Premium will activate automatically within a few minutes.</p>
        )}
        {payState === "failed" && (
          <p role="alert" className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">The payment was not successful. You have not been charged for Premium. You can try again.</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {loading || config.isLoading ? (
            <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
          ) : !user ? (
            <Button asChild><Link to="/auth" search={{ mode: "register" }}>Register to subscribe</Link></Button>
          ) : active ? (
            <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-5 w-5" aria-hidden /> Premium active until {new Date(sub.data!.current_period_end!).toLocaleDateString()}</p>
          ) : configured ? (
            <Button onClick={subscribe} disabled={busy}>{busy ? "Opening Korapay…" : "Subscribe with Korapay"}</Button>
          ) : (
            <Button disabled>Payments awaiting configuration</Button>
          )}
          <Button asChild variant="outline"><Link to="/courses" search={{ access: "free" }}>Browse free courses</Link></Button>
        </div>
        {user && active && configured && (
          <Button variant="link" className="mt-2 px-0" onClick={subscribe} disabled={busy}>Add another month</Button>
        )}
        {!configured && !config.isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">Online payment with Korapay is not switched on yet. Subscriptions will open here once it is.</p>
        )}
      </div>
    </div>
  );
}
