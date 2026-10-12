import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/components/admin/MediaPicker";

export const Route = createFileRoute("/_authenticated/admin/instructors")({
  head: () => ({ meta: [{ title: "Manage instructors — EMINENT LOG" }, { name: "description", content: "Manage instructors for EMINENT LOG administrators." }, { property: "og:title", content: "Manage instructors — EMINENT LOG" }, { property: "og:description", content: "Manage instructors for EMINENT LOG administrators." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Instructors });

function Instructors() {
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const q = useQuery({ queryKey: ["instructors"], queryFn: async () => (await supabase.from("instructors").select("*").order("name")).data ?? [] });

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase.from("instructors").insert({
      name,
      title: String(fd.get("title") ?? "").trim() || null,
      bio: String(fd.get("bio") ?? "").trim() || null,
      photo_url: photo,
    });
    if (error) return toast.error(error.message);
    form.reset();
    setPhoto(null);
    qc.invalidateQueries({ queryKey: ["instructors"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this instructor?")) return;
    await supabase.from("instructors").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["instructors"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Instructors</h1>
      <form onSubmit={add} className="space-y-3 rounded-2xl border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="i-name">Name</Label><Input id="i-name" name="name" required maxLength={120} /></div>
          <div className="space-y-1.5"><Label htmlFor="i-title">Title</Label><Input id="i-title" name="title" maxLength={120} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="i-bio">Bio</Label><Textarea id="i-bio" name="bio" rows={3} maxLength={3000} /></div>
        <div className="flex items-center gap-3">
          {photo && <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" />}
          <Button type="button" variant="outline" size="sm" onClick={() => setPick(true)}>{photo ? "Change photo" : "Add photo"}</Button>
        </div>
        <Button type="submit">Add instructor</Button>
      </form>
      <ul className="divide-y rounded-2xl border bg-card">
        {(q.data ?? []).length === 0 && <li className="p-4 text-sm text-muted-foreground">No instructors yet.</li>}
        {(q.data ?? []).map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
              {i.photo_url && <img src={i.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />}
              <div><p className="font-medium">{i.name}</p>{i.title && <p className="text-xs text-muted-foreground">{i.title}</p>}</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => del(i.id)}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <MediaPicker open={pick} onOpenChange={setPick} kind="image" title="Instructor photo" onPick={(m) => setPhoto(m.public_url)} />
    </div>
  );
}
