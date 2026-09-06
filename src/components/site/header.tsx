import Link from "next/link";
import { ChevronDown, Phone } from "lucide-react";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { asArray } from "@/lib/json";
import { tenantDb } from "@/lib/db";
import type { NavItemSeed } from "@/lib/business/defaults";
import { siteMedia, siteTerminology, termPlural } from "@/lib/site/context";
import { listTopLevelServices } from "@/lib/site/detail";
import { MobileNav, type MobileNavItem } from "./mobile-nav";

/**
 * Navigation item resolved for rendering. Menu rows (NavigationMenu.draft /
 * .published) are NavItemSeed[]; page references become hrefs, "services"
 * items are filled with the published service catalogue, and `mega` turns a
 * services item into a full-width grid with short descriptions.
 */
export interface SiteNavItem {
  id: string;
  label: string;
  href: string;
  kind: "page" | "link" | "services" | "dropdown";
  mega: boolean;
  description?: string | null;
  children: SiteNavItem[];
}

type NavSeed = NavItemSeed & { mega?: boolean; description?: string | null; isCta?: boolean; style?: string };

/** Resolves nav items (page references → hrefs, services → catalogue) for a menu key. */
export async function resolveMenu(ctx: SiteContext, key: string): Promise<SiteNavItem[]> {
  const menu = ctx.menus.find((m) => m.key === key);
  const items = asArray<NavSeed>(ctx.preview ? menu?.draft : (menu?.published ?? menu?.draft));
  const db = tenantDb(ctx.business.id);
  const pages = await db.page.findMany({ where: { businessId: ctx.business.id, status: ctx.preview ? { not: "ARCHIVED" } : "PUBLISHED" }, select: { slug: true, systemKey: true, id: true } });
  const bySystem = new Map(pages.filter((p) => p.systemKey).map((p) => [p.systemKey!, p]));
  const byId = new Map(pages.map((p) => [p.id, p]));
  const needsServices = items.some((it) => it.type === "services");
  const services = needsServices ? await listTopLevelServices(ctx, 12) : [];

  const resolve = (it: NavSeed): SiteNavItem | null => {
    const kind: SiteNavItem["kind"] = it.type === "services" || it.type === "dropdown" || it.type === "link" ? it.type : "page";
    let href: string | null = null;
    if (it.href) href = siteHref(ctx, it.href);
    else {
      const page = (it.pageSystemKey && bySystem.get(it.pageSystemKey)) || ((it as { pageId?: string }).pageId ? byId.get((it as { pageId?: string }).pageId!) : undefined);
      if (page) href = siteHref(ctx, `/${page.slug}`);
      else if (kind === "services") href = siteHref(ctx, "/services");
      else if (kind === "dropdown") href = "#";
    }
    if (!href) return null;
    let children = (it.children ?? []).map(resolve).filter((c): c is SiteNavItem => !!c);
    if (kind === "services" && children.length === 0) {
      children = services.map((s) => ({ id: `svc-${s.id}`, label: s.name, href: siteHref(ctx, `/services/${s.slug}`), kind: "page" as const, mega: false, description: s.shortDescription, children: [] }));
    }
    return { id: it.id, label: it.label, href, kind, mega: !!it.mega, description: it.description ?? null, children };
  };
  return items.map(resolve).filter((x): x is SiteNavItem => !!x);
}

/** The last header item (or one flagged isCta) is rendered as the call-to-action button. */
function splitCta(items: SiteNavItem[], seeds: NavSeed[]): { nav: SiteNavItem[]; cta: SiteNavItem | null } {
  const flagged = seeds.find((s) => s.isCta || s.style === "button");
  if (flagged) {
    const cta = items.find((i) => i.id === flagged.id) ?? null;
    return { nav: items.filter((i) => i.id !== flagged.id), cta };
  }
  if (items.length < 2) return { nav: items, cta: null };
  return { nav: items.slice(0, -1), cta: items[items.length - 1] };
}

function DesktopDropdown({ item }: { item: SiteNavItem }) {
  return (
    <div className="invisible absolute left-0 top-full z-40 min-w-56 translate-y-1 rounded-[var(--radius)] border py-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100" style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}>
      {item.children.map((c) => (
        <Link key={c.id} href={c.href} className="block px-4 py-2 text-sm hover:opacity-70">
          {c.label}
        </Link>
      ))}
      {item.kind === "services" && (
        <Link href={item.href} className="mt-1 block border-t px-4 pt-2 text-xs font-semibold uppercase tracking-wider opacity-70 hover:opacity-100" style={{ borderColor: "var(--color-border)" }}>
          View all
        </Link>
      )}
    </div>
  );
}

function MegaMenu({ item, allLabel }: { item: SiteNavItem; allLabel: string }) {
  return (
    <div className="invisible absolute inset-x-0 top-full z-40 translate-y-1 border-b border-t opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100" style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}>
      <div className="mx-auto grid max-w-6xl gap-2 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
        {item.children.map((c) => (
          <Link key={c.id} href={c.href} className="rounded-[var(--radius)] p-3 transition hover:bg-[var(--color-surface)]">
            <div className="text-sm font-semibold">{c.label}</div>
            {c.description && <p className="mt-1 line-clamp-2 text-xs opacity-70">{c.description}</p>}
          </Link>
        ))}
        <Link href={item.href} className="rounded-[var(--radius)] p-3 text-sm font-semibold transition hover:bg-[var(--color-surface)]" style={{ color: "var(--color-accent)" }}>
          {allLabel} →
        </Link>
      </div>
    </div>
  );
}

export async function SiteHeader({ ctx, tokens }: { ctx: SiteContext; tokens: ThemeTokens }) {
  const menu = ctx.menus.find((m) => m.key === "header");
  const seeds = asArray<NavSeed>(ctx.preview ? menu?.draft : (menu?.published ?? menu?.draft));
  const items = await resolveMenu(ctx, "header");
  const { nav, cta } = splitCta(items, seeds);
  const logo = await siteMedia(ctx, tokens.logoMediaId ?? ctx.business.logoMediaId);
  const terms = siteTerminology(ctx);
  const allServicesLabel = `All ${termPlural(terms, "service").toLowerCase()}`;
  const phone = ctx.business.phone;
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const hasMega = nav.some((it) => it.mega && it.children.length > 0);
  const mobileItems: MobileNavItem[] = nav.map((it) => ({ id: it.id, label: it.label, href: it.href, children: it.children.map((c) => ({ id: c.id, label: c.label, href: c.href })) }));

  return (
    <header className={`site-header sticky top-0 z-30 border-b ${hasMega ? "relative" : ""}`} style={{ background: "color-mix(in srgb, var(--color-background) 92%, transparent)", backdropFilter: "blur(8px)", borderColor: "var(--color-border)", borderBottomWidth: "var(--border-width)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Link href={siteHref(ctx, "/")} className="flex items-center gap-3" aria-label={`${ctx.business.name} home`}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.medium} alt={logo.alt || ctx.business.name} width={logo.width ?? undefined} height={logo.height ?? undefined} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>{ctx.business.name}</span>
          )}
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Main">
          {nav.map((it) => {
            const hasChildren = it.children.length > 0;
            const showMega = it.mega && hasChildren;
            return (
              <div key={it.id} className={`group ${showMega ? "" : "relative"}`}>
                <Link href={it.href} className="inline-flex items-center gap-1 rounded-[var(--radius)] px-3 py-2 transition hover:bg-[var(--color-surface)]" aria-haspopup={hasChildren ? "true" : undefined}>
                  {it.label}
                  {hasChildren && <ChevronDown className="h-3.5 w-3.5 opacity-60 transition group-hover:rotate-180" aria-hidden />}
                </Link>
                {hasChildren && (showMega ? <MegaMenu item={it} allLabel={allServicesLabel} /> : <DesktopDropdown item={it} />)}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {phone && phoneHref && (
            <a href={phoneHref} data-track="phone_click" className="hidden items-center gap-1.5 text-sm font-medium lg:inline-flex" style={{ color: "var(--color-primary)" }}>
              <Phone className="h-4 w-4" aria-hidden />
              {phone}
            </a>
          )}
          {cta && (
            <Link href={cta.href} data-track="cta_click" className="hidden rounded-[var(--radius)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:inline-block" style={{ background: "var(--color-accent)" }}>
              {cta.label}
            </Link>
          )}
          <MobileNav items={mobileItems} cta={cta ? { label: cta.label, href: cta.href } : null} phone={phone && phoneHref ? { label: phone, href: phoneHref } : null} brand={ctx.business.name} logoUrl={logo?.medium ?? null} />
        </div>
      </div>
    </header>
  );
}
