import { z } from "zod";
import { ThemeTokensSchema } from "@/lib/theme/tokens";
import type { ServiceSeedInput } from "@/lib/business/create";

/** Validation for the Create Business wizard payload (shared by the action and tests). */
const Opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const WizardServiceSchema: z.ZodType<ServiceSeedInput> = z.lazy(() =>
  z.object({
    name: z.string().trim().min(1, "Service name is required").max(120),
    slug: z.string().trim().max(80).optional(),
    shortDescription: z.string().trim().max(400).optional(),
    description: z.string().max(4000).optional(),
    pricingMethod: z.enum(["QUOTE", "FIXED", "RANGE", "HOURLY", "DAY_RATE", "PER_SQM", "PER_UNIT", "PER_LINEAR_METRE"]).optional(),
    priceMinCents: z.number().int().min(0).optional(),
    priceMaxCents: z.number().int().min(0).optional(),
    priceUnit: z.string().trim().max(40).optional(),
    ctaLabel: z.string().trim().max(60).optional(),
    isEnabled: z.boolean().optional(),
    children: z.array(WizardServiceSchema).optional(),
  }),
);

export const WizardPayloadSchema = z.object({
  industryId: z.string().uuid("Choose a business type"),
  templateId: z.string().uuid().nullable().optional(),
  details: z.object({
    name: z.string().trim().min(2, "Business name is required").max(120),
    slug: z.string().trim().min(2, "Slug is required").max(60),
    legalName: Opt(160),
    tradingName: Opt(160),
    businessNumber: Opt(60),
    taxNumber: Opt(60),
    phone: Opt(40),
    email: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)).pipe(z.string().email("Enter a valid email").optional()),
    website: Opt(200),
    addressLine1: Opt(200),
    addressLine2: Opt(200),
    city: Opt(120),
    state: Opt(80),
    postcode: Opt(20),
    country: z.string().trim().length(2, "Country code must be 2 letters").default("AU"),
    serviceAreaText: Opt(200),
    timezone: z.string().trim().min(1).default("Australia/Perth"),
    currency: z.string().trim().length(3).default("AUD"),
    locale: z.string().trim().min(2).max(20).default("en-AU"),
    taxName: z.string().trim().max(20).default("GST"),
    taxRate: z.coerce.number().min(0).max(100).default(10),
    taxInclusive: z.boolean().default(true),
    tagline: Opt(200),
    description: Opt(4000),
    foundedYear: z.union([z.coerce.number().int().min(1800).max(2100), z.literal("")]).optional().transform((v) => (typeof v === "number" ? v : undefined)),
    organizationMode: z.enum(["new", "existing"]).default("new"),
    organizationId: z.string().optional(),
    organizationName: Opt(120),
  }),
  designFamilySlug: z.string().nullable().optional(),
  themeTokens: ThemeTokensSchema.partial().optional(),
  services: z.array(WizardServiceSchema).min(1, "Add at least one service"),
  pricingItems: z.array(z.object({ key: z.string().trim().min(1, "Key is required").max(60), label: z.string().trim().min(1, "Label is required").max(120), type: z.enum(["RATE", "FEE", "MULTIPLIER", "PERCENT"]), amount: z.coerce.number().finite(), unit: Opt(40), category: Opt(60) })),
  serviceAreas: z.array(z.object({ name: z.string().trim().min(1).max(120), type: z.enum(["COUNTRY", "STATE", "REGION", "CITY", "SUBURB", "POSTCODE"]), postcode: Opt(20), state: Opt(80), isPrimary: z.boolean().optional() })),
  features: z.array(z.string()),
  owner: z.object({ email: z.string().trim().max(200), name: z.string().trim().max(120) }).optional(),
  publishNow: z.boolean().default(false),
});
export type WizardPayload = z.input<typeof WizardPayloadSchema>;
