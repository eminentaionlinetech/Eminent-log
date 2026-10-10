const API = "https://api.korapay.com/merchant/api/v1";

export function korapaySecret(): string | null {
  const k = process.env["KORAPAY_SECRET_KEY"];
  return k && k.trim() ? k.trim() : null;
}

type KoraCharge = { status?: string; amount?: string | number; currency?: string; reference?: string };

/** Ask Korapay directly for the charge status — the only source we trust before granting access. */
export async function fetchCharge(reference: string, secret: string): Promise<KoraCharge | null> {
  const res = await fetch(`${API}/charges/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { status?: boolean; data?: KoraCharge } | null;
  return body?.status && body.data ? body.data : null;
}

export async function initializeCharge(
  secret: string,
  input: { reference: string; amountNaira: number; email: string; name: string; redirectUrl: string; notificationUrl: string },
): Promise<string | null> {
  const res = await fetch(`${API}/charges/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({
      reference: input.reference,
      amount: input.amountNaira,
      currency: "NGN",
      narration: "EMINENT LOG Premium — 1 month",
      redirect_url: input.redirectUrl,
      notification_url: input.notificationUrl,
      customer: { email: input.email, name: input.name },
    }),
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; data?: { checkout_url?: string } } | null;
  if (!res.ok || !body?.status) {
    console.error("[korapay] initialize failed", res.status, JSON.stringify(body)?.slice(0, 300));
    return null;
  }
  return body.data?.checkout_url ?? null;
}

/** Verifies with Korapay, then atomically marks the payment successful and extends Premium by 30 days. */
export async function verifyAndGrant(reference: string, secret: string): Promise<"success" | "pending" | "failed"> {
  const charge = await fetchCharge(reference, secret);
  if (!charge) return "pending";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (charge.status === "success" && String(charge.currency ?? "NGN").toUpperCase() === "NGN") {
    const kobo = Math.round(Number(charge.amount) * 100);
    const { data, error } = await supabaseAdmin.rpc("grant_premium_payment", {
      _reference: reference,
      _amount_kobo: kobo,
      _raw: charge as never,
    });
    if (error) {
      console.error("[korapay] grant failed", error.message);
      return "pending";
    }
    return data ? "success" : "failed";
  }
  if (charge.status === "failed") {
    await supabaseAdmin.from("payments").update({ status: "failed", raw: charge as never }).eq("reference", reference).eq("status", "pending");
    return "failed";
  }
  return "pending";
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
