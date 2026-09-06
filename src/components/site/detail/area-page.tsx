import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import { siteAbsoluteUrl, siteTerminology, termPlural } from "@/lib/site/context";
import { areaMapEmbedUrl, areaMapLink, type AreaDetail } from "@/lib/site/areas";
import { faqJsonLd } from "@/lib/site/seo";
import { JsonLd } from "./json-ld";
import { Markdown } from "./markdown";
import { FaqList } from "./faq-list";
import { Chip, CtaBanner, PageHero, ProjectCards, SectionTitle, ServiceCards } from "./shared";

/** Service-area landing page. `heading` is "<terminology> in <Area>" built by the route. */
export function AreaPage({ ctx, detail, heading, areasPath }: { ctx: SiteContext; detail: AreaDetail; heading: string; areasPath: string }) {
  const { area, content, parent, services, servicesFallback, projects, nearby, media } = detail;
  const terms = siteTerminology(ctx);
  const servicesLabel = termPlural(terms, "service");
  const projectsLabel = termPlural(terms, "project");
  const quoteLabel = terms.quote;
  const quoteHref = siteHref(ctx, `/quote?area=${encodeURIComponent(area.slug)}`);
  const crumbs = [
    { label: "Areas", path: areasPath },
    ...(parent && parent.generatePage ? [{ label: parent.name, path: `/areas/${parent.slug}` }] : []),
    { label: area.name, path: `/areas/${area.slug}` },
  ];
  const intro = content.intro || `${ctx.business.name} provides ${servicesLabel.toLowerCase()} in ${area.name}${area.state ? `, ${area.state}` : ""} and the surrounding area.`;
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: heading,
    url: siteAbsoluteUrl(ctx, `/areas/${area.slug}`),
    provider: { "@id": `${siteAbsoluteUrl(ctx, "/")}#business` },
    areaServed: { "@type": "Place", name: area.name, address: area.state || area.postcode ? { "@type": "PostalAddress", addressLocality: area.name, addressRegion: area.state ?? undefined, postalCode: area.postcode ?? undefined, addressCountry: area.country } : undefined, geo: area.lat != null && area.lng != null ? { "@type": "GeoCoordinates", latitude: Number(area.lat), longitude: Number(area.lng) } : undefined },
    hasOfferCatalog: services.length ? { "@type": "OfferCatalog", name: servicesLabel, itemListElement: services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.name, url: siteAbsoluteUrl(ctx, `/services/${s.slug}`) } })) } : undefined,
  };

  return (
    <article data-edit-entity="area" data-edit-id={area.id}>
      <JsonLd data={placeJsonLd} />
      <JsonLd data={faqJsonLd(content.faqs)} />
      <PageHero
        ctx={ctx}
        crumbs={crumbs}
        eyebrow={area.type === "POSTCODE" ? `Postcode ${area.postcode ?? area.name}` : [area.state, area.postcode].filter(Boolean).join(" ")}
        title={heading}
        intro={intro}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={quoteHref} data-track="cta_click" className="inline-flex items-center rounded-[var(--radius)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--color-accent)" }}>
              Request a {quoteLabel.toLowerCase()} in {area.name}
            </Link>
            {ctx.business.phone && (
              <a href={`tel:${ctx.business.phone.replace(/[^\d+]/g, "")}`} data-track="phone_click" className="text-sm font-medium underline-offset-4 hover:underline" style={{ color: "var(--color-primary)" }}>
                Call {ctx.business.phone}
              </a>
            )}
          </div>
        }
      />

      <div className="site-container grid gap-12 py-12 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-12">
          {content.body && (
            <section>
              <Markdown source={content.body} />
            </section>
          )}

          {content.highlights.length > 0 && (
            <section>
              <SectionTitle>Why choose {ctx.business.name} in {area.name}</SectionTitle>
              <ul className="grid gap-3 sm:grid-cols-2">
                {content.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-[var(--radius)] border p-4 text-sm" style={{ borderColor: "var(--color-border)" }}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} aria-hidden />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle sub={servicesFallback ? `Our full range of ${servicesLabel.toLowerCase()} is available in ${area.name}.` : null}>{servicesLabel} in {area.name}</SectionTitle>
            {services.length > 0 ? <ServiceCards ctx={ctx} services={services} media={media} /> : <p className="text-sm opacity-70">Get in touch to find out what we can do for you in {area.name}.</p>}
          </section>

          {projects.length > 0 && (
            <section>
              <SectionTitle>{projectsLabel} in {area.name}</SectionTitle>
              <ProjectCards ctx={ctx} projects={projects} media={media} />
            </section>
          )}

          {content.faqs.length > 0 && (
            <section>
              <FaqList items={content.faqs} heading={`${area.name} questions`} />
            </section>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)" }}>
            <iframe title={`Map of ${area.name}`} src={areaMapEmbedUrl(area)} loading="lazy" className="aspect-[4/3] w-full border-0" referrerPolicy="no-referrer-when-downgrade" />
            <a href={areaMapLink(area)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-4 py-2 text-xs opacity-75 hover:opacity-100" style={{ background: "var(--color-surface)" }}>
              <span>{[area.name, area.state, area.postcode].filter(Boolean).join(", ")}</span>
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>

          {nearby.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-60">Nearby areas</div>
              <div className="flex flex-wrap gap-2">
                {nearby.map((n) => <Chip key={n.id} href={siteHref(ctx, `/areas/${n.slug}`)}>{n.name}</Chip>)}
              </div>
              <Link href={siteHref(ctx, areasPath)} className="mt-3 inline-block text-xs font-semibold uppercase tracking-wider opacity-70 hover:opacity-100">All areas →</Link>
            </div>
          )}
        </aside>
      </div>

      <CtaBanner ctx={ctx} title={`Need ${servicesLabel.toLowerCase()} in ${area.name}?`} text={`${ctx.business.name} is ready to help. Request a ${quoteLabel.toLowerCase()} and we will be in touch.`} primary={{ label: `Request a ${quoteLabel.toLowerCase()}`, href: quoteHref }} secondary={{ label: `All ${servicesLabel.toLowerCase()}`, href: siteHref(ctx, "/services") }} />
    </article>
  );
}
