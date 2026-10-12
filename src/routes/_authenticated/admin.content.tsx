import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { siteContentQuery, type SiteContent } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({ meta: [{ title: "Manage site content — EMINENT LOG" }, { name: "description", content: "Manage site content for EMINENT LOG administrators." }, { property: "og:title", content: "Manage site content — EMINENT LOG" }, { property: "og:description", content: "Manage site content for EMINENT LOG administrators." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Content });

const FIELDS: { k: keyof SiteContent; l: string; area?: boolean }[] = [
  { k: "about_title", l: "About page heading" },
  { k: "about_body", l: "About page text (blank line between paragraphs)", area: true },
  { k: "contact_email", l: "Contact email" },
  { k: "contact_phone", l: "Contact phone" },
  { k: "contact_whatsapp", l: "WhatsApp number" },
  { k: "contact_address", l: "Address" },
];

function Content() {
  const qc = useQueryClient();
  const q = useQuery(siteContentQuery);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const value: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = String(fd.get(f.k) ?? "").trim().slice(0, 5000);
      if (v) value[f.k] = v;
    }
    const { error } = await supabase.from("site_settings").upsert({ key: "content", value, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: siteContentQuery.queryKey });
  }
  if (q.isLoading) return null;
  return (
    <form onSubmit={save} className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Site content</h1>
      {FIELDS.map((f) => (
        <div key={f.k} className="space-y-1.5">
          <Label htmlFor={`sc-${f.k}`}>{f.l}</Label>
          {f.area ? <Textarea id={`sc-${f.k}`} name={f.k} rows={6} defaultValue={q.data?.[f.k] ?? ""} /> : <Input id={`sc-${f.k}`} name={f.k} defaultValue={q.data?.[f.k] ?? ""} />}
        </div>
      ))}
      <Button type="submit">Save content</Button>
    </form>
  );
}
