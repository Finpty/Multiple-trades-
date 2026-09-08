/** Client-safe option lists for the brand/theme builders (wizard and business admin). */
export const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Work Sans", "DM Sans", "Manrope",
  "Source Sans 3", "Space Grotesk", "Plus Jakarta Sans", "Outfit", "Raleway", "Oswald", "Archivo Black", "Bebas Neue",
  "Playfair Display", "Libre Baskerville", "Cormorant Garamond", "Fraunces", "Merriweather", "Lora", "EB Garamond",
];

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

export const THEME_ENUMS = {
  radius: ["none", "sm", "md", "lg", "xl"],
  buttonStyle: ["solid", "outline", "pill", "ghost"],
  borderStyle: ["none", "subtle", "strong"],
  imageStyle: ["natural", "warm", "cinematic", "muted", "duotone"],
  animation: ["none", "subtle", "medium", "bold"],
  mode: ["light", "dark"],
  spacing: ["compact", "comfortable", "spacious"],
  tone: ["professional", "friendly", "premium", "bold", "technical"],
} as const;

export const THEME_ENUM_LABELS: Record<keyof typeof THEME_ENUMS, string> = {
  radius: "Corner radius",
  buttonStyle: "Button style",
  borderStyle: "Borders",
  imageStyle: "Image treatment",
  animation: "Motion",
  mode: "Colour mode",
  spacing: "Section spacing",
  tone: "Tone of voice",
};

export const COLOR_KEYS: Array<{ key: "primary" | "secondary" | "accent" | "background" | "surface" | "text" | "muted" | "border"; label: string; hint: string }> = [
  { key: "primary", label: "Primary", hint: "Buttons, links, headings" },
  { key: "secondary", label: "Secondary", hint: "Supporting elements" },
  { key: "accent", label: "Accent", hint: "Highlights & calls to action" },
  { key: "background", label: "Background", hint: "Page background" },
  { key: "surface", label: "Surface", hint: "Cards & alternating sections" },
  { key: "text", label: "Text", hint: "Body copy" },
  { key: "muted", label: "Muted", hint: "Secondary text" },
  { key: "border", label: "Border", hint: "Dividers & outlines" },
];
