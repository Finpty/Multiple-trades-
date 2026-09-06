import { z } from "zod";

/**
 * Block (section) contract shared by the page engine, the live editor and the
 * business generator. Each block type has a zod props schema; renderers live in
 * src/components/blocks/* and are looked up by `type` at render time. Adding a
 * block = add a schema entry + a renderer. Nothing about any business is here.
 */

const MediaRef = z.object({ mediaId: z.string().nullable().optional(), url: z.string().nullable().optional(), alt: z.string().optional() });
const Link = z.object({ label: z.string(), href: z.string(), style: z.enum(["primary", "secondary", "link"]).default("primary") });

export const BLOCK_SCHEMAS = {
  hero: z.object({
    layout: z.enum(["centered", "split", "full-bleed", "minimal"]).default("split"),
    eyebrow: z.string().optional(),
    heading: z.string(),
    subheading: z.string().optional(),
    image: MediaRef.optional(),
    video: MediaRef.optional(),
    primaryCta: Link.optional(),
    secondaryCta: Link.optional(),
    highlights: z.array(z.string()).default([]),
  }),
  page_header: z.object({ heading: z.string(), subheading: z.string().optional(), image: MediaRef.optional(), breadcrumbs: z.boolean().default(true) }),
  text: z.object({ heading: z.string().optional(), body: z.string(), align: z.enum(["left", "center"]).default("left"), width: z.enum(["narrow", "normal", "wide"]).default("normal") }),
  rich_content: z.object({ html: z.string() }),
  image: z.object({ image: MediaRef, caption: z.string().optional(), width: z.enum(["normal", "wide", "full"]).default("normal") }),
  video: z.object({ video: MediaRef.optional(), embedUrl: z.string().optional(), poster: MediaRef.optional(), caption: z.string().optional() }),
  gallery: z.object({ heading: z.string().optional(), images: z.array(MediaRef).default([]), columns: z.number().int().min(2).max(5).default(3), source: z.enum(["manual", "projects", "media_tag"]).default("manual"), tag: z.string().optional() }),
  before_after: z.object({ heading: z.string().optional(), before: MediaRef, after: MediaRef, caption: z.string().optional() }),
  stats: z.object({ heading: z.string().optional(), items: z.array(z.object({ value: z.string(), label: z.string() })).default([]) }),
  services: z.object({ heading: z.string().optional(), intro: z.string().optional(), source: z.enum(["all", "featured", "selected"]).default("all"), serviceIds: z.array(z.string()).default([]), layout: z.enum(["grid", "list", "cards"]).default("grid"), limit: z.number().int().min(1).max(48).default(12), showPricing: z.boolean().default(false) }),
  projects: z.object({ heading: z.string().optional(), intro: z.string().optional(), source: z.enum(["all", "featured", "selected", "by_service"]).default("featured"), projectIds: z.array(z.string()).default([]), serviceId: z.string().optional(), limit: z.number().int().min(1).max(48).default(6), layout: z.enum(["grid", "masonry", "carousel"]).default("grid") }),
  reviews: z.object({ heading: z.string().optional(), source: z.enum(["all", "featured"]).default("featured"), limit: z.number().int().min(1).max(24).default(6), layout: z.enum(["grid", "carousel", "list"]).default("grid"), showRating: z.boolean().default(true) }),
  faq: z.object({ heading: z.string().optional(), items: z.array(z.object({ question: z.string(), answer: z.string() })).default([]), source: z.enum(["manual", "service"]).default("manual"), serviceId: z.string().optional() }),
  pricing: z.object({ heading: z.string().optional(), intro: z.string().optional(), source: z.enum(["services", "manual"]).default("services"), tiers: z.array(z.object({ name: z.string(), price: z.string(), description: z.string().optional(), features: z.array(z.string()).default([]), cta: Link.optional(), highlighted: z.boolean().default(false) })).default([]) }),
  process: z.object({ heading: z.string().optional(), intro: z.string().optional(), source: z.enum(["workflow", "manual"]).default("manual"), steps: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional() })).default([]) }),
  team: z.object({ heading: z.string().optional(), intro: z.string().optional(), source: z.enum(["all", "selected"]).default("all"), memberIds: z.array(z.string()).default([]) }),
  map: z.object({ heading: z.string().optional(), address: z.string().optional(), lat: z.number().optional(), lng: z.number().optional(), zoom: z.number().int().min(3).max(18).default(11), showServiceAreas: z.boolean().default(true) }),
  service_areas: z.object({ heading: z.string().optional(), intro: z.string().optional(), layout: z.enum(["list", "grid", "tags"]).default("grid"), limit: z.number().int().min(1).max(200).default(60) }),
  contact: z.object({ heading: z.string().optional(), intro: z.string().optional(), showPhone: z.boolean().default(true), showEmail: z.boolean().default(true), showAddress: z.boolean().default(true), showHours: z.boolean().default(true), formSlug: z.string().optional() }),
  lead_form: z.object({ heading: z.string().optional(), intro: z.string().optional(), formSlug: z.string(), layout: z.enum(["stacked", "split"]).default("stacked"), image: MediaRef.optional() }),
  quote_form: z.object({ heading: z.string().optional(), intro: z.string().optional(), formSlug: z.string(), showServices: z.boolean().default(true) }),
  calculator: z.object({ heading: z.string().optional(), intro: z.string().optional(), serviceId: z.string().optional(), disclaimer: z.string().optional(), formSlug: z.string().optional() }),
  viewer_3d: z.object({ heading: z.string().optional(), modelUrl: z.string().optional(), poster: MediaRef.optional(), caption: z.string().optional() }),
  cta: z.object({ heading: z.string(), body: z.string().optional(), primaryCta: Link.optional(), secondaryCta: Link.optional(), style: z.enum(["band", "card", "minimal"]).default("band") }),
  comparison: z.object({ heading: z.string().optional(), columns: z.array(z.string()).default([]), rows: z.array(z.object({ label: z.string(), values: z.array(z.string()) })).default([]) }),
  timeline: z.object({ heading: z.string().optional(), items: z.array(z.object({ title: z.string(), date: z.string().optional(), description: z.string().optional() })).default([]) }),
  features: z.object({ heading: z.string().optional(), intro: z.string().optional(), items: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional() })).default([]), columns: z.number().int().min(2).max(4).default(3) }),
} as const;

export type BlockType = keyof typeof BLOCK_SCHEMAS;
export type BlockProps<T extends BlockType> = z.infer<(typeof BLOCK_SCHEMAS)[T]>;

export const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as BlockType[];

export const BLOCK_META: Record<BlockType, { label: string; category: "layout" | "content" | "media" | "social-proof" | "conversion" | "data"; description: string }> = {
  hero: { label: "Hero", category: "layout", description: "Headline, supporting text, image/video and calls to action." },
  page_header: { label: "Page header", category: "layout", description: "Title band for inner pages." },
  text: { label: "Text", category: "content", description: "Heading and paragraphs (Markdown)." },
  rich_content: { label: "Custom rich content", category: "content", description: "Free-form HTML block." },
  image: { label: "Image", category: "media", description: "Single image with caption." },
  video: { label: "Video", category: "media", description: "Uploaded or embedded video." },
  gallery: { label: "Gallery", category: "media", description: "Image grid from selected media, projects or a tag." },
  before_after: { label: "Before / After", category: "media", description: "Slider comparing two images." },
  stats: { label: "Statistics", category: "content", description: "Key numbers." },
  services: { label: "Services", category: "data", description: "Service cards from the catalogue." },
  projects: { label: "Projects", category: "data", description: "Portfolio grid." },
  reviews: { label: "Reviews", category: "social-proof", description: "Customer reviews." },
  faq: { label: "FAQ", category: "content", description: "Accordion of questions and answers." },
  pricing: { label: "Pricing", category: "conversion", description: "Price tiers or service pricing." },
  process: { label: "Process", category: "content", description: "Step-by-step process (optionally from the workflow)." },
  team: { label: "Team", category: "social-proof", description: "Team member cards." },
  map: { label: "Map", category: "data", description: "Location map and service areas." },
  service_areas: { label: "Service areas", category: "data", description: "Links to service-area pages." },
  contact: { label: "Contact details", category: "conversion", description: "Phone, email, address, hours." },
  lead_form: { label: "Lead form", category: "conversion", description: "Embed a form that creates leads." },
  quote_form: { label: "Quote form", category: "conversion", description: "Quote request form." },
  calculator: { label: "Calculator", category: "conversion", description: "Instant estimate powered by the pricing engine." },
  viewer_3d: { label: "3D viewer", category: "media", description: "Interactive 3D model." },
  cta: { label: "Call to action", category: "conversion", description: "Prominent action band." },
  comparison: { label: "Comparison", category: "content", description: "Comparison table." },
  timeline: { label: "Timeline", category: "content", description: "Dated milestones." },
  features: { label: "Features / USPs", category: "content", description: "Icon + title + description grid." },
};

export const SectionSettingsSchema = z.object({
  background: z.enum(["default", "surface", "primary", "dark", "image"]).default("default"),
  backgroundImage: MediaRef.optional(),
  paddingTop: z.enum(["none", "sm", "md", "lg"]).default("md"),
  paddingBottom: z.enum(["none", "sm", "md", "lg"]).default("md"),
  width: z.enum(["narrow", "normal", "wide", "full"]).default("normal"),
  anchor: z.string().optional(),
  hideOnMobile: z.boolean().default(false),
  cssClass: z.string().optional(),
});
export type SectionSettings = z.infer<typeof SectionSettingsSchema>;

export interface SectionSeed {
  type: BlockType;
  props: Record<string, unknown>;
  settings?: Partial<SectionSettings>;
  isHidden?: boolean;
}

/** Snapshot shape stored in pages.published */
export interface PublishedPageSnapshot {
  title: string;
  seo: Record<string, unknown>;
  settings: Record<string, unknown>;
  sections: Array<{ id: string; type: string; props: Record<string, unknown>; settings: Record<string, unknown>; isHidden: boolean }>;
  version: number;
  publishedAt: string;
}

export function validateBlockProps(type: string, props: unknown): { ok: true; props: Record<string, unknown> } | { ok: false; error: string } {
  const schema = BLOCK_SCHEMAS[type as BlockType];
  if (!schema) return { ok: false, error: `Unknown block type "${type}"` };
  const parsed = schema.safeParse(props ?? {});
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, props: parsed.data as Record<string, unknown> };
}

export function defaultBlockProps(type: BlockType): Record<string, unknown> {
  const schema = BLOCK_SCHEMAS[type];
  const attempt = schema.safeParse({});
  if (attempt.success) return attempt.data as Record<string, unknown>;
  // Fill required strings with placeholders so a new block renders immediately.
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  const draft: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(shape)) {
    const inner = def instanceof z.ZodDefault ? def : def;
    if (inner instanceof z.ZodString) draft[key] = BLOCK_META[type].label;
    else if (inner instanceof z.ZodObject) draft[key] = {};
  }
  const second = schema.safeParse(draft);
  return second.success ? (second.data as Record<string, unknown>) : draft;
}
