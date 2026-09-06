import { z } from "zod";

/**
 * Design tokens. A business theme = design family preset + overrides.
 * Rendered to CSS variables by src/lib/theme/css.ts; every block uses the
 * variables, so a theme change restyles the entire site with no code.
 */
export const ThemeTokensSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    muted: z.string(),
    border: z.string(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
    headingWeight: z.number().default(700),
    bodyWeight: z.number().default(400),
  }),
  radius: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
  buttonStyle: z.enum(["solid", "outline", "pill", "ghost"]).default("solid"),
  borderStyle: z.enum(["none", "subtle", "strong"]).default("subtle"),
  imageStyle: z.enum(["natural", "warm", "cinematic", "muted", "duotone"]).default("natural"),
  animation: z.enum(["none", "subtle", "medium", "bold"]).default("subtle"),
  mode: z.enum(["light", "dark"]).default("light"),
  spacing: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  tone: z.enum(["professional", "friendly", "premium", "bold", "technical"]).default("professional"),
  logoMediaId: z.string().nullable().optional(),
  secondaryLogoMediaId: z.string().nullable().optional(),
  iconMediaId: z.string().nullable().optional(),
  faviconMediaId: z.string().nullable().optional(),
  customCss: z.string().max(20_000).optional(),
});

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

export const DEFAULT_THEME_TOKENS: ThemeTokens = ThemeTokensSchema.parse({
  colors: { primary: "#0f172a", secondary: "#334155", accent: "#f59e0b", background: "#ffffff", surface: "#f8fafc", text: "#0f172a", muted: "#64748b", border: "#e2e8f0" },
  fonts: { heading: "Inter", body: "Inter" },
});

export function mergeTokens(base: ThemeTokens, overrides: Partial<ThemeTokens> | null | undefined): ThemeTokens {
  if (!overrides) return base;
  return ThemeTokensSchema.parse({
    ...base,
    ...overrides,
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    fonts: { ...base.fonts, ...(overrides.fonts ?? {}) },
  });
}
