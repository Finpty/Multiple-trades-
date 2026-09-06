import { z } from "zod";
import type { Industry } from "@prisma/client";
import { platformDb, prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { toJson } from "@/lib/json";
import { BLOCK_TYPES } from "@/lib/blocks/schema";

/**
 * Industry schema builder — data functions and validation. Industries are
 * plain rows; everything a new business inherits (services, fields, pricing,
 * stages, website sections, lead questions, terminology, features) is edited
 * here from the Super Admin. No code changes are involved in adding a trade.
 */
export const IndustryGeneralSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only").optional(),
  description: z.string().max(500).optional().default(""),
  icon: z.string().max(60).optional().default("wrench"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const TerminologySchema = z.record(z.string().max(40), z.string().max(80));

const ServiceSeedSchema: z.ZodType<ServiceSeed> = z.lazy(() =>
  z.object({
    name: z.string().min(1).max(120),
    slug: z.string().max(120).optional(),
    shortDescription: z.string().max(300).optional(),
    description: z.string().max(5000).optional(),
    pricingMethod: z.enum(["QUOTE", "FIXED", "RANGE", "HOURLY", "DAY_RATE", "PER_SQM", "PER_UNIT", "PER_LINEAR_METRE"]).optional(),
    priceMinCents: z.number().int().min(0).nullable().optional(),
    priceMaxCents: z.number().int().min(0).nullable().optional(),
    priceUnit: z.string().max(20).optional(),
    faqs: z.array(z.object({ question: z.string().max(300), answer: z.string().max(3000) })).optional(),
    children: z.array(ServiceSeedSchema).optional(),
  }),
);
export interface ServiceSeed {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  pricingMethod?: "QUOTE" | "FIXED" | "RANGE" | "HOURLY" | "DAY_RATE" | "PER_SQM" | "PER_UNIT" | "PER_LINEAR_METRE";
  priceMinCents?: number | null;
  priceMaxCents?: number | null;
  priceUnit?: string;
  faqs?: Array<{ question: string; answer: string }>;
  children?: ServiceSeed[];
}
export const ServicesSchema = z.array(ServiceSeedSchema).max(200);

export const FieldSeedSchema = z.object({
  key: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, "snake_case"),
  label: z.string().min(1).max(120),
  type: z.enum(["TEXT", "TEXTAREA", "NUMBER", "MEASUREMENT", "SELECT", "MULTISELECT", "BOOLEAN", "DATE", "MEDIA", "ADDRESS"]),
  options: z.array(z.object({ value: z.string().max(80), label: z.string().max(120) })).optional(),
  isRequired: z.boolean().optional(),
  helpText: z.string().max(300).optional(),
  groupName: z.string().max(60).optional(),
  showOnForms: z.boolean().optional(),
  unit: z.string().max(20).optional(),
});
export const FieldsSchema = z.array(FieldSeedSchema).max(100);

export const PricingSeedSchema = z.object({
  key: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, "snake_case"),
  label: z.string().min(1).max(120),
  type: z.enum(["RATE", "FEE", "MULTIPLIER", "PERCENT"]),
  amount: z.number().min(0),
  unit: z.string().max(20).optional(),
  category: z.string().max(40).optional(),
  description: z.string().max(300).optional(),
});
export const PricingSchema = z.array(PricingSeedSchema).max(100);

export const StageSeedSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/, "snake_case"),
  name: z.string().min(1).max(60),
  color: z.string().max(20).optional(),
  description: z.string().max(300).optional(),
  isTerminal: z.boolean().optional(),
});
export const StagesSchema = z.array(StageSeedSchema).min(1).max(30).refine((s) => new Set(s.map((x) => x.key)).size === s.length, "Stage keys must be unique");

export const SectionSeedSchema = z.object({
  type: z.enum(BLOCK_TYPES as [string, ...string[]]),
  props: z.record(z.unknown()).default({}),
  settings: z.record(z.unknown()).optional(),
  isHidden: z.boolean().optional(),
});
export const WebsiteSectionsSchema = z.record(z.string(), z.array(SectionSeedSchema).max(30));

export const FeaturesSchema = z.array(z.string().max(60)).max(100);

export const SYSTEM_PAGE_KEYS = ["home", "services", "projects", "about", "reviews", "areas", "contact", "quote"] as const;

export const TERMINOLOGY_KEYS: Array<{ key: string; label: string; fallback: string }> = [
  { key: "service", label: "Service (singular)", fallback: "Service" },
  { key: "services", label: "Services (plural)", fallback: "Services" },
  { key: "project", label: "Project (singular)", fallback: "Project" },
  { key: "projects", label: "Projects (plural)", fallback: "Projects" },
  { key: "quote", label: "Quote", fallback: "Quote" },
  { key: "job", label: "Job", fallback: "Job" },
  { key: "customer", label: "Customer", fallback: "Customer" },
  { key: "lead", label: "Lead / enquiry", fallback: "Enquiry" },
];

export type IndustrySection = "terminology" | "services" | "jobFields" | "estimateFields" | "leadQuestions" | "pricingFields" | "projectStages" | "websiteSections" | "defaultFeatures";

export const SECTION_SCHEMAS: Record<IndustrySection, z.ZodTypeAny> = {
  terminology: TerminologySchema,
  services: ServicesSchema,
  jobFields: FieldsSchema,
  estimateFields: FieldsSchema,
  leadQuestions: FieldsSchema,
  pricingFields: PricingSchema,
  projectStages: StagesSchema,
  websiteSections: WebsiteSectionsSchema,
  defaultFeatures: FeaturesSchema,
};

const SECTION_COLUMN: Record<IndustrySection, keyof Industry> = {
  terminology: "terminology",
  services: "defaultServices",
  jobFields: "jobFields",
  estimateFields: "estimateFields",
  leadQuestions: "leadQuestions",
  pricingFields: "pricingFields",
  projectStages: "projectStages",
  websiteSections: "websiteSections",
  defaultFeatures: "defaultFeatures",
};

export async function listIndustries(opts: { q?: string; includeInactive?: boolean } = {}) {
  const rows = await prisma.industry.findMany({
    where: { deletedAt: null, ...(opts.includeInactive ? {} : {}), ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" } }, { slug: { contains: opts.q, mode: "insensitive" } }] } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { businesses: true, templates: true } } },
  });
  return rows;
}

export async function getIndustry(id: string) {
  return prisma.industry.findFirst({ where: { id, deletedAt: null }, include: { _count: { select: { businesses: true, templates: true } } } });
}

export async function uniqueIndustrySlug(base: string, excludeId?: string): Promise<string> {
  let candidate = slugify(base) || "industry";
  const root = candidate;
  let i = 2;
  while (true) {
    const existing = await prisma.industry.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${i++}`;
  }
}

export async function createIndustry(input: z.infer<typeof IndustryGeneralSchema>, actorUserId: string): Promise<Industry> {
  const slug = await uniqueIndustrySlug(input.slug ?? input.name);
  const row = await prisma.industry.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      icon: input.icon || "wrench",
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      terminology: toJson(Object.fromEntries(TERMINOLOGY_KEYS.map((t) => [t.key, t.fallback]))),
      projectStages: toJson([
        { key: "lead", name: "Lead", color: "#64748b" },
        { key: "quote", name: "Quote", color: "#8b5cf6" },
        { key: "accepted", name: "Accepted", color: "#22c55e" },
        { key: "in_progress", name: "In Progress", color: "#f97316" },
        { key: "completion", name: "Completion", color: "#10b981", isTerminal: true },
      ]),
      pricingFields: toJson([
        { key: "labour_hourly", label: "Labour rate (hourly)", type: "RATE", amount: 95, unit: "hour", category: "labour" },
        { key: "minimum_charge", label: "Minimum charge", type: "FEE", amount: 180, category: "fees" },
        { key: "materials_markup", label: "Materials markup", type: "PERCENT", amount: 15, category: "materials" },
      ]),
      defaultFeatures: toJson(["website", "projects", "reviews", "service_areas", "quote_requests", "crm", "quotes", "jobs", "automations", "analytics"]),
    },
  });
  await recordAudit({ actorUserId, action: "industry.created", entityType: "industry", entityId: row.id, severity: "NOTICE", after: { name: row.name, slug: row.slug } });
  return row;
}

export async function updateIndustryGeneral(id: string, input: z.infer<typeof IndustryGeneralSchema>, actorUserId: string): Promise<Industry> {
  const before = await prisma.industry.findUniqueOrThrow({ where: { id } });
  const slug = input.slug ? await uniqueIndustrySlug(input.slug, id) : before.slug;
  const row = await prisma.industry.update({ where: { id }, data: { name: input.name, slug, description: input.description || null, icon: input.icon || "wrench", isActive: input.isActive, sortOrder: input.sortOrder } });
  await recordAudit({ actorUserId, action: "industry.updated", entityType: "industry", entityId: id, before: { name: before.name, slug: before.slug, isActive: before.isActive }, after: { name: row.name, slug: row.slug, isActive: row.isActive } });
  return row;
}

export async function updateIndustrySection(id: string, section: IndustrySection, data: unknown, actorUserId: string): Promise<Industry> {
  const parsed = SECTION_SCHEMAS[section].parse(data);
  const column = SECTION_COLUMN[section];
  const row = await prisma.industry.update({ where: { id }, data: { [column]: toJson(parsed) } });
  await recordAudit({ actorUserId, action: `industry.${section}.updated`, entityType: "industry", entityId: id, metadata: { section, size: Array.isArray(parsed) ? parsed.length : Object.keys(parsed as object).length } });
  return row;
}

export async function duplicateIndustry(id: string, actorUserId: string): Promise<Industry> {
  const src = await prisma.industry.findUniqueOrThrow({ where: { id } });
  const slug = await uniqueIndustrySlug(`${src.slug}-copy`);
  const row = await prisma.industry.create({
    data: {
      name: `${src.name} (copy)`,
      slug,
      description: src.description,
      icon: src.icon,
      isActive: false,
      isSystem: false,
      sortOrder: src.sortOrder + 1,
      terminology: src.terminology as object,
      defaultServices: src.defaultServices as object,
      jobFields: src.jobFields as object,
      estimateFields: src.estimateFields as object,
      pricingFields: src.pricingFields as object,
      websiteSections: src.websiteSections as object,
      leadQuestions: src.leadQuestions as object,
      projectStages: src.projectStages as object,
      defaultFeatures: src.defaultFeatures as object,
    },
  });
  await recordAudit({ actorUserId, action: "industry.duplicated", entityType: "industry", entityId: row.id, metadata: { sourceId: id } });
  return row;
}

export async function setIndustryActive(id: string, isActive: boolean, actorUserId: string): Promise<void> {
  await prisma.industry.update({ where: { id }, data: { isActive } });
  await recordAudit({ actorUserId, action: isActive ? "industry.activated" : "industry.deactivated", entityType: "industry", entityId: id, severity: "NOTICE" });
}

export async function deleteIndustry(id: string, actorUserId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const inUse = await platformDb.business.count({ where: { industryId: id, deletedAt: null } });
  if (inUse > 0) return { ok: false, reason: `${inUse} business(es) use this industry. Deactivate it instead.` };
  await prisma.industry.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await recordAudit({ actorUserId, action: "industry.deleted", entityType: "industry", entityId: id, severity: "CRITICAL" });
  return { ok: true };
}

export async function businessesUsingIndustry(id: string) {
  return platformDb.business.findMany({ where: { industryId: id, deletedAt: null }, select: { id: true, name: true, slug: true, status: true }, orderBy: { name: "asc" }, take: 100 });
}
