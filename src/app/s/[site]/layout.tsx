import { notFound } from "next/navigation";
import { resolveSiteRequest } from "@/lib/site/context";
import { fontStylesheetUrl, tokensToStyleString } from "@/lib/theme/css";
import { DEFAULT_THEME_TOKENS, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";
import { asObject } from "@/lib/json";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export const dynamic = "force-dynamic";

/**
 * Tenant site shell. Applies the business theme as CSS variables and renders
 * header/footer from the business navigation menus. Nothing here knows which
 * business it is serving beyond the resolved context.
 */
export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const { site } = await params;
  // Search params are not available in layouts; the page decides preview mode.
  const { ctx } = await resolveSiteRequest(site, {});
  const previewCtx = ctx ?? (await resolveSiteRequest(site, { __preview: "draft" })).ctx;
  if (!previewCtx) notFound();
  const theme = previewCtx.theme;
  const tokens: ThemeTokens = mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>((previewCtx.preview ? theme?.draft : theme?.published ?? theme?.draft) ?? null));
  const fonts = fontStylesheetUrl(tokens);
  return (
    <div className="site-root min-h-screen" data-mode={tokens.mode} style={{ cssText: tokensToStyleString(tokens) } as React.CSSProperties}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <style>{`.site-root{${tokensToStyleString(tokens)}} .site-root h1,.site-root h2,.site-root h3,.site-root h4{font-family:var(--font-heading);font-weight:var(--font-heading-weight)} ${tokens.customCss ?? ""}`}</style>
      <SiteHeader ctx={previewCtx} tokens={tokens} />
      <div className="site-content">{children}</div>
      <SiteFooter ctx={previewCtx} tokens={tokens} />
    </div>
  );
}
