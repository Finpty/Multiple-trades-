import Link from "next/link";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { resolveMenu } from "./header";

export async function SiteFooter({ ctx }: { ctx: SiteContext; tokens: ThemeTokens }) {
  const items = await resolveMenu(ctx, "footer");
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3">
        <div>
          <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>{ctx.business.name}</div>
          {ctx.business.tagline && <p className="mt-2 text-sm opacity-80">{ctx.business.tagline}</p>}
          {ctx.business.businessNumber && <p className="mt-2 text-xs opacity-60">ABN {ctx.business.businessNumber}</p>}
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Explore</div>
          <ul className="space-y-1.5 text-sm">
            {items.map((it) => (
              <li key={it.id}><Link href={it.href} className="hover:opacity-70">{it.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Contact</div>
          <ul className="space-y-1.5 text-sm">
            {ctx.business.phone && <li><a href={`tel:${ctx.business.phone.replace(/\s+/g, "")}`}>{ctx.business.phone}</a></li>}
            {ctx.business.email && <li><a href={`mailto:${ctx.business.email}`}>{ctx.business.email}</a></li>}
            {ctx.business.serviceAreaText && <li className="opacity-80">{ctx.business.serviceAreaText}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t px-6 py-4 text-center text-xs opacity-60" style={{ borderColor: "var(--color-border)" }}>
        © {year} {ctx.business.legalName ?? ctx.business.name}. All rights reserved.
      </div>
    </footer>
  );
}
