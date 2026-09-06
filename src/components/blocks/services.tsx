import Link from "next/link";
import { siteHref } from "@/lib/tenant/resolve";
import { siteTerminology, termPlural } from "@/lib/site/context";
import { loadServicesForBlock, type SiteServiceCard } from "@/lib/site/blocks/services";
import { Container, IconBadge, Price, SectionHeading, SiteCard, SiteIcon, SmartImage } from "@/components/site/primitives";
import { blockEnv, defineBlock, type BlockEnv, type TypedBlockProps } from "./define";

function Children({ ctx, service }: { ctx: TypedBlockProps<"services">["ctx"]; service: SiteServiceCard }) {
  if (service.children.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {service.children.map((c) => (
        <li key={c.id}>
          <Link href={siteHref(ctx, c.href)} className="inline-block rounded-full px-3 py-1 text-xs font-medium transition hover:opacity-80" style={{ background: "var(--color-surface)", border: "var(--border-width) solid var(--color-border)" }}>
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ServiceCardView({ ctx, service, env, showPricing, layout }: { ctx: TypedBlockProps<"services">["ctx"]; service: SiteServiceCard; env: BlockEnv; showPricing: boolean; layout: "grid" | "cards" }) {
  const href = siteHref(ctx, service.href);
  return (
    <SiteCard padded={false} interactive className="h-full">
      {layout === "cards" && (
        <Link href={href} tabIndex={-1} aria-hidden="true">
          <SmartImage image={service.image} aspect="3/2" imageStyle={env.tokens.imageStyle} rounded={false} sizes="(min-width: 1024px) 33vw, 100vw" fallback={<div className="flex items-center justify-center" style={{ aspectRatio: "3 / 2", background: "var(--color-surface)", color: "var(--color-primary)" }}><SiteIcon name={service.icon ?? "wrench"} size={40} strokeWidth={1.4} fallback={<span className="text-4xl">{service.name.slice(0, 1)}</span>} /></div>} />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-6">
        {layout === "grid" && <IconBadge name={service.icon ?? "wrench"} fallback={<span>{service.name.slice(0, 1)}</span>} tone="accent" />}
        <h3 className={["text-xl leading-snug", layout === "grid" ? "mt-4" : ""].join(" ")} style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }}>
          <Link href={href} className="hover:underline underline-offset-4">{service.name}</Link>
        </h3>
        {service.shortDescription && <p className="mt-2 text-sm leading-relaxed opacity-80">{service.shortDescription}</p>}
        <Children ctx={ctx} service={service} />
        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          {showPricing ? <Price label={service.priceLabel} method={service.pricingMethodLabel} size="sm" /> : <span />}
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
            {service.ctaLabel || "Learn more"}
            <SiteIcon name="arrow-right" size={16} />
          </Link>
        </div>
      </div>
    </SiteCard>
  );
}

/**
 * Services from the catalogue. grid = icon cards, cards = image cards,
 * list = rows with thumbnail and price. Children render inside their parent.
 */
async function ServicesBlock({ props, ctx, settings, editor }: TypedBlockProps<"services">) {
  const env = blockEnv(ctx, settings, "normal");
  const terms = siteTerminology(ctx);
  const services = await loadServicesForBlock(ctx, { source: props.source ?? "all", serviceIds: props.serviceIds, limit: props.limit ?? 12 });
  if (services.length === 0 && !editor) return null;
  const layout = props.layout ?? "grid";
  const cols = services.length === 1 ? "sm:grid-cols-1 max-w-md" : services.length === 2 ? "sm:grid-cols-2" : services.length === 4 || services.length > 6 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} className="mb-10" />
      {services.length === 0 ? (
        <p className="text-sm opacity-60">No published {termPlural(terms, "service").toLowerCase()} match this block yet.</p>
      ) : layout === "list" ? (
        <ul className="divide-y" style={{ borderTop: "var(--border-width) solid var(--color-border)", borderColor: "var(--color-border)" }}>
          {services.map((s) => (
            <li key={s.id} className="py-5">
              <div className="flex items-start gap-5">
                <SmartImage image={s.image} aspect="1/1" imageStyle={env.tokens.imageStyle} className="w-20 shrink-0 sm:w-28" sizes="112px" fallback={<span className="flex h-20 w-20 shrink-0 items-center justify-center sm:h-28 sm:w-28" style={{ background: "var(--color-surface)", borderRadius: "var(--radius)", color: "var(--color-primary)" }}><SiteIcon name={s.icon ?? "wrench"} size={28} fallback={<span className="text-2xl">{s.name.slice(0, 1)}</span>} /></span>} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }}>
                      <Link href={siteHref(ctx, s.href)} className="hover:underline underline-offset-4">{s.name}</Link>
                    </h3>
                    {props.showPricing && <Price label={s.priceLabel} method={s.pricingMethodLabel} size="sm" align="right" />}
                  </div>
                  {s.shortDescription && <p className="mt-1 text-sm leading-relaxed opacity-80">{s.shortDescription}</p>}
                  <Children ctx={ctx} service={s} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`grid grid-cols-1 gap-6 ${cols}`}>
          {services.map((s) => (
            <li key={s.id}>
              <ServiceCardView ctx={ctx} service={s} env={env} showPricing={props.showPricing ?? false} layout={layout} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

defineBlock("services", ServicesBlock);
