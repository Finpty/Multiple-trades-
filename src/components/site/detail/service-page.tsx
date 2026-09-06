import Link from "next/link";
import { Star } from "lucide-react";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import { siteAbsoluteUrl, siteTerminology, termPlural } from "@/lib/site/context";
import type { ServiceDetail } from "@/lib/site/detail";
import { plainText } from "@/lib/site/detail";
import { syntheticPage } from "@/lib/site/pages";
import { faqJsonLd } from "@/lib/site/seo";
import { SectionRenderer } from "../section-renderer";
import { JsonLd } from "./json-ld";
import { Markdown } from "./markdown";
import { FaqList } from "./faq-list";
import { MediaGrid, SiteVideo } from "./media-grid";
import { Chip, CtaBanner, PageHero, ProjectCards, SectionTitle, ServiceCards } from "./shared";

/** Full service detail page: hero, body, pricing, gallery, FAQs, children, projects, areas, materials, quote form. */
export async function ServicePage({ ctx, detail }: { ctx: SiteContext; detail: ServiceDetail }) {
  const { service, parent, children, projects, areas, materials, reviews, faqs, media, gallery, price, quoteFormSlug } = detail;
  const terms = siteTerminology(ctx);
  const servicesLabel = termPlural(terms, "service");
  const projectsLabel = termPlural(terms, "project");
  const quoteLabel = terms.quote;
  const featured = service.featuredMediaId ? media[service.featuredMediaId] ?? null : null;
  const video = service.videoMediaId ? media[service.videoMediaId] ?? null : null;
  const galleryItems = gallery.map((id) => media[id]).filter((m): m is NonNullable<typeof m> => !!m && m.id !== featured?.id).map((m) => ({ media: m }));
  const quoteHref = service.ctaHref ? (/^(https?:)?\/\//i.test(service.ctaHref) ? service.ctaHref : siteHref(ctx, service.ctaHref)) : siteHref(ctx, `/quote?service=${encodeURIComponent(service.slug)}`);
  const ctaLabel = service.ctaLabel || `Request a ${quoteLabel.toLowerCase()}`;
  const crumbs = [{ label: servicesLabel, path: "/services" }, ...(parent ? [{ label: parent.name, path: `/services/${parent.slug}` }] : []), { label: service.name, path: `/services/${service.slug}` }];
  const pageAreas = areas.filter((a) => a.generatePage);
  const avg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null;

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.shortDescription ?? plainText(service.description, 300) ?? undefined,
    serviceType: service.name,
    url: siteAbsoluteUrl(ctx, `/services/${service.slug}`),
    image: featured?.large,
    provider: { "@id": `${siteAbsoluteUrl(ctx, "/")}#business` },
    areaServed: areas.length ? areas.map((a) => ({ "@type": "Place", name: a.name })) : undefined,
    offers: service.priceMinCents != null || service.priceMaxCents != null
      ? { "@type": "Offer", priceCurrency: ctx.business.currency, price: service.priceMinCents != null ? (service.priceMinCents / 100).toFixed(2) : undefined, priceSpecification: service.priceMaxCents != null ? { "@type": "PriceSpecification", minPrice: service.priceMinCents != null ? service.priceMinCents / 100 : undefined, maxPrice: service.priceMaxCents / 100, priceCurrency: ctx.business.currency, unitText: price.unit ?? undefined } : undefined }
      : undefined,
    aggregateRating: avg != null ? { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: reviews.length } : undefined,
  };

  const quotePage = quoteFormSlug ? syntheticPage(ctx, `service-quote-${service.id}`, service.name, [{ type: "quote_form", props: { heading: `${quoteLabel} for ${service.name.toLowerCase()}`, intro: `Tell us about your ${service.name.toLowerCase()} needs and we will get back to you.`, formSlug: quoteFormSlug, showServices: true }, settings: { background: "surface", anchor: "quote" } }]) : null;

  return (
    <article data-edit-entity="service" data-edit-id={service.id}>
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd(faqs)} />
      <PageHero
        ctx={ctx}
        crumbs={crumbs}
        eyebrow={parent ? parent.name : terms.service}
        title={service.name}
        intro={service.shortDescription}
        image={featured}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={quoteHref} data-track="cta_click" className="inline-flex items-center rounded-[var(--radius)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--color-accent)" }}>
              {ctaLabel}
            </Link>
            <div className="text-sm">
              <div className="font-semibold">{price.range ?? price.method}</div>
              {price.range && <div className="text-xs opacity-70">{price.method} · {price.currency}</div>}
            </div>
            {service.status !== "PUBLISHED" && <span className="rounded-full border border-dashed px-2 py-0.5 text-xs uppercase tracking-wider opacity-70">Draft preview</span>}
          </div>
        }
      />

      <div className="site-container grid gap-12 py-12 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-12">
          {service.description && (
            <section>
              <Markdown source={service.description} className="text-base" />
            </section>
          )}

          {video && (
            <section>
              <SectionTitle>Watch</SectionTitle>
              <SiteVideo media={video} poster={featured} />
            </section>
          )}

          {galleryItems.length > 0 && (
            <section>
              <SectionTitle>Gallery</SectionTitle>
              <MediaGrid items={galleryItems} />
            </section>
          )}

          {children.length > 0 && (
            <section>
              <SectionTitle sub={`Specialised ${servicesLabel.toLowerCase()} within ${service.name.toLowerCase()}`}>Related {servicesLabel.toLowerCase()}</SectionTitle>
              <ServiceCards ctx={ctx} services={children} media={media} />
            </section>
          )}

          {faqs.length > 0 && (
            <section>
              <FaqList items={faqs} heading="Frequently asked questions" />
            </section>
          )}

          {projects.length > 0 && (
            <section>
              <SectionTitle>Recent {projectsLabel.toLowerCase()}</SectionTitle>
              <ProjectCards ctx={ctx} projects={projects} media={media} />
            </section>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius)] border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-60">Pricing</div>
            <div className="mt-2 text-xl font-semibold">{price.range ?? price.method}</div>
            <p className="mt-1 text-sm opacity-70">{price.range ? `${price.method}. ` : ""}Final pricing depends on the scope of your job.</p>
            <Link href={quoteHref} data-track="cta_click" className="mt-4 block rounded-[var(--radius)] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90" style={{ background: "var(--color-accent)" }}>
              {ctaLabel}
            </Link>
          </div>

          {avg != null && (
            <div className="rounded-[var(--radius)] border p-5" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-2">
                <span className="inline-flex" aria-label={`${avg.toFixed(1)} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className="h-4 w-4" style={{ color: "var(--color-accent)", fill: n <= Math.round(avg) ? "var(--color-accent)" : "transparent" }} aria-hidden />)}
                </span>
                <span className="text-sm font-medium">{avg.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}</span>
              </div>
              {reviews[0] && (
                <blockquote className="mt-3 text-sm italic opacity-85">
                  “{plainText(reviews[0].body, 220)}”
                  <footer className="mt-1 not-italic opacity-70">— {reviews[0].authorName}</footer>
                </blockquote>
              )}
            </div>
          )}

          {areas.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-60">Areas we service</div>
              <div className="flex flex-wrap gap-2">
                {areas.map((a) => <Chip key={a.id} href={pageAreas.some((p) => p.id === a.id) ? siteHref(ctx, `/areas/${a.slug}`) : null}>{a.name}</Chip>)}
              </div>
            </div>
          )}

          {materials.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-60">Materials we work with</div>
              <ul className="space-y-2">
                {materials.map((m) => {
                  const img = m.mediaId ? media[m.mediaId] : null;
                  return (
                    <li key={m.id} className="flex items-center gap-3 text-sm">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.thumb} alt={img.alt || m.name} className="h-9 w-9 rounded object-cover" loading="lazy" />
                      ) : (
                        <span className="h-9 w-9 rounded" style={{ background: "var(--color-surface)" }} />
                      )}
                      <div>
                        <div className="font-medium">{m.name}</div>
                        {(m.category || m.description) && <div className="text-xs opacity-70">{m.category ?? plainText(m.description, 80)}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {quotePage ? <SectionRenderer page={quotePage} ctx={ctx} editor={false} /> : null}

      <CtaBanner ctx={ctx} title={`Ready to talk about ${service.name.toLowerCase()}?`} text={`Get a free, no-obligation ${quoteLabel.toLowerCase()} from ${ctx.business.name}.`} primary={{ label: ctaLabel, href: quoteHref }} secondary={{ label: `All ${servicesLabel.toLowerCase()}`, href: siteHref(ctx, "/services") }} />
    </article>
  );
}
