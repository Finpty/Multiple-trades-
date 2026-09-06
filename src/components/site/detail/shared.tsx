import Link from "next/link";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import type { MediaUrlSet } from "@/lib/media/service";
import { priceDisplay, type ProjectCard, type ServiceCard } from "@/lib/site/detail";
import { Breadcrumbs, type Crumb } from "../breadcrumbs";

/** Shared, theme-driven building blocks for the service / project / area pages. */

export function PageHero({ ctx, crumbs, eyebrow, title, intro, image, aside }: { ctx: SiteContext; crumbs: Crumb[]; eyebrow?: string | null; title: string; intro?: string | null; image?: MediaUrlSet | null; aside?: React.ReactNode }) {
  return (
    <header className="border-b" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="site-container grid gap-8 py-12 md:py-16 lg:grid-cols-[3fr_2fr] lg:items-center">
        <div>
          <Breadcrumbs ctx={ctx} crumbs={crumbs} className="mb-5" />
          {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>{eyebrow}</div>}
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl" style={{ color: "var(--color-primary)" }}>{title}</h1>
          {intro && <p className="mt-4 max-w-2xl text-lg opacity-85">{intro}</p>}
          {aside && <div className="mt-6">{aside}</div>}
        </div>
        {image && (
          <div className="overflow-hidden rounded-[var(--radius)] border shadow-sm" style={{ borderColor: "var(--color-border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.large} alt={image.alt || title} width={image.width ?? undefined} height={image.height ?? undefined} className="aspect-[4/3] w-full object-cover" />
          </div>
        )}
      </div>
    </header>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string | null }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold md:text-3xl">{children}</h2>
      {sub && <p className="mt-1 text-sm opacity-70">{sub}</p>}
    </div>
  );
}

export function ServiceCards({ ctx, services, media }: { ctx: SiteContext; services: ServiceCard[]; media: Record<string, MediaUrlSet> }) {
  if (!services.length) return null;
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => {
        const img = s.featuredMediaId ? media[s.featuredMediaId] : null;
        const price = priceDisplay(s, ctx.business.currency, ctx.business.locale);
        return (
          <li key={s.id} className="group overflow-hidden rounded-[var(--radius)] border transition hover:shadow-md" style={{ borderColor: "var(--color-border)", background: "var(--color-background)" }}>
            <Link href={siteHref(ctx, `/services/${s.slug}`)} className="block">
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.medium} alt={img.alt || s.name} loading="lazy" className="aspect-[16/10] w-full object-cover transition group-hover:scale-[1.02]" />
              )}
              <div className="p-5">
                <h3 className="text-lg font-semibold">{s.name}</h3>
                {s.shortDescription && <p className="mt-1 line-clamp-3 text-sm opacity-75">{s.shortDescription}</p>}
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="opacity-70">{price.range ?? price.method}</span>
                  <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--color-accent)" }}>
                    Details <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function formatDate(date: Date | string | null | undefined, locale: string): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(d);
}

export function ProjectCards({ ctx, projects, media }: { ctx: SiteContext; projects: ProjectCard[]; media: Record<string, MediaUrlSet> }) {
  if (!projects.length) return null;
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => {
        const img = p.featuredMediaId ? media[p.featuredMediaId] : null;
        const when = formatDate(p.completionDate, ctx.business.locale);
        return (
          <li key={p.id} className="group overflow-hidden rounded-[var(--radius)] border transition hover:shadow-md" style={{ borderColor: "var(--color-border)", background: "var(--color-background)" }}>
            <Link href={siteHref(ctx, `/projects/${p.slug}`)} className="block">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.medium} alt={img.alt || p.title} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
              ) : (
                <div className="aspect-[4/3] w-full" style={{ background: "var(--color-surface)" }} />
              )}
              <div className="p-5">
                <h3 className="text-lg font-semibold">{p.title}</h3>
                {p.summary && <p className="mt-1 line-clamp-2 text-sm opacity-75">{p.summary}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-70">
                  {p.locationText && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{p.locationText}</span>}
                  {when && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" aria-hidden />{when}</span>}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function CtaBanner({ ctx, title, text, primary, secondary }: { ctx: SiteContext; title: string; text?: string | null; primary: { label: string; href: string }; secondary?: { label: string; href: string } | null }) {
  const phone = ctx.business.phone;
  return (
    <section className="site-container py-12">
      <div className="rounded-[var(--radius)] px-6 py-10 text-center md:px-12" style={{ background: "var(--color-primary)", color: "var(--color-background)" }}>
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        {text && <p className="mx-auto mt-3 max-w-2xl opacity-85">{text}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href={primary.href} data-track="cta_click" className="inline-flex items-center gap-2 rounded-[var(--radius)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--color-accent)" }}>
            {primary.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {secondary && (
            <Link href={secondary.href} className="inline-flex items-center rounded-[var(--radius)] border border-current px-5 py-2.5 text-sm font-semibold transition hover:opacity-80">
              {secondary.label}
            </Link>
          )}
          {phone && (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} data-track="phone_click" className="inline-flex items-center rounded-[var(--radius)] px-5 py-2.5 text-sm font-semibold underline-offset-4 hover:underline">
              Call {phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export function Chip({ href, children }: { href?: string | null; children: React.ReactNode }) {
  const cls = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium";
  const style = { borderColor: "var(--color-border)", background: "var(--color-surface)" };
  return href ? <Link href={href} className={`${cls} hover:opacity-70`} style={style}>{children}</Link> : <span className={cls} style={style}>{children}</span>;
}

export function DlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
      <dt className="opacity-70">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
