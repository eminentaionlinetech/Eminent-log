import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Manage categories — EMINENT LOG" }, { name: "description", content: "Manage categories for EMINENT LOG administrators." }, { property: "og:title", content: "Manage categories — EMINENT LOG" }, { property: "og:description", content: "Manage categories for EMINENT LOG administrators." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Cats });

function Cats() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("position").order("name")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });
  const list = q.data ?? [];

  async function add() {
    const name = prompt("Category name")?.trim();
    if (!name) return;
    const { error } = await supabase.from("categories").insert({ name, slug: slugify(name), position: list.length + 1 });
    if (error) toast.error(error.message); else refresh();
  }
  async function edit(id: string, name: string, description: string | null) {
    const n = prompt("Category name", name)?.trim();
    if (!n) return;
    const d = prompt("Short description (optional)", description ?? "");
    const { error } = await supabase.from("categories").update({ name: n, slug: slugify(n), description: d?.trim() || null }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }
  async function del(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Courses in it become uncategorised.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }
  async function move(i: number, j: number) {
    await supabase.from("categories").update({ position: j + 1 }).eq("id", list[i]!.id);
    await supabase.from("categories").update({ position: i + 1 }).eq("id", list[j]!.id);
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Categories</h1>
        <Button onClick={add}><Plus /> Add category</Button>
      </div>
      <ul className="mt-6 divide-y rounded-2xl border bg-card">
        {list.length === 0 && <li className="p-4 text-sm text-muted-foreground">No categories yet.</li>}
        {list.map((c, i) => (
          <li key={c.id} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0"><p className="font-medium">{c.name}</p>{c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}</div>
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp /></Button>
              <Button variant="ghost" size="icon" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, i + 1)}><ArrowDown /></Button>
              <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => edit(c.id, c.name, c.description)}><Pencil /></Button>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => del(c.id, c.name)}><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
