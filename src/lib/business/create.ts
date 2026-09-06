import type { Business, Prisma } from "@prisma/client";
import { z } from "zod";
import { platformDb, prisma, withPlatformTransaction } from "@/lib/db";
import { emitEvent, flushEvents } from "@/lib/events";
import { recordAudit } from "@/lib/audit";
import { asArray, asObject, toJson } from "@/lib/json";
import { isReservedSlug, slugify } from "@/lib/slug";
import { DEFAULT_THEME_TOKENS, mergeTokens, ThemeTokensSchema, type ThemeTokens } from "@/lib/theme/tokens";
import type { IndustryFieldSeed, IndustryPricingSeed, IndustryServiceSeed, IndustryStageSeed } from "@/lib/catalog/industries";
import type { SectionSeed } from "@/lib/blocks/schema";
import { defaultForms, defaultNavigation, defaultSystemPages, type BusinessSeedInfo, type FormFieldSeed } from "./defaults";

/**
 * THE business generation engine.
 *
 * Every business — from the Super Admin wizard, a template, duplication, an
 * import or the demo seed — is created through `createBusiness`. It reads the
 * industry definition and the platform catalogue from the database and
 * materialises a complete, editable business: settings, theme, features,
 * services, workflow, custom fields, pricing, forms, pages, navigation and
 * service areas. No code path is specific to any trade or company.
 */
export const CreateBusinessInput = z.object({
  organizationId: z.string().uuid().optional(),
  organizationName: z.string().min(1).optional(),
  industryId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).optional(),
  legalName: z.string().max(160).optional(),
  tradingName: z.string().max(160).optional(),
  businessNumber: z.string().max(60).optional(),
  taxNumber: z.string().max(60).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  website: z.string().max(200).optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional(),
  country: z.string().length(2).default("AU"),
  state: z.string().max(80).optional(),
  timezone: z.string().default("Australia/Perth"),
  currency: z.string().length(3).default("AUD"),
  locale: z.string().default("en-AU"),
  taxName: z.string().default("GST"),
  taxRate: z.number().min(0).max(100).default(10),
  taxInclusive: z.boolean().default(true),
  serviceAreaText: z.string().max(200).optional(),
  address: z
    .object({ line1: z.string().optional(), line2: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postcode: z.string().optional(), country: z.string().optional() })
    .optional(),
  designFamilySlug: z.string().optional(),
  themeOverrides: ThemeTokensSchema.partial().optional(),
  features: z.array(z.string()).optional(),
  /** Initial service areas: suburbs/cities as plain names. */
  serviceAreas: z.array(z.object({ name: z.string(), type: z.enum(["COUNTRY", "STATE", "REGION", "CITY", "SUBURB", "POSTCODE"]).default("SUBURB"), postcode: z.string().optional(), state: z.string().optional(), isPrimary: z.boolean().optional() })).optional(),
  /** Override industry default services entirely (e.g. from the wizard). */
  services: z.array(z.custom<IndustryServiceSeed>()).optional(),
  ownerUserId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid().nullable().optional(),
  /** Skip the default page generation (used by duplicate/import which copy pages explicitly). */
  skipWebsiteGeneration: z.boolean().optional(),
});
export type CreateBusinessInput = z.input<typeof CreateBusinessInput>;
export type CreateBusinessParsed = z.output<typeof CreateBusinessInput>;

export class BusinessCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessCreationError";
  }
}

export async function ensureUniqueBusinessSlug(base: string, exclude?: string): Promise<string> {
  let candidate = slugify(base) || "business";
  if (isReservedSlug(candidate)) candidate = `${candidate}-co`;
  const root = candidate;
  let i = 2;
  while (true) {
    const existing = await prisma.business.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === exclude) return candidate;
    candidate = `${root}-${i++}`;
  }
}

function fieldTypeToPrisma(type: IndustryFieldSeed["type"]) {
  return type;
}

function fieldToFormField(f: IndustryFieldSeed): FormFieldSeed {
  const map: Record<string, string> = { TEXT: "text", TEXTAREA: "textarea", NUMBER: "number", MEASUREMENT: "measurement", SELECT: "dropdown", MULTISELECT: "checkbox", BOOLEAN: "checkbox", DATE: "date", MEDIA: "photo", ADDRESS: "address" };
  return { id: f.key, key: f.key, type: map[f.type] ?? "text", label: f.label, options: f.options, helpText: f.helpText, width: f.type === "TEXTAREA" ? "full" : "half" };
}

export async function createBusiness(rawInput: CreateBusinessInput): Promise<Business> {
  const input = CreateBusinessInput.parse(rawInput);
  const industry = await prisma.industry.findFirst({ where: { id: input.industryId, deletedAt: null } });
  if (!industry) throw new BusinessCreationError("Industry not found.");
  if (!industry.isActive) throw new BusinessCreationError("This industry is not active.");

  const [designFamily, featureDefs, roles] = await Promise.all([
    input.designFamilySlug ? prisma.designFamily.findUnique({ where: { slug: input.designFamilySlug } }) : prisma.designFamily.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.featureDefinition.findMany({ where: { isActive: true } }),
    prisma.role.findMany({ where: { key: { in: ["org_owner", "business_owner"] } } }),
  ]);
  const orgOwnerRole = roles.find((r) => r.key === "org_owner");
  const businessOwnerRole = roles.find((r) => r.key === "business_owner");
  if (!orgOwnerRole || !businessOwnerRole) throw new BusinessCreationError("System roles are missing. Run the seed.");

  const slug = await ensureUniqueBusinessSlug(input.slug ?? input.name);
  const terminology = asObject<Record<string, string>>(industry.terminology);
  const info: BusinessSeedInfo = {
    name: input.name,
    tagline: input.tagline ?? null,
    description: input.description ?? null,
    industryName: industry.name,
    serviceAreaText: input.serviceAreaText ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    terminology,
  };

  const industryFeatures = asArray<string>(industry.defaultFeatures);
  const enabledFeatures = new Set(input.features ?? (industryFeatures.length ? industryFeatures : featureDefs.filter((f) => f.defaultEnabled).map((f) => f.key)));
  const baseTokens: ThemeTokens = designFamily ? mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>(designFamily.tokens)) : DEFAULT_THEME_TOKENS;
  const themeTokens = mergeTokens(baseTokens, input.themeOverrides ?? null);

  const services = input.services ?? asArray<IndustryServiceSeed>(industry.defaultServices);
  const stages = asArray<IndustryStageSeed>(industry.projectStages);
  const jobFields = asArray<IndustryFieldSeed>(industry.jobFields);
  const estimateFields = asArray<IndustryFieldSeed>(industry.estimateFields);
  const pricingFields = asArray<IndustryPricingSeed>(industry.pricingFields);
  const leadQuestions = asArray<IndustryFieldSeed>(industry.leadQuestions);
  const websiteOverrides = asObject<Record<string, SectionSeed[]>>(industry.websiteSections);

  const eventIds: string[] = [];

  const business = await withPlatformTransaction(async (tx) => {
    // ── Organisation ──────────────────────────────────────────────────────
    let organizationId = input.organizationId;
    if (!organizationId) {
      const orgName = input.organizationName ?? input.name;
      let orgSlug = slugify(orgName) || slug;
      while (await tx.organization.findUnique({ where: { slug: orgSlug } })) orgSlug = `${orgSlug}-${Math.floor(Math.random() * 1000)}`;
      const org = await tx.organization.create({ data: { name: orgName, slug: orgSlug, ownerUserId: input.ownerUserId ?? null } });
      organizationId = org.id;
      if (input.ownerUserId) {
        await tx.organizationMembership.create({ data: { organizationId, userId: input.ownerUserId, roleId: orgOwnerRole.id, acceptedAt: new Date() } });
      }
    }

    // ── Business ──────────────────────────────────────────────────────────
    const created = await tx.business.create({
      data: {
        organizationId,
        industryId: industry.id,
        templateId: input.templateId ?? null,
        slug,
        name: input.name,
        legalName: input.legalName ?? null,
        tradingName: input.tradingName ?? null,
        businessNumber: input.businessNumber ?? null,
        taxNumber: input.taxNumber ?? null,
        tagline: input.tagline ?? null,
        description: input.description ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        foundedYear: input.foundedYear ?? null,
        country: input.country,
        state: input.state ?? input.address?.state ?? null,
        timezone: input.timezone,
        currency: input.currency,
        locale: input.locale,
        taxName: input.taxName,
        taxRate: input.taxRate,
        taxInclusive: input.taxInclusive,
        serviceAreaText: input.serviceAreaText ?? null,
        status: "DRAFT",
        createdByUserId: input.createdByUserId ?? null,
        settings: toJson({ terminology }),
      },
    });
    const businessId = created.id;

    if (input.ownerUserId) {
      await tx.businessMembership.create({ data: { businessId, userId: input.ownerUserId, roleId: businessOwnerRole.id, acceptedAt: new Date() } });
    }

    if (input.address && (input.address.line1 || input.address.city)) {
      await tx.businessLocation.create({
        data: { businessId, name: "Head office", isPrimary: true, addressLine1: input.address.line1 ?? null, addressLine2: input.address.line2 ?? null, city: input.address.city ?? null, state: input.address.state ?? null, postcode: input.address.postcode ?? null, country: input.address.country ?? input.country, phone: input.phone ?? null, email: input.email ?? null },
      });
    }

    // ── Theme ─────────────────────────────────────────────────────────────
    await tx.businessTheme.create({ data: { businessId, designFamilyId: designFamily?.id ?? null, draft: toJson(themeTokens) } });

    // ── Features ──────────────────────────────────────────────────────────
    if (featureDefs.length) {
      await tx.businessFeature.createMany({ data: featureDefs.map((f) => ({ businessId, featureKey: f.key, isEnabled: enabledFeatures.has(f.key) && !f.isPlatformOnly })) });
    }

    // ── Services (nested) ─────────────────────────────────────────────────
    const usedServiceSlugs = new Set<string>();
    const createService = async (s: IndustryServiceSeed, parentId: string | null, order: number) => {
      let sslug = s.slug ?? slugify(s.name);
      let i = 2;
      while (usedServiceSlugs.has(sslug)) sslug = `${s.slug ?? slugify(s.name)}-${i++}`;
      usedServiceSlugs.add(sslug);
      const row = await tx.service.create({
        data: {
          businessId,
          parentId,
          name: s.name,
          slug: sslug,
          shortDescription: s.shortDescription ?? null,
          description: s.description ?? null,
          pricingMethod: s.pricingMethod ?? "QUOTE",
          priceMinCents: s.priceMinCents ?? null,
          priceMaxCents: s.priceMaxCents ?? null,
          priceUnit: s.priceUnit ?? null,
          faqs: toJson(s.faqs ?? []),
          ctaLabel: "Request a quote",
          ctaHref: "/quote",
          sortOrder: order,
          isFeatured: order < 4 && !parentId,
        },
      });
      for (const [j, child] of (s.children ?? []).entries()) await createService(child, row.id, j);
    };
    for (const [i, s] of services.entries()) await createService(s, null, i);

    // ── Workflow ──────────────────────────────────────────────────────────
    await tx.workflow.create({
      data: { businessId, key: "default", name: `${terminology.job ?? "Job"} workflow`, stages: toJson(stages.length ? stages : [{ key: "lead", name: "Lead" }, { key: "quote", name: "Quote" }, { key: "in_progress", name: "In Progress" }, { key: "completion", name: "Completion", isTerminal: true }]), isDefault: true },
    });

    // ── Custom fields ─────────────────────────────────────────────────────
    const fieldRows: Prisma.CustomFieldDefinitionCreateManyInput[] = [];
    jobFields.forEach((f, i) => fieldRows.push({ businessId, entityType: "JOB", key: f.key, label: f.label, type: fieldTypeToPrisma(f.type), options: toJson(f.options ?? []), isRequired: !!f.isRequired, helpText: f.helpText ?? null, groupName: f.groupName ?? null, showOnForms: !!f.showOnForms, sortOrder: i, validation: toJson(f.unit ? { unit: f.unit } : {}) }));
    estimateFields.forEach((f, i) => fieldRows.push({ businessId, entityType: "ESTIMATE", key: f.key, label: f.label, type: fieldTypeToPrisma(f.type), options: toJson(f.options ?? []), isRequired: !!f.isRequired, helpText: f.helpText ?? null, groupName: f.groupName ?? null, showOnForms: !!f.showOnForms, sortOrder: i, validation: toJson(f.unit ? { unit: f.unit } : {}) }));
    leadQuestions.forEach((f, i) => fieldRows.push({ businessId, entityType: "LEAD", key: f.key, label: f.label, type: fieldTypeToPrisma(f.type), options: toJson(f.options ?? []), isRequired: !!f.isRequired, helpText: f.helpText ?? null, groupName: f.groupName ?? null, showOnForms: true, sortOrder: i, validation: toJson({}) }));
    if (fieldRows.length) await tx.customFieldDefinition.createMany({ data: fieldRows, skipDuplicates: true });

    // ── Pricing ───────────────────────────────────────────────────────────
    if (pricingFields.length) {
      await tx.pricingItem.createMany({ data: pricingFields.map((p, i) => ({ businessId, key: p.key, label: p.label, type: p.type, amount: p.amount, unit: p.unit ?? null, category: p.category ?? null, description: p.description ?? null, sortOrder: i })), skipDuplicates: true });
    }
    if (pricingFields.some((p) => p.key === "large_format_multiplier")) {
      await tx.pricingRule.create({
        data: { businessId, name: "Large-format tile multiplier", description: "Apply the large-format multiplier when tiles exceed 1200mm.", priority: 10, conditions: toJson({ match: "all", rules: [{ field: "inputs.tile_size_mm", operator: "gt", value: 1200 }] }), actions: toJson([{ type: "multiply_variable", variable: "labour", pricingItemKey: "large_format_multiplier" }]) },
      });
    }

    // ── Forms ─────────────────────────────────────────────────────────────
    const forms = defaultForms(info, leadQuestions.filter((q) => q.showOnForms !== false).map(fieldToFormField));
    for (const f of forms) {
      await tx.form.create({ data: { businessId, slug: f.slug, name: f.name, action: f.action, fields: toJson(f.fields), settings: toJson(f.settings) } });
    }

    // ── Service areas ─────────────────────────────────────────────────────
    const areaSlugs = new Set<string>();
    for (const [i, a] of (input.serviceAreas ?? []).entries()) {
      let aslug = slugify(a.name);
      let n = 2;
      while (areaSlugs.has(aslug)) aslug = `${slugify(a.name)}-${n++}`;
      areaSlugs.add(aslug);
      await tx.serviceArea.create({ data: { businessId, type: a.type, name: a.name, slug: aslug, postcode: a.postcode ?? null, state: a.state ?? input.state ?? null, country: input.country, isPrimary: !!a.isPrimary || i === 0, sortOrder: i, content: toJson({ intro: `${input.name} provides ${industry.name.toLowerCase()} services in ${a.name}.` }) } });
    }

    // ── Pages + navigation ────────────────────────────────────────────────
    if (!input.skipWebsiteGeneration) {
      for (const p of defaultSystemPages(info)) {
        const sections = websiteOverrides[p.systemKey] ?? p.sections;
        const page = await tx.page.create({
          data: { businessId, slug: p.slug, title: p.title, kind: "SYSTEM", systemKey: p.systemKey, status: "DRAFT", showInNav: p.showInNav, sortOrder: p.sortOrder, seo: toJson(p.seo ?? {}) },
        });
        if (sections.length) {
          await tx.pageSection.createMany({ data: sections.map((s, i) => ({ businessId, pageId: page.id, type: s.type, sortOrder: i, props: toJson(s.props), settings: toJson(s.settings ?? {}), isHidden: !!s.isHidden })) });
        }
      }
      const nav = defaultNavigation(info);
      await tx.navigationMenu.createMany({
        data: [
          { businessId, key: "header", name: "Main navigation", draft: toJson(nav.header) },
          { businessId, key: "footer", name: "Footer", draft: toJson(nav.footer) },
        ],
      });
    }

    // ── Default automations ───────────────────────────────────────────────
    await tx.automationRule.createMany({
      data: [
        { businessId, name: "Create job when quote accepted", triggerEvent: "quote.accepted", actions: toJson([{ type: "create_project_from_quote" }]) },
        { businessId, name: "Notify owner of new lead", triggerEvent: "lead.created", actions: toJson([{ type: "create_task", title: "Follow up new enquiry from {{name}}", dueInDays: 1 }]) },
        { businessId, name: "Request review after completion", triggerEvent: "job.completed", actions: toJson([{ type: "request_review" }]) },
      ],
    });

    eventIds.push(await emitEvent({ type: "business.created", businessId, organizationId, payload: { businessId, organizationId, slug, name: input.name }, actorUserId: input.createdByUserId ?? null }, tx));
    return created;
  }, { timeout: 120_000 });

  await recordAudit({ actorUserId: input.createdByUserId ?? null, organizationId: business.organizationId, businessId: business.id, action: "business.created", entityType: "business", entityId: business.id, severity: "NOTICE", after: { name: business.name, slug: business.slug, industry: industry.slug } });
  await flushEvents(eventIds);
  return business;
}

/** Convenience for callers holding only the platform client. */
export async function getBusinessById(id: string) {
  return platformDb.business.findFirst({ where: { id, deletedAt: null }, include: { industry: true, organization: true, theme: true } });
}
