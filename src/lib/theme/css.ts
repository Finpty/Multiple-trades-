import type { ThemeTokens } from "./tokens";

const RADIUS: Record<ThemeTokens["radius"], string> = { none: "0px", sm: "4px", md: "8px", lg: "14px", xl: "24px" };
const SPACING: Record<ThemeTokens["spacing"], string> = { compact: "3rem", comfortable: "5rem", spacious: "7rem" };
const ANIMATION: Record<ThemeTokens["animation"], string> = { none: "0ms", subtle: "200ms", medium: "350ms", bold: "600ms" };
const BORDER: Record<ThemeTokens["borderStyle"], string> = { none: "0px", subtle: "1px", strong: "2px" };

/** Tokens → CSS custom properties applied on the site root element. */
export function tokensToCssVariables(tokens: ThemeTokens): Record<string, string> {
  return {
    "--color-primary": tokens.colors.primary,
    "--color-secondary": tokens.colors.secondary,
    "--color-accent": tokens.colors.accent,
    "--color-background": tokens.colors.background,
    "--color-surface": tokens.colors.surface,
    "--color-text": tokens.colors.text,
    "--color-muted": tokens.colors.muted,
    "--color-border": tokens.colors.border,
    "--font-heading": `"${tokens.fonts.heading}", ui-sans-serif, system-ui, sans-serif`,
    "--font-body": `"${tokens.fonts.body}", ui-sans-serif, system-ui, sans-serif`,
    "--font-heading-weight": String(tokens.fonts.headingWeight),
    "--font-body-weight": String(tokens.fonts.bodyWeight),
    "--radius": RADIUS[tokens.radius],
    "--section-spacing": SPACING[tokens.spacing],
    "--motion-duration": ANIMATION[tokens.animation],
    "--border-width": BORDER[tokens.borderStyle],
  };
}

export function tokensToStyleString(tokens: ThemeTokens): string {
  return Object.entries(tokensToCssVariables(tokens))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** Google Fonts stylesheet URL for the theme's fonts (system fonts are skipped). */
export function fontStylesheetUrl(tokens: ThemeTokens): string | null {
  const system = new Set(["Inter", "system-ui", "Arial", "Helvetica", "Georgia", "Times New Roman"]);
  const families = [...new Set([tokens.fonts.heading, tokens.fonts.body])].filter((f) => !system.has(f) || f === "Inter");
  if (families.length === 0) return null;
  const spec = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${spec}&display=swap`;
}
