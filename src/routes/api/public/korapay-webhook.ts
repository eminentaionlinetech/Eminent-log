import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/korapay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { korapaySecret, hmacSha256Hex, timingSafeEqual, verifyAndGrant } = await import("@/lib/korapay.server");
        const secret = korapaySecret();
        if (!secret) return new Response("not configured", { status: 503 });
        const raw = await request.text();
        let body: { event?: string; data?: { reference?: string } };
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("bad request", { status: 400 });
        }
        const sig = request.headers.get("x-korapay-signature") ?? "";
        const expected = await hmacSha256Hex(secret, JSON.stringify(body.data ?? {}));
        if (!sig || !timingSafeEqual(sig, expected)) return new Response("invalid signature", { status: 401 });
        const reference = body.data?.reference;
        if (typeof reference === "string" && /^EL-[a-f0-9]{20}$/.test(reference)) {
          // Never trust the webhook body alone: re-check the charge with Korapay before granting.
          await verifyAndGrant(reference, secret);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
