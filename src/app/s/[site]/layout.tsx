import { notFound } from "next/navigation";
import { resolveSiteLayout, siteFeatureEnabled, siteTokens } from "@/lib/site/context";
import { headSnippetTags, localBusinessJsonLd } from "@/lib/site/seo";
import { fontStylesheetUrl, tokensToStyleString } from "@/lib/theme/css";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { SiteAnalytics } from "@/components/site/analytics";
import { JsonLd } from "@/components/site/detail/json-ld";
import { OVERLAY_ROOT_ID } from "@/components/site/mobile-nav";

export const dynamic = "force-dynamic";

/**
 * Site-only utility CSS (container widths, reveal motion). Lives here rather
 * than in globals.css so the tenant site never depends on admin styling.
 * Reveal is CSS-only and respects prefers-reduced-motion.
 */
const SITE_CSS = `
.site-root h1,.site-root h2,.site-root h3,.site-root h4{font-family:var(--font-heading);font-weight:var(--font-heading-weight)}
.site-container{width:100%;max-width:72rem;margin-left:auto;margin-right:auto;padding-left:1.5rem;padding-right:1.5rem}
.site-container-narrow{max-width:48rem}
.site-container-wide{max-width:88rem}
@keyframes site-reveal{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.site-reveal{animation:site-reveal .7s cubic-bezier(.22,1,.36,1) both}
@supports (animation-timeline: view()){.site-reveal{animation-timeline:view();animation-range:entry 0% entry 25%}}
@media (prefers-reduced-motion: reduce){.site-reveal{animation:none;opacity:1;transform:none}}
[data-animation="none"] .site-reveal{animation:none;opacity:1;transform:none}
`;

/**
 * Tenant site shell. Applies the business theme as CSS variables, renders
 * header/footer from navigation rows, emits LocalBusiness structured data and
 * owner-supplied (sanitised) head tags, and mounts the analytics beacon.
 * Nothing here knows which business it serves beyond the resolved context.
 */
export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const { site } = await params;
  const ctx = await resolveSiteLayout(site);
  if (!ctx) notFound();
  const tokens = siteTokens(ctx);
  const fonts = fontStylesheetUrl(tokens);
  const [jsonLd, analyticsOn] = await Promise.all([localBusinessJsonLd(ctx), siteFeatureEnabled(ctx, "analytics")]);
  const headTags = headSnippetTags(ctx);

  return (
    <div className="site-root flex min-h-screen flex-col" data-mode={tokens.mode} data-animation={tokens.animation} style={{ cssText: tokensToStyleString(tokens) } as React.CSSProperties}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      {headTags.map((t, i) => (t.tag === "meta" ? <meta key={`h${i}`} {...t.attrs} /> : <link key={`h${i}`} {...t.attrs} />))}
      <style>{`.site-root{${tokensToStyleString(tokens)};background:var(--color-background);color:var(--color-text);font-family:var(--font-body)}${SITE_CSS}${tokens.customCss ?? ""}`}</style>
      <JsonLd data={jsonLd} />
      <SiteHeader ctx={ctx} tokens={tokens} />
      <div className="site-content flex-1">{children}</div>
      <SiteFooter ctx={ctx} tokens={tokens} />
      <div id={OVERLAY_ROOT_ID} />
      {!ctx.preview && <SiteAnalytics businessId={ctx.business.id} enabled={analyticsOn} />}
    </div>
  );
}
