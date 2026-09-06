import Link from "next/link";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { asArray } from "@/lib/json";
import { tenantDb } from "@/lib/db";
import type { NavItemSeed } from "@/lib/business/defaults";

/** Resolves nav items (page references → hrefs) for a menu key. */
export async function resolveMenu(ctx: SiteContext, key: string): Promise<Array<{ id: string; label: string; href: string; children: Array<{ id: string; label: string; href: string }> }>> {
  const menu = ctx.menus.find((m) => m.key === key);
  const items = asArray<NavItemSeed>(ctx.preview ? menu?.draft : menu?.published ?? menu?.draft);
  const db = tenantDb(ctx.business.id);
  const pages = await db.page.findMany({ where: { businessId: ctx.business.id, status: ctx.preview ? { not: "ARCHIVED" } : "PUBLISHED" }, select: { slug: true, systemKey: true, id: true } });
  const bySystem = new Map(pages.filter((p) => p.systemKey).map((p) => [p.systemKey!, p]));
  const byId = new Map(pages.map((p) => [p.id, p]));
  const resolve = (it: NavItemSeed): { id: string; label: string; href: string } | null => {
    if (it.href) return { id: it.id, label: it.label, href: siteHref(ctx, it.href) };
    const page = (it.pageSystemKey && bySystem.get(it.pageSystemKey)) || ((it as { pageId?: string }).pageId ? byId.get((it as { pageId?: string }).pageId!) : undefined);
    if (!page) return null;
    return { id: it.id, label: it.label, href: siteHref(ctx, `/${page.slug}`) };
  };
  return items
    .map((it) => {
      const top = resolve(it);
      if (!top) return null;
      const children = (it.children ?? []).map(resolve).filter((c): c is { id: string; label: string; href: string } => !!c);
      return { ...top, children };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

export async function SiteHeader({ ctx }: { ctx: SiteContext; tokens: ThemeTokens }) {
  const items = await resolveMenu(ctx, "header");
  const cta = items[items.length - 1];
  const nav = items.slice(0, -1);
  return (
    <header className="sticky top-0 z-30 border-b" style={{ background: "var(--color-background)", borderColor: "var(--color-border)", borderBottomWidth: "var(--border-width)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href={siteHref(ctx, "/")} className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>
          {ctx.business.name}
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {nav.map((it) => (
            <div key={it.id} className="group relative">
              <Link href={it.href} className="hover:opacity-70">{it.label}</Link>
              {it.children.length > 0 && (
                <div className="invisible absolute left-0 top-full z-40 min-w-48 rounded-md border py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100" style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}>
                  {it.children.map((c) => (
                    <Link key={c.id} href={c.href} className="block px-4 py-1.5 text-sm hover:opacity-70">{c.label}</Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {ctx.business.phone && <a href={`tel:${ctx.business.phone.replace(/\s+/g, "")}`} className="hidden text-sm sm:inline">{ctx.business.phone}</a>}
          {cta && (
            <Link href={cta.href} className="rounded-[var(--radius)] px-4 py-2 text-sm font-medium" style={{ background: "var(--color-accent)", color: "#fff" }}>
              {cta.label}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
