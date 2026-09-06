import Link from "next/link";
import { Globe, MapPin } from "lucide-react";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { tenantDb } from "@/lib/db";
import { getPlatformSetting } from "@/lib/platform/settings";
import { siteMedia, siteTerminology, termPlural } from "@/lib/site/context";
import { listTopLevelServices } from "@/lib/site/detail";
import { listAreaPages } from "@/lib/site/areas";
import { loadPrimaryLocation, normaliseOpeningHours, socialLinks } from "@/lib/site/seo";
import { resolveMenu } from "./header";


function socialLabel(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export async function SiteFooter({ ctx, tokens }: { ctx: SiteContext; tokens: ThemeTokens }) {
  const terms = siteTerminology(ctx);
  const [items, services, areas, location, logo, showPoweredBy, platformName] = await Promise.all([
    resolveMenu(ctx, "footer"),
    listTopLevelServices(ctx, 8),
    listAreaPages(ctx),
    loadPrimaryLocation(ctx),
    siteMedia(ctx, tokens.secondaryLogoMediaId ?? tokens.logoMediaId ?? ctx.business.logoMediaId),
    getPlatformSetting<boolean>("platform.showPoweredBy", false),
    getPlatformSetting<string>("platform.name", "TRADE ONE"),
  ]);
  const areaLinks = areas.slice(0, 12);
  const social = socialLinks(ctx);
  const hours = normaliseOpeningHours(location?.openingHours);
  const year = new Date().getFullYear();
  const phone = location?.phone ?? ctx.business.phone;
  const email = location?.email ?? ctx.business.email;
  const address = location ? [location.addressLine1, location.addressLine2, [location.city, location.state, location.postcode].filter(Boolean).join(" ")].filter(Boolean) : [];
  const servicesLabel = termPlural(terms, "service");
  const areasPage = await tenantDb(ctx.business.id).page.findFirst({ where: { businessId: ctx.business.id, systemKey: "areas", status: "PUBLISHED" }, select: { slug: true } });
  const columns = 2 + (services.length ? 1 : 0) + (areaLinks.length ? 1 : 0);

  return (
    <footer className="mt-auto border-t" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className={`mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 ${columns >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <div>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.medium} alt={logo.alt || ctx.business.name} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>{ctx.business.name}</div>
          )}
          {ctx.business.tagline && <p className="mt-3 text-sm opacity-80">{ctx.business.tagline}</p>}
          {ctx.business.businessNumber && <p className="mt-3 text-xs opacity-60">ABN {ctx.business.businessNumber}</p>}
          {social.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Social links">
              {social.map((s) => {
                return (
                  <li key={s.key}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={socialLabel(s.key)} title={socialLabel(s.key)} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:opacity-70" style={{ borderColor: "var(--color-border)" }}>
                      <Globe className="h-3.5 w-3.5" aria-hidden />
                      {socialLabel(s.key)}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 0 && (
            <ul className="mt-6 space-y-1.5 text-sm">
              {items.map((it) => (
                <li key={it.id}>
                  <Link href={it.href} className="hover:opacity-70">{it.label}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {services.length > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">{servicesLabel}</div>
            <ul className="space-y-1.5 text-sm">
              {services.map((s) => (
                <li key={s.id}>
                  <Link href={siteHref(ctx, `/services/${s.slug}`)} className="hover:opacity-70">{s.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {areaLinks.length > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Areas we service</div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {areaLinks.map((a) => (
                <li key={a.id}>
                  <Link href={siteHref(ctx, `/areas/${a.slug}`)} className="hover:opacity-70">{a.name}</Link>
                </li>
              ))}
            </ul>
            {areas.length > areaLinks.length && areasPage && (
              <Link href={siteHref(ctx, `/${areasPage.slug}`)} className="mt-3 inline-block text-xs font-semibold uppercase tracking-wider opacity-70 hover:opacity-100">All areas →</Link>
            )}
          </div>
        )}

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Contact</div>
          <ul className="space-y-1.5 text-sm">
            {phone && <li><a href={`tel:${phone.replace(/[^\d+]/g, "")}`} data-track="phone_click" className="hover:opacity-70">{phone}</a></li>}
            {email && <li><a href={`mailto:${email}`} className="hover:opacity-70">{email}</a></li>}
            {address.length > 0 && (
              <li className="flex gap-2 opacity-80">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <address className="not-italic">{address.map((line, i) => <span key={i} className="block">{line}</span>)}</address>
              </li>
            )}
            {!address.length && ctx.business.serviceAreaText && <li className="opacity-80">{ctx.business.serviceAreaText}</li>}
          </ul>
          {hours.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-60">Opening hours</div>
              <dl className="space-y-1 text-sm">
                {hours.map((h, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <dt className="opacity-80">{h.label}</dt>
                    <dd>{h.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
      <div className="border-t px-6 py-4 text-center text-xs opacity-60" style={{ borderColor: "var(--color-border)" }}>
        <span>© {year} {ctx.business.legalName ?? ctx.business.name}. All rights reserved.</span>
        {showPoweredBy && <span className="ml-2">Powered by {platformName}</span>}
      </div>
    </footer>
  );
}
