import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PublicCourse = Awaited<ReturnType<typeof loadCourse>>;

async function loadCourse(slug: string) {
  const sb = publicClient();
  const { data: course, error } = await sb
    .from("courses")
    .select(
      "id, slug, title, short_description, description, thumbnail_url, access_type, learning_outcomes, requirements, intended_audience, category:categories(id,name,slug), instructor:instructors(id,name,title,bio,photo_url)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("Could not load course");
  if (!course) return null;
  const [{ data: modules }, { data: lessons }, { data: meta }] = await Promise.all([
    sb.from("modules").select("id, title, position").eq("course_id", course.id).order("position"),
    sb.from("lessons").select("id, module_id, title, position").eq("course_id", course.id).order("position"),
    sb.rpc("course_lesson_meta", { _course_id: course.id }),
  ]);
  const metaById = new Map((meta ?? []).map((m) => [m.lesson_id, m]));
  const curriculum = (modules ?? []).map((m) => ({
    ...m,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => {
        const mm = metaById.get(l.id);
        return {
          id: l.id,
          title: l.title,
          position: l.position,
          has_video: !!mm?.has_video,
          duration_seconds: mm?.duration_seconds != null ? Number(mm.duration_seconds) : null,
          resource_count: mm?.resource_count ?? 0,
        };
      }),
  }));
  return { course, curriculum };
}

export const getPublishedCourse = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 120) }))
  .handler(async ({ data }) => loadCourse(data.slug));
