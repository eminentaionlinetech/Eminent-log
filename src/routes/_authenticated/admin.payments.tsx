import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/payments")({ component: Payments });

function Payments() {
  const q = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const [p, s] = await Promise.all([
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      return { payments: p.data ?? [], subs: s.data ?? [] };
    },
  });
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-navy">Subscriptions & payments</h1>
      <section>
        <h2 className="font-semibold">Subscriptions</h2>
        <ul className="mt-3 divide-y rounded-2xl border bg-card text-sm">
          {!q.data?.subs.length ? <li className="p-4 text-muted-foreground">No subscriptions yet.</li> : q.data.subs.map((s) => (
            <li key={s.id} className="p-3">{s.user_id.slice(0, 8)} · {s.status}{s.current_period_end ? ` · until ${new Date(s.current_period_end).toLocaleDateString()}` : ""}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Verified payments</h2>
        <ul className="mt-3 divide-y rounded-2xl border bg-card text-sm">
          {!q.data?.payments.length ? <li className="p-4 text-muted-foreground">No payments yet.</li> : q.data.payments.map((p) => (
            <li key={p.id} className="p-3">{p.reference} · ₦{(p.amount_kobo / 100).toLocaleString()} · {p.status} · {new Date(p.created_at).toLocaleString()}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
