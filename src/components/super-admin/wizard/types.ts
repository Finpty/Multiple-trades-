import type { ThemeTokens } from "@/lib/theme/tokens";

/**
 * Wizard state. Everything the Super Admin enters lives here (and in a
 * localStorage draft) until the final step posts it to the server action.
 * Nothing here is specific to any trade or company: options come from rows.
 */

export type PricingMethod = "QUOTE" | "FIXED" | "RANGE" | "HOURLY" | "DAY_RATE" | "PER_SQM" | "PER_UNIT" | "PER_LINEAR_METRE";
export type ServiceAreaType = "COUNTRY" | "STATE" | "REGION" | "CITY" | "SUBURB" | "POSTCODE";
export type PricingItemType = "RATE" | "FEE" | "MULTIPLIER" | "PERCENT";

export interface WizardService {
  uid: string;
  depth: number;
  name: string;
  slug: string;
  shortDescription: string;
  pricingMethod: PricingMethod;
  priceMin: string;
  priceMax: string;
  priceUnit: string;
  ctaLabel: string;
  isEnabled: boolean;
}

export interface WizardPricingItem {
  uid: string;
  key: string;
  label: string;
  type: PricingItemType;
  amount: string;
  unit: string;
  category: string;
}

export interface WizardServiceArea {
  uid: string;
  name: string;
  type: ServiceAreaType;
  postcode: string;
  state: string;
  isPrimary: boolean;
}

export interface WizardDetails {
  name: string;
  legalName: string;
  tradingName: string;
  businessNumber: string;
  taxNumber: string;
  phone: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  serviceAreaText: string;
  timezone: string;
  currency: string;
  locale: string;
  taxName: string;
  taxRate: string;
  taxInclusive: boolean;
  tagline: string;
  description: string;
  foundedYear: string;
  slug: string;
  slugTouched: boolean;
  organizationMode: "new" | "existing";
  organizationId: string;
  organizationName: string;
}

export interface WizardState {
  version: 1;
  step: number;
  industryId: string | null;
  templateId: string | null;
  templateName: string | null;
  details: WizardDetails;
  designFamilySlug: string | null;
  /** Explicit brand edits layered on top of the design family preset. */
  brandOverrides: Partial<ThemeTokens>;
  services: WizardService[];
  pricingItems: WizardPricingItem[];
  serviceAreas: WizardServiceArea[];
  /** Enabled feature keys. */
  features: string[];
  featuresTouched: boolean;
  owner: { email: string; name: string };
  publishNow: boolean;
  updatedAt: string;
}

export interface IndustryOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  serviceCount: number;
  defaultServices: unknown[];
  pricingFields: unknown[];
  defaultFeatures: string[];
}

export interface TemplateOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  industryId: string | null;
  previewImageUrl: string | null;
  isPremium: boolean;
  priceCents: number;
  counts: Record<string, number>;
}

export interface DesignFamilyOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
}

export interface FeatureOption {
  key: string;
  name: string;
  description: string | null;
  category: string;
  defaultEnabled: boolean;
  requiresAi: boolean;
  isPlatformOnly: boolean;
}

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface WizardCatalog {
  industries: IndustryOption[];
  templates: TemplateOption[];
  designFamilies: DesignFamilyOption[];
  features: FeatureOption[];
  organizations: OrganizationOption[];
  platformUrl: string;
  platformHost: string;
  aiEnabled: boolean;
  defaults: { country: string; currency: string; timezone: string };
}

/** Prefill derived from a template snapshot (server action result). */
export interface TemplatePrefill {
  details: Partial<WizardDetails>;
  designFamilySlug: string | null;
  brandOverrides: Partial<ThemeTokens>;
  services: WizardService[];
  pricingItems: WizardPricingItem[];
  serviceAreas: WizardServiceArea[];
  features: string[];
}

export const WIZARD_STEPS = [
  { key: "type", label: "Business type", hint: "Industry & template" },
  { key: "details", label: "Business details", hint: "Name, contact, address" },
  { key: "brand", label: "Brand", hint: "Colours, fonts, style" },
  { key: "style", label: "Website style", hint: "Design family" },
  { key: "services", label: "Services", hint: "What you offer" },
  { key: "pricing", label: "Pricing", hint: "Rates & fees" },
  { key: "areas", label: "Service areas", hint: "Where you work" },
  { key: "features", label: "Features", hint: "Modules to enable" },
  { key: "users", label: "Users", hint: "Business owner" },
  { key: "review", label: "Review & create", hint: "Check everything" },
] as const;

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptyDetails(defaults: WizardCatalog["defaults"]): WizardDetails {
  return {
    name: "",
    legalName: "",
    tradingName: "",
    businessNumber: "",
    taxNumber: "",
    phone: "",
    email: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    country: defaults.country,
    serviceAreaText: "",
    timezone: defaults.timezone,
    currency: defaults.currency,
    locale: "en-AU",
    taxName: "GST",
    taxRate: "10",
    taxInclusive: true,
    tagline: "",
    description: "",
    foundedYear: "",
    slug: "",
    slugTouched: false,
    organizationMode: "new",
    organizationId: "",
    organizationName: "",
  };
}

export function emptyState(defaults: WizardCatalog["defaults"]): WizardState {
  return {
    version: 1,
    step: 0,
    industryId: null,
    templateId: null,
    templateName: null,
    details: emptyDetails(defaults),
    designFamilySlug: null,
    brandOverrides: {},
    services: [],
    pricingItems: [],
    serviceAreas: [],
    features: [],
    featuresTouched: false,
    owner: { email: "", name: "" },
    publishNow: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Convert an industry's nested defaultServices seed into the flat editable list. */
export function servicesFromSeed(seed: unknown[], depth = 0): WizardService[] {
  const out: WizardService[] = [];
  for (const raw of seed) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const name = typeof s.name === "string" ? s.name : "";
    if (!name) continue;
    out.push({
      uid: uid(),
      depth,
      name,
      slug: typeof s.slug === "string" ? s.slug : slugifyClient(name),
      shortDescription: typeof s.shortDescription === "string" ? s.shortDescription : "",
      pricingMethod: (typeof s.pricingMethod === "string" ? s.pricingMethod : "QUOTE") as PricingMethod,
      priceMin: typeof s.priceMinCents === "number" ? String(s.priceMinCents / 100) : "",
      priceMax: typeof s.priceMaxCents === "number" ? String(s.priceMaxCents / 100) : "",
      priceUnit: typeof s.priceUnit === "string" ? s.priceUnit : "",
      ctaLabel: typeof s.ctaLabel === "string" ? s.ctaLabel : "",
      isEnabled: s.isEnabled !== false,
    });
    if (Array.isArray(s.children)) out.push(...servicesFromSeed(s.children, depth + 1));
  }
  return out;
}

export function pricingFromSeed(seed: unknown[]): WizardPricingItem[] {
  const out: WizardPricingItem[] = [];
  for (const raw of seed) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.key !== "string" || typeof p.label !== "string") continue;
    out.push({ uid: uid(), key: p.key, label: p.label, type: (typeof p.type === "string" ? p.type : "RATE") as PricingItemType, amount: typeof p.amount === "number" ? String(p.amount) : "0", unit: typeof p.unit === "string" ? p.unit : "", category: typeof p.category === "string" ? p.category : "" });
  }
  return out;
}

/** Client-side slugify mirroring src/lib/slug.ts (kept dependency-free for the browser). */
export function slugifyClient(input: string, maxLength = 60): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Flat list (with depth) → nested tree for the server. */
export function servicesToTree(list: WizardService[]): Array<Record<string, unknown>> {
  type Node = Record<string, unknown> & { children: Node[] };
  const roots: Node[] = [];
  const stack: Array<{ depth: number; node: Node }> = [];
  for (const s of list) {
    const node: Node = {
      name: s.name.trim(),
      slug: s.slug.trim() || undefined,
      shortDescription: s.shortDescription.trim() || undefined,
      pricingMethod: s.pricingMethod,
      priceMinCents: s.priceMin.trim() ? Math.round(Number(s.priceMin) * 100) : undefined,
      priceMaxCents: s.priceMax.trim() ? Math.round(Number(s.priceMax) * 100) : undefined,
      priceUnit: s.priceUnit.trim() || undefined,
      ctaLabel: s.ctaLabel.trim() || undefined,
      isEnabled: s.isEnabled,
      children: [],
    };
    while (stack.length && stack[stack.length - 1].depth >= s.depth) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ depth: s.depth, node });
  }
  return roots;
}
