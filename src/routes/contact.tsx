import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { siteContentQuery } from "@/lib/settings";
import { EmptyState } from "@/components/site/States";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { title: "Contact EMINENT LOG" },
      { name: "description", content: "Get in touch with the EMINENT LOG team about courses, Premium and your account." },
      { property: "og:title", content: "Contact EMINENT LOG" },
      { property: "og:description", content: "Get in touch with the EMINENT LOG team." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { data, isLoading } = useQuery(siteContentQuery);
  const items = [
    data?.contact_email && { icon: Mail, label: "Email", value: data.contact_email, href: `mailto:${data.contact_email}` },
    data?.contact_phone && { icon: Phone, label: "Phone", value: data.contact_phone, href: `tel:${data.contact_phone.replace(/\s/g, "")}` },
    data?.contact_whatsapp && {
      icon: MessageCircle,
      label: "WhatsApp",
      value: data.contact_whatsapp,
      href: `https://wa.me/${encodeURIComponent(data.contact_whatsapp.replace(/\D/g, ""))}`,
    },
    data?.contact_address && { icon: MapPin, label: "Address", value: data.contact_address },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href?: string }[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold text-navy sm:text-4xl">Contact</h1>
      <p className="mt-2 text-muted-foreground">We're happy to help with courses, Premium or your account.</p>
      <div className="mt-8">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : items.length === 0 ? (
          <EmptyState title="Contact details coming soon." description="Our contact details will be published here shortly." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((i) => (
              <li key={i.label} className="rounded-2xl border bg-card p-5 shadow-card">
                <i.icon className="h-5 w-5 text-primary" aria-hidden />
                <p className="mt-3 text-sm font-medium text-muted-foreground">{i.label}</p>
                {i.href ? (
                  <a href={i.href} className="mt-1 block break-words font-semibold hover:text-primary" target={i.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                    {i.value}
                  </a>
                ) : (
                  <p className="mt-1 font-semibold">{i.value}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
