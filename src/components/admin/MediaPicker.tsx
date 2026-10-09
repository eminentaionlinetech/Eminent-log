import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Film, ImageIcon, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPT, uploadMedia, type MediaKind, type MediaRow } from "@/lib/media";
import { formatBytes, formatDuration } from "@/lib/catalog";

export function MediaIcon({ kind }: { kind: MediaKind }) {
  if (kind === "video") return <Film className="h-4 w-4" aria-hidden />;
  if (kind === "image") return <ImageIcon className="h-4 w-4" aria-hidden />;
  return <FileText className="h-4 w-4" aria-hidden />;
}

export function MediaPicker({
  open,
  onOpenChange,
  kind,
  onPick,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind?: MediaKind;
  onPick: (m: MediaRow) => void;
  title: string;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["media", kind ?? "all"],
    enabled: open,
    queryFn: async () => {
      let qy = supabase.from("media").select("*").order("created_at", { ascending: false }).limit(200);
      if (kind) qy = qy.eq("kind", kind);
      const { data, error } = await qy;
      if (error) throw error;
      return data;
    },
  });
  const items = (list.data ?? []).filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const row = await uploadMedia(f);
      if (kind && row.kind !== kind) toast.warning(`Uploaded, but this file is a ${row.kind}, not a ${kind}.`);
      qc.invalidateQueries({ queryKey: ["media"] });
      if (!kind || row.kind === kind) {
        onPick(row);
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Search media…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
          <input ref={fileRef} type="file" className="hidden" accept={ACCEPT[kind ?? "any"]} onChange={(e) => onFile(e.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}><Upload /> {busy ? "Uploading…" : "Upload new"}</Button>
        </div>
        <ul className="mt-2 divide-y rounded-lg border">
          {list.isLoading ? (
            <li className="p-4 text-sm text-muted-foreground">Loading…</li>
          ) : items.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No matching files. Upload one to get started.</li>
          ) : (
            items.map((m) => (
              <li key={m.id}>
                <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent" onClick={() => { onPick(m); onOpenChange(false); }}>
                  {m.kind === "image" && m.public_url ? (
                    <img src={m.public_url} alt="" className="h-10 w-14 rounded object-cover" />
                  ) : (
                    <span className="grid h-10 w-14 place-items-center rounded bg-muted text-muted-foreground"><MediaIcon kind={m.kind} /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.kind.toUpperCase()} · {formatBytes(m.size_bytes)}
                      {m.duration_seconds ? ` · ${formatDuration(Number(m.duration_seconds))}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
