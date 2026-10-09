import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, RefreshCw, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaIcon } from "@/components/admin/MediaPicker";
import { ACCEPT, deleteMedia, replaceMediaFile, signedUrl, uploadMedia, type MediaRow } from "@/lib/media";
import { formatBytes, formatDuration } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/media")({ component: Media });

function Media() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState(false);
  const up = useRef<HTMLInputElement>(null);
  const rep = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<MediaRow | null>(null);
  const list = useQuery({
    queryKey: ["media", "library"],
    queryFn: async () => (await supabase.from("media").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["media"] });
  const items = (list.data ?? []).filter((m) => (!kind || m.kind === kind) && m.title.toLowerCase().includes(q.toLowerCase()));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      try { await uploadMedia(f); } catch (e) { toast.error(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`); }
    }
    setBusy(false);
    if (up.current) up.current.value = "";
    refresh();
  }
  async function replace(f: File | undefined) {
    if (!f || !target) return;
    try { await replaceMediaFile(target, f); toast.success("File replaced"); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    if (rep.current) rep.current.value = "";
  }
  async function preview(m: MediaRow) {
    const url = m.public_url ?? (await signedUrl(m, 600));
    if (url) window.open(url, "_blank", "noopener");
  }
  async function del(m: MediaRow) {
    if (!confirm(`Delete "${m.title}"? It will be removed from any lesson using it.`)) return;
    try { await deleteMedia(m); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Media library</h1>
        <input ref={up} type="file" multiple className="hidden" accept={ACCEPT.any} onChange={(e) => upload(e.target.files)} />
        <input ref={rep} type="file" className="hidden" onChange={(e) => replace(e.target.files?.[0])} />
        <Button onClick={() => up.current?.click()} disabled={busy}><Upload /> {busy ? "Uploading…" : "Upload files"}</Button>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">All types</option><option value="video">Videos</option><option value="pdf">PDFs</option><option value="image">Images</option><option value="other">Other</option>
        </select>
      </div>
      <ul className="mt-4 divide-y rounded-2xl border bg-card">
        {list.isLoading ? <li className="p-4 text-sm text-muted-foreground">Loading…</li> : items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No media uploaded yet.</li>
        ) : items.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            {m.kind === "image" && m.public_url ? <img src={m.public_url} alt="" className="h-12 w-16 rounded object-cover" loading="lazy" /> : (
              <span className="grid h-12 w-16 place-items-center rounded bg-muted text-muted-foreground"><MediaIcon kind={m.kind} /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.kind.toUpperCase()} · {formatBytes(m.size_bytes)}{m.duration_seconds ? ` · ${formatDuration(Number(m.duration_seconds))}` : ""} · {new Date(m.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="Preview" onClick={() => preview(m)}><Eye /></Button>
              <Button variant="ghost" size="icon" aria-label="Replace file" onClick={() => { setTarget(m); rep.current?.click(); }}><RefreshCw /></Button>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => del(m)}><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
