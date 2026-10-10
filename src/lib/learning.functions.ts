import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_SECONDS = 60 * 60 * 3;

// Returns short-lived signed URLs for a lesson's video and PDFs, only for enrolled students with access.
export const getLessonPlayback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lessonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, title, description, course_id, video_media_id, is_published")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson || !lesson.is_published) throw new Error("This lesson is not available.");
    const [{ data: enr }, { data: canAccess }] = await Promise.all([
      supabase.from("enrolments").select("id").eq("user_id", userId).eq("course_id", lesson.course_id).maybeSingle(),
      supabase.rpc("can_access_course", { _user_id: userId, _course_id: lesson.course_id }),
    ]);
    if (!canAccess) throw new Error("PREMIUM_REQUIRED");
    if (!enr) throw new Error("NOT_ENROLLED");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let video: { url: string; duration: number | null } | null = null;
    if (lesson.video_media_id) {
      const { data: m } = await supabaseAdmin.from("media").select("bucket, path, duration_seconds").eq("id", lesson.video_media_id).maybeSingle();
      if (m) {
        const { data: s } = await supabaseAdmin.storage.from(m.bucket).createSignedUrl(m.path, SIGNED_SECONDS);
        if (s?.signedUrl) video = { url: s.signedUrl, duration: m.duration_seconds != null ? Number(m.duration_seconds) : null };
      }
    }
    const { data: res } = await supabaseAdmin
      .from("lesson_resources")
      .select("id, title, position, media:media(bucket, path, size_bytes)")
      .eq("lesson_id", lesson.id)
      .order("position");
    const resources: { id: string; title: string; url: string; size: number | null }[] = [];
    for (const r of res ?? []) {
      if (!r.media) continue;
      const { data: s } = await supabaseAdmin.storage.from(r.media.bucket).createSignedUrl(r.media.path, SIGNED_SECONDS, { download: `${r.title}.pdf` });
      if (s?.signedUrl) resources.push({ id: r.id, title: r.title, url: s.signedUrl, size: r.media.size_bytes });
    }
    return { id: lesson.id, title: lesson.title, description: lesson.description, video, resources };
  });
