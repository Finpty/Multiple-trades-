"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/authz";
import { fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { asObject } from "@/lib/json";
import { isReservedSlug, slugify } from "@/lib/slug";
import { ThemeTokensSchema, type ThemeTokens } from "@/lib/theme/tokens";
import { createBusiness, ensureUniqueBusinessSlug, type ServiceSeedInput } from "@/lib/business/create";
import { publishBusiness } from "@/lib/business/publish";
import { importBusiness, parseBusinessExport, type ParsedBusinessExport } from "@/lib/business/import";
import { createBusinessFromTemplate } from "@/lib/business/templates";
import { isUuid } from "@/lib/ids";
import type { TemplatePrefill, WizardPricingItem, WizardService, WizardServiceArea } from "@/components/super-admin/wizard/types";
import { WizardPayloadSchema } from "./schema";

/* ───────────────────────────── slug check ───────────────────────────────── */

export interface SlugCheckResult {
  slug: string;
  available: boolean;
  reserved: boolean;
  suggested: string;
  pathUrl: string;
  subdomainUrl: string;
}

function platformHost(): string {
  try {
    return new URL(env().PLATFORM_URL).host;
  } catch {
    return "localhost:3000";
  }
}

export async function checkSlugAction(raw: string): Promise<ActionResult<SlugCheckResult>> {
  return runAction(async () => {
    await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const slug = slugify(String(raw ?? "")).slice(0, 60);
    if (!slug) return fail("Enter a name or slug first.");
    const reserved = isReservedSlug(slug);
    const existing = reserved ? null : await prisma.business.findUnique({ where: { slug }, select: { id: true } });
    const available = !reserved && !existing;
    const suggested = available ? slug : await ensureUniqueBusinessSlug(slug);
    const base = env().PLATFORM_URL.replace(/\/$/, "");
    return ok({ slug, available, reserved, suggested, pathUrl: `${base}/${suggested}`, subdomainUrl: `${suggested}.${platformHost()}` });
  });
}

/* ───────────────────────── template prefill ─────────────────────────────── */

function uidFor(prefix: string, i: number) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Derive editable wizard values from a template snapshot (no private data is ever in a snapshot). */
export async function loadTemplatePrefillAction(templateId: string): Promise<ActionResult<TemplatePrefill>> {
  return runAction(async () => {
    await requirePlatformAdmin("ADMIN", { throwOnly: true });
    if (!isUuid(templateId)) return fail("Invalid template.");
    const template = await prisma.businessTemplate.findFirst({ where: { id: templateId, isActive: true } });
    if (!template) return fail("Template not found or inactive.");
    const snap = parseBusinessExport(template.snapshot);
    const b = snap.business;
    const primary = snap.locations.find((l) => l.isPrimary) ?? snap.locations[0];

    // Services: flatten the parent/child graph into depth order.
    const byParent = new Map<string | null, ParsedBusinessExport["services"]>();
    for (const s of snap.services) {
      const key = s.parentId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), s]);
    }
    const services: WizardService[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const s of (byParent.get(parentId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)) {
        services.push({ uid: uidFor("svc", services.length), depth, name: s.name, slug: s.slug ?? slugify(s.name), shortDescription: s.shortDescription ?? "", pricingMethod: (s.pricingMethod as WizardService["pricingMethod"]) ?? "QUOTE", priceMin: s.priceMinCents != null ? String(s.priceMinCents / 100) : "", priceMax: s.priceMaxCents != null ? String(s.priceMaxCents / 100) : "", priceUnit: s.priceUnit ?? "", ctaLabel: s.ctaLabel ?? "", isEnabled: s.isEnabled });
        if (depth < 3) walk(s.id, depth + 1);
      }
    };
    walk(null, 0);
    // Orphans (parent not in the snapshot) become roots.
    const seen = new Set(services.map((s) => s.name + s.slug));
    for (const s of snap.services) if (!seen.has(s.name + (s.slug ?? slugify(s.name)))) services.push({ uid: uidFor("svc", services.length), depth: 0, name: s.name, slug: s.slug ?? slugify(s.name), shortDescription: s.shortDescription ?? "", pricingMethod: (s.pricingMethod as WizardService["pricingMethod"]) ?? "QUOTE", priceMin: "", priceMax: "", priceUnit: s.priceUnit ?? "", ctaLabel: s.ctaLabel ?? "", isEnabled: s.isEnabled });

    const pricingItems: WizardPricingItem[] = snap.pricingItems.map((p, i) => ({ uid: uidFor("price", i), key: p.key, label: p.label, type: (p.type as WizardPricingItem["type"]) ?? "RATE", amount: String(p.amount), unit: p.unit ?? "", category: p.category ?? "" }));
    const serviceAreas: WizardServiceArea[] = snap.serviceAreas.map((a, i) => ({ uid: uidFor("area", i), name: a.name, type: (a.type as WizardServiceArea["type"]) ?? "SUBURB", postcode: a.postcode ?? "", state: a.state ?? "", isPrimary: a.isPrimary }));
    const draft = asObject<Partial<ThemeTokens>>((snap.theme.draft ?? null) as never);
    const themeParse = ThemeTokensSchema.partial().safeParse({ ...draft, logoMediaId: undefined, secondaryLogoMediaId: undefined, iconMediaId: undefined, faviconMediaId: undefined });
    return ok({
      details: {
        legalName: b.legalName ?? "",
        tradingName: b.tradingName ?? "",
        phone: b.phone ?? "",
        email: b.email ?? "",
        website: b.website ?? "",
        addressLine1: primary?.addressLine1 ?? "",
        addressLine2: primary?.addressLine2 ?? "",
        city: primary?.city ?? "",
        state: b.state ?? primary?.state ?? "",
        postcode: primary?.postcode ?? "",
        country: b.country && b.country.length === 2 ? b.country : "AU",
        serviceAreaText: b.serviceAreaText ?? "",
        timezone: b.timezone ?? "Australia/Perth",
        currency: b.currency ?? "AUD",
        locale: b.locale ?? "en-AU",
        taxName: b.taxName ?? "GST",
        taxRate: b.taxRate != null ? String(b.taxRate) : "10",
        taxInclusive: b.taxInclusive ?? true,
        tagline: b.tagline ?? "",
        description: b.description ?? "",
        foundedYear: b.foundedYear != null ? String(b.foundedYear) : "",
      },
      designFamilySlug: snap.theme.designFamilySlug ?? null,
      brandOverrides: themeParse.success ? themeParse.data : {},
      services,
      pricingItems,
      serviceAreas,
      features: snap.features.filter((f) => f.isEnabled).map((f) => f.featureKey),
    });
  });
}

/* ───────────────────────────── create ───────────────────────────────────── */



export interface CreateWizardResult {
  businessId: string;
  slug: string;
  warnings: string[];
  published: boolean;
}

export async function createBusinessFromWizardAction(payload: unknown): Promise<ActionResult<CreateWizardResult>> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const input = WizardPayloadSchema.parse(payload);
    const d = input.details;

    const slugCandidate = slugify(d.slug);
    if (!slugCandidate) return fail("Please correct the highlighted fields.", { "details.slug": "Enter a valid slug." });
    if (isReservedSlug(slugCandidate)) return fail("Please correct the highlighted fields.", { "details.slug": "This slug is reserved by the platform." });
    if (await prisma.business.findUnique({ where: { slug: slugCandidate }, select: { id: true } })) return fail("Please correct the highlighted fields.", { "details.slug": "This slug is already taken." });

    if (d.organizationMode === "existing" && !isUuid(d.organizationId ?? "")) return fail("Please correct the highlighted fields.", { "details.organizationId": "Choose an organisation." });
    const pricingKeys = new Set<string>();
    for (const [i, p] of input.pricingItems.entries()) {
      const key = slugify(p.key).replace(/-/g, "_");
      if (pricingKeys.has(key)) return fail("Please correct the highlighted fields.", { [`pricingItems.${i}.key`]: `Duplicate key "${p.key}".` });
      pricingKeys.add(key);
    }
    const ownerInvite = input.owner?.email ? { email: input.owner.email.toLowerCase(), name: input.owner.name || input.owner.email.split("@")[0] } : undefined;
    if (ownerInvite && !z.string().email().safeParse(ownerInvite.email).success) return fail("Please correct the highlighted fields.", { "owner.email": "Enter a valid email address." });

    const address = d.addressLine1 || d.city ? { line1: d.addressLine1, line2: d.addressLine2, city: d.city, state: d.state, postcode: d.postcode, country: d.country } : undefined;
    const common = {
      organizationId: d.organizationMode === "existing" ? d.organizationId : undefined,
      organizationName: d.organizationMode === "new" ? d.organizationName || d.name : undefined,
      name: d.name,
      slug: slugCandidate,
      legalName: d.legalName,
      tradingName: d.tradingName,
      businessNumber: d.businessNumber,
      taxNumber: d.taxNumber,
      tagline: d.tagline,
      description: d.description,
      phone: d.phone,
      email: d.email,
      website: d.website,
      foundedYear: d.foundedYear,
      country: d.country.toUpperCase(),
      state: d.state,
      timezone: d.timezone,
      currency: d.currency.toUpperCase(),
      locale: d.locale,
      taxName: d.taxName,
      taxRate: d.taxRate,
      taxInclusive: d.taxInclusive,
      serviceAreaText: d.serviceAreaText,
      address,
    };
    const pricingItems = input.pricingItems.map((p) => ({ key: slugify(p.key).replace(/-/g, "_"), label: p.label, type: p.type, amount: p.amount, unit: p.unit, category: p.category }));
    const serviceAreas = input.serviceAreas.map((a, i) => ({ name: a.name, type: a.type, postcode: a.postcode, state: a.state ?? d.state, isPrimary: a.isPrimary ?? i === 0 }));

    let businessId: string;
    let slug: string;
    const warnings: string[] = [];

    if (input.templateId) {
      // Template path: snapshot import with the wizard's edits layered on top.
      const flat = flattenServicesForSnapshot(input.services);
      const result = await createBusinessFromTemplate(
        input.templateId,
        {
          name: common.name,
          slug: common.slug,
          organizationId: common.organizationId,
          organizationName: common.organizationName,
          industryId: input.industryId,
          ownerInvite,
          createdByUserId: user.id,
          overrides: { legalName: d.legalName, tradingName: d.tradingName, businessNumber: d.businessNumber, taxNumber: d.taxNumber, tagline: d.tagline, description: d.description, phone: d.phone, email: d.email, website: d.website, foundedYear: d.foundedYear, country: common.country, state: d.state, timezone: d.timezone, currency: common.currency, locale: d.locale, taxName: d.taxName, taxRate: d.taxRate, taxInclusive: d.taxInclusive, serviceAreaText: d.serviceAreaText, address },
          mediaSource: "auto",
        },
        {
          services: flat,
          pricingItems: pricingItems.map((p, i) => ({ id: `wizard-price-${i}`, serviceId: null, key: p.key, label: p.label, type: p.type, amount: p.amount, unit: p.unit ?? null, category: p.category ?? null, description: null, sortOrder: i, isActive: true })),
          serviceAreas: serviceAreas.map((a, i) => ({ id: `wizard-area-${i}`, parentId: null, type: a.type, name: a.name, slug: slugify(a.name), postcode: a.postcode ?? null, state: a.state ?? null, country: common.country, lat: null, lng: null, radiusKm: null, isPrimary: a.isPrimary, isEnabled: true, generatePage: true, content: { intro: `${d.name} provides services in ${a.name}.` }, seo: {}, sortOrder: i })),
          features: input.features.map((featureKey) => ({ featureKey, isEnabled: true, config: {} })),
          theme: { designFamilySlug: input.designFamilySlug ?? null, draft: input.themeTokens ?? {} },
        },
      );
      businessId = result.business.id;
      slug = result.business.slug;
      warnings.push(...result.warnings);
    } else {
      const business = await createBusiness({
        ...common,
        industryId: input.industryId,
        designFamilySlug: input.designFamilySlug ?? undefined,
        themeOverrides: input.themeTokens,
        features: input.features,
        services: input.services,
        pricingItems,
        serviceAreas,
        ownerInvite,
        createdByUserId: user.id,
      });
      businessId = business.id;
      slug = business.slug;
    }

    let published = false;
    if (input.publishNow) {
      try {
        await publishBusiness(businessId, { actorUserId: user.id });
        published = true;
      } catch (error) {
        warnings.push(`The business was created but could not be published automatically: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    revalidatePath("/super-admin/businesses");
    revalidatePath("/super-admin");
    return ok({ businessId, slug, warnings, published }, "Business created");
  });
}

/** Nested wizard services → the flat snapshot shape (ids are placeholders remapped on import). */
function flattenServicesForSnapshot(services: ServiceSeedInput[]): ParsedBusinessExport["services"] {
  const out: ParsedBusinessExport["services"] = [];
  const walk = (list: ServiceSeedInput[], parentId: string | null) => {
    list.forEach((s, i) => {
      const id = `wizard-service-${out.length}`;
      out.push({ id, parentId, name: s.name, slug: s.slug ?? slugify(s.name), shortDescription: s.shortDescription ?? null, description: s.description ?? null, icon: s.icon ?? null, pricingMethod: s.pricingMethod ?? "QUOTE", priceMinCents: s.priceMinCents ?? null, priceMaxCents: s.priceMaxCents ?? null, priceUnit: s.priceUnit ?? null, ctaLabel: s.ctaLabel?.trim() || "Request a quote", ctaHref: "/quote", faqs: s.faqs ?? [], seo: {}, customFields: {}, featuredMediaId: null, videoMediaId: null, gallery: [], status: "PUBLISHED", isEnabled: s.isEnabled ?? true, isFeatured: !parentId && i < 4, sortOrder: i });
      if (s.children?.length) walk(s.children, id);
    });
  };
  walk(services, null);
  return out;
}

/* ───────────────────────────── import ───────────────────────────────────── */

export interface ImportResultData {
  businessId: string;
  slug: string;
  warnings: string[];
  counts: Record<string, number>;
}

export async function importBusinessAction(_prev: ActionResult<ImportResultData> | undefined, formData: FormData): Promise<ActionResult<ImportResultData>> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const file = formData.get("file");
    let rawText = str(formData.get("json"));
    if (file instanceof File && file.size > 0) {
      if (file.size > 25 * 1024 * 1024) return fail("The export file is too large (25 MB max).", { file: "Too large" });
      rawText = await file.text();
    }
    if (!rawText) return fail("Choose an export file.", { file: "Required" });
    const snapshot = parseBusinessExport(rawText);
    const o = formToObject(formData);
    const Schema = z.object({
      name: z.string().trim().min(2, "Business name is required").max(120),
      slug: z.string().trim().max(60).optional(),
      organizationMode: z.enum(["new", "existing"]).default("new"),
      organizationId: z.string().optional(),
      organizationName: z.string().trim().max(120).optional(),
      industryId: z.string().optional(),
      ownerEmail: z.string().trim().max(200).optional(),
      ownerName: z.string().trim().max(120).optional(),
      includeProjects: z.boolean().default(true),
      includeReviews: z.boolean().default(true),
      includeTeam: z.boolean().default(true),
      mediaSource: z.enum(["auto", "download", "storage", "none"]).default("auto"),
      publishNow: z.boolean().default(false),
    });
    const input = Schema.parse({
      name: o.name,
      slug: o.slug,
      organizationMode: o.organizationMode,
      organizationId: o.organizationId,
      organizationName: o.organizationName,
      industryId: o.industryId,
      ownerEmail: o.ownerEmail,
      ownerName: o.ownerName,
      includeProjects: o.includeProjects === "on",
      includeReviews: o.includeReviews === "on",
      includeTeam: o.includeTeam === "on",
      mediaSource: o.mediaSource,
      publishNow: o.publishNow === "on",
    });
    if (input.organizationMode === "existing" && !isUuid(input.organizationId ?? "")) return fail("Please correct the highlighted fields.", { organizationId: "Choose an organisation." });
    if (input.slug) {
      const s = slugify(input.slug);
      if (isReservedSlug(s)) return fail("Please correct the highlighted fields.", { slug: "This slug is reserved by the platform." });
      if (await prisma.business.findUnique({ where: { slug: s }, select: { id: true } })) return fail("Please correct the highlighted fields.", { slug: "This slug is already taken." });
    }
    const ownerInvite = input.ownerEmail ? { email: input.ownerEmail.toLowerCase(), name: input.ownerName || input.ownerEmail.split("@")[0] } : undefined;
    if (ownerInvite && !z.string().email().safeParse(ownerInvite.email).success) return fail("Please correct the highlighted fields.", { ownerEmail: "Enter a valid email address." });

    const result = await importBusiness(snapshot, {
      name: input.name,
      slug: input.slug ? slugify(input.slug) : undefined,
      organizationId: input.organizationMode === "existing" ? input.organizationId : undefined,
      organizationName: input.organizationMode === "new" ? input.organizationName || input.name : undefined,
      industryId: input.industryId && isUuid(input.industryId) ? input.industryId : undefined,
      ownerInvite,
      createdByUserId: user.id,
      includeProjects: input.includeProjects,
      includeReviews: input.includeReviews,
      includeTeam: input.includeTeam,
      mediaSource: input.mediaSource,
    });
    const warnings = [...result.warnings];
    if (input.publishNow) {
      try {
        await publishBusiness(result.business.id, { actorUserId: user.id });
      } catch (error) {
        warnings.push(`Imported but not published: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    revalidatePath("/super-admin/businesses");
    revalidatePath("/super-admin");
    return ok({ businessId: result.business.id, slug: result.business.slug, warnings, counts: result.counts }, "Business imported");
  });
}
