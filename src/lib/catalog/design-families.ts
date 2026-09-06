import type { ThemeTokens } from "@/lib/theme/tokens";

export interface DesignFamilySeed {
  slug: string;
  name: string;
  description: string;
  tokens: ThemeTokens;
}

const base: ThemeTokens = {
  colors: { primary: "#0f172a", secondary: "#334155", accent: "#f59e0b", background: "#ffffff", surface: "#f8fafc", text: "#0f172a", muted: "#64748b", border: "#e2e8f0" },
  fonts: { heading: "Inter", body: "Inter", headingWeight: 700, bodyWeight: 400 },
  radius: "md",
  buttonStyle: "solid",
  borderStyle: "subtle",
  imageStyle: "natural",
  animation: "subtle",
  mode: "light",
  spacing: "comfortable",
  tone: "professional",
};

export const DESIGN_FAMILIES: DesignFamilySeed[] = [
  { slug: "architectural", name: "Architectural", description: "Structured grids, generous whitespace, confident typography.", tokens: { ...base, fonts: { heading: "Space Grotesk", body: "Inter", headingWeight: 600, bodyWeight: 400 }, radius: "none", borderStyle: "strong", spacing: "spacious" } },
  { slug: "minimal-luxury", name: "Minimal Luxury", description: "Quiet palette, serif headings, refined details.", tokens: { ...base, colors: { ...base.colors, primary: "#1c1917", secondary: "#44403c", accent: "#b08968", surface: "#fafaf9", border: "#e7e5e4" }, fonts: { heading: "Playfair Display", body: "Inter", headingWeight: 500, bodyWeight: 400 }, radius: "sm", buttonStyle: "outline", spacing: "spacious" } },
  { slug: "cinematic", name: "Cinematic", description: "Full-bleed imagery, dark surfaces, dramatic motion.", tokens: { ...base, colors: { primary: "#f5f5f5", secondary: "#a3a3a3", accent: "#ef4444", background: "#0a0a0a", surface: "#171717", text: "#fafafa", muted: "#a3a3a3", border: "#262626" }, mode: "dark", animation: "bold", imageStyle: "cinematic", radius: "sm" } },
  { slug: "editorial", name: "Editorial", description: "Magazine rhythm, strong headlines, columns.", tokens: { ...base, fonts: { heading: "Libre Baskerville", body: "Source Sans 3", headingWeight: 700, bodyWeight: 400 }, colors: { ...base.colors, accent: "#dc2626" }, radius: "none", borderStyle: "strong" } },
  { slug: "industrial", name: "Industrial", description: "Utility, bold contrast, hard edges, safety colours.", tokens: { ...base, colors: { primary: "#111827", secondary: "#374151", accent: "#facc15", background: "#ffffff", surface: "#f3f4f6", text: "#111827", muted: "#6b7280", border: "#d1d5db" }, fonts: { heading: "Oswald", body: "Inter", headingWeight: 600, bodyWeight: 400 }, radius: "none", borderStyle: "strong", buttonStyle: "solid" } },
  { slug: "modern-tech", name: "Modern Tech", description: "Gradients, rounded surfaces, crisp sans-serif.", tokens: { ...base, colors: { ...base.colors, primary: "#2563eb", secondary: "#1e40af", accent: "#06b6d4", surface: "#f1f5f9" }, radius: "xl", buttonStyle: "pill", animation: "medium" } },
  { slug: "natural", name: "Natural", description: "Earthy tones, soft corners, warm photography.", tokens: { ...base, colors: { primary: "#365314", secondary: "#4d7c0f", accent: "#d97706", background: "#fffdf7", surface: "#f7f3e8", text: "#1c1917", muted: "#78716c", border: "#e7e5e4" }, fonts: { heading: "Fraunces", body: "Inter", headingWeight: 600, bodyWeight: 400 }, radius: "lg", imageStyle: "warm" } },
  { slug: "high-contrast", name: "High Contrast", description: "Black and white with one signal colour. Maximum legibility.", tokens: { ...base, colors: { primary: "#000000", secondary: "#262626", accent: "#ff3b00", background: "#ffffff", surface: "#ffffff", text: "#000000", muted: "#525252", border: "#000000" }, fonts: { heading: "Archivo Black", body: "Inter", headingWeight: 900, bodyWeight: 400 }, radius: "none", borderStyle: "strong", animation: "none" } },
  { slug: "dark-luxury", name: "Dark Luxury", description: "Charcoal and gold, serif headings, slow reveals.", tokens: { ...base, colors: { primary: "#f5f5f4", secondary: "#a8a29e", accent: "#c9a227", background: "#0c0a09", surface: "#1c1917", text: "#fafaf9", muted: "#a8a29e", border: "#292524" }, fonts: { heading: "Cormorant Garamond", body: "Inter", headingWeight: 600, bodyWeight: 400 }, mode: "dark", radius: "sm", buttonStyle: "outline", animation: "subtle", spacing: "spacious" } },
];
