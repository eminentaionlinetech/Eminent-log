import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CourseCardData = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  access_type: "free" | "premium";
  featured: boolean;
  published_at: string | null;
  category: { id: string; name: string; slug: string } | null;
  instructor: { id: string; name: string } | null;
  module_count: number;
  lesson_count: number;
  total_seconds: number | null;
};

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").order("position").order("name");
    if (error) throw error;
    return data;
  },
});

export const publishedCoursesQuery = queryOptions({
  queryKey: ["courses", "published"],
  queryFn: async (): Promise<CourseCardData[]> => {
    const [{ data, error }, { data: stats }] = await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, slug, title, short_description, description, thumbnail_url, access_type, featured, published_at, category:categories(id,name,slug), instructor:instructors(id,name)",
        )
        .eq("status", "published")
        .order("published_at", { ascending: false }),
      supabase.rpc("course_catalog_stats"),
    ]);
    if (error) throw error;
    const byId = new Map((stats ?? []).map((s) => [s.course_id, s]));
    return (data ?? []).map((c) => {
      const s = byId.get(c.id);
      return {
        ...(c as Omit<CourseCardData, "module_count" | "lesson_count" | "total_seconds">),
        module_count: s?.module_count ?? 0,
        lesson_count: s?.lesson_count ?? 0,
        total_seconds: s && s.all_durations_known && s.lesson_count > 0 ? Number(s.total_seconds) : null,
      };
    });
  },
});

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return `${Math.round(seconds)}s`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
