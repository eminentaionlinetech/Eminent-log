import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PREMIUM_PRICE_NAIRA = 10000;

export const getPaymentsConfigured = createServerFn({ method: "GET" }).handler(async () => {
  const { korapaySecret } = await import("./korapay.server");
  return { configured: !!korapaySecret() };
});

export const startPremiumCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { korapaySecret, initializeCharge } = await import("./korapay.server");
    const secret = korapaySecret();
    if (!secret) return { ok: false as const, reason: "not_configured" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("email, full_name, account_status").eq("id", context.userId).maybeSingle();
    if (!profile?.email) return { ok: false as const, reason: "no_email" as const };
    if (profile.account_status !== "active") return { ok: false as const, reason: "suspended" as const };

    const reference = `EL-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      reference,
      amount_kobo: PREMIUM_PRICE_NAIRA * 100,
      currency: "NGN",
      provider: "korapay",
      status: "pending",
    });
    if (error) return { ok: false as const, reason: "error" as const };

    const origin = new URL(getRequest().url).origin;
    const checkoutUrl = await initializeCharge(secret, {
      reference,
      amountNaira: PREMIUM_PRICE_NAIRA,
      email: profile.email,
      name: profile.full_name || profile.email,
      redirectUrl: `${origin}/premium?reference=${reference}`,
      notificationUrl: `${origin}/api/public/korapay-webhook`,
    });
    if (!checkoutUrl) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("reference", reference);
      return { ok: false as const, reason: "provider" as const };
    }
    return { ok: true as const, checkoutUrl };
  });

export const confirmPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reference: z.string().regex(/^EL-[a-f0-9]{20}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: the caller can only see their own payment rows.
    const { data: pay } = await context.supabase.from("payments").select("status").eq("reference", data.reference).maybeSingle();
    if (!pay) return { status: "unknown" as const };
    if (pay.status !== "pending") return { status: pay.status };
    const { korapaySecret, verifyAndGrant } = await import("./korapay.server");
    const secret = korapaySecret();
    if (!secret) return { status: "pending" as const };
    return { status: await verifyAndGrant(data.reference, secret) };
  });
