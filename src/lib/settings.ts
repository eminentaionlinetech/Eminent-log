import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteContent = {
  about_title?: string;
  about_body?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_whatsapp?: string;
  contact_address?: string;
};

export const siteContentQuery = queryOptions({
  queryKey: ["site_settings", "content"],
  queryFn: async (): Promise<SiteContent> => {
    const { data, error } = await supabase.from("site_settings").select("value").eq("key", "content").maybeSingle();
    if (error) throw error;
    return (data?.value as SiteContent) ?? {};
  },
});
