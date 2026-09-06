import { asObject } from "@/lib/json";
import type { SiteContext } from "@/lib/tenant/resolve";
import { DEFAULT_THEME_TOKENS, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";

/**
 * Resolved design tokens for a site request. Mirrors the layout's merge so
 * blocks can read non-CSS-variable tokens (button style, image treatment)
 * without a second theme query.
 */
export function siteTokens(ctx: SiteContext): ThemeTokens {
  const theme = ctx.theme;
  const source = (ctx.preview ? theme?.draft : (theme?.published ?? theme?.draft)) ?? null;
  return mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>(source));
}
