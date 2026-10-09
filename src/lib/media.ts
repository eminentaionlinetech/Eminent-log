import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MediaRow = Database["public"]["Tables"]["media"]["Row"];
export type MediaKind = Database["public"]["Enums"]["media_kind"];
export const BUCKET = "course-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export function kindFor(file: File): MediaKind {
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "other";
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : null;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

export async function uploadMedia(file: File, title?: string): Promise<MediaRow> {
  const kind = kindFor(file);
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80);
  const folder = kind === "image" ? "images" : "files";
  const path = `${folder}/${crypto.randomUUID()}-${safe}`;
  const duration = kind === "video" ? await readVideoDuration(file) : null;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  let public_url: string | null = null;
  if (kind === "image") {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
    public_url = data?.signedUrl ?? null;
  }
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("media")
    .insert({
      kind,
      title: title || file.name,
      bucket: BUCKET,
      path,
      mime_type: file.type || null,
      size_bytes: file.size,
      duration_seconds: duration,
      public_url,
      uploaded_by: user.user?.id ?? null,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function replaceMediaFile(row: MediaRow, file: File): Promise<void> {
  const duration = row.kind === "video" ? await readVideoDuration(file) : row.duration_seconds;
  const { error } = await supabase.storage.from(row.bucket).upload(row.path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("media")
    .update({ size_bytes: file.size, mime_type: file.type || row.mime_type, duration_seconds: duration })
    .eq("id", row.id);
  if (e2) throw e2;
}

export async function deleteMedia(row: MediaRow): Promise<void> {
  const { error } = await supabase.from("media").delete().eq("id", row.id);
  if (error) throw error;
  await supabase.storage.from(row.bucket).remove([row.path]);
}

export async function signedUrl(row: Pick<MediaRow, "bucket" | "path">, seconds = 3600) {
  const { data } = await supabase.storage.from(row.bucket).createSignedUrl(row.path, seconds);
  return data?.signedUrl ?? null;
}

export const ACCEPT: Record<MediaKind | "any", string> = {
  video: "video/mp4,video/webm,video/quicktime",
  pdf: "application/pdf",
  image: "image/png,image/jpeg,image/webp,image/gif",
  other: "*/*",
  any: "video/mp4,video/webm,video/quicktime,application/pdf,image/png,image/jpeg,image/webp,image/gif,.zip,.docx,.pptx,.xlsx",
};
