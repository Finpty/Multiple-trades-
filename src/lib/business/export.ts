import type { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/db";
import { asObject } from "@/lib/json";
import { resolveMediaUrl } from "@/lib/storage";
import { env } from "@/lib/env";
import type { ThemeTokens } from "@/lib/theme/tokens";

/**
 * Business configuration export (version 1).
 *
 * Contains everything that makes a business *look and work* the way it does:
 * details, theme, features, services, areas, materials, pages, navigation,
 * forms, workflows, custom fields, pricing, automations, team, reviews,
 * projects, media metadata and redirects.
 *
 * It NEVER contains private transactional data: customers, leads, quotes,
 * jobs, invoices, payments, bookings, submissions, messages, audit logs,
 * events, domains, memberships, API keys, integrations or AI keys.
 *
 * Media bytes are not embedded; every media item carries a `downloadUrl`
 * (and its storage reference) so an importer can fetch the bytes.
 */
export const BUSINESS_EXPORT_VERSION = 1 as const;

type Json = Prisma.JsonValue;

export interface ExportBusinessDetails {
  name: string;
  slug: string;
  legalName: string | null;
  tradingName: string | null;
  businessNumber: string | null;
  taxNumber: string | null;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  foundedYear: number | null;
  country: string;
  state: string | null;
  timezone: string;
  currency: string;
  locale: string;
  taxName: string;
  taxRate: number;
  taxInclusive: boolean;
  serviceAreaText: string | null;
  industrySlug: string | null;
  industryName: string | null;
  logoMediaId: string | null;
  settings: Record<string, unknown>;
  seoDefaults: Record<string, unknown>;
}

export interface ExportLocation {
  name: string;
  isPrimary: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  openingHours: Json;
  serviceRadiusKm: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ExportService {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  icon: string | null;
  pricingMethod: string;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  priceUnit: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  faqs: Json;
  seo: Json;
  customFields: Json;
  featuredMediaId: string | null;
  videoMediaId: string | null;
  gallery: Json;
  status: string;
  isEnabled: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export interface ExportServiceArea {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  slug: string;
  postcode: string | null;
  state: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
  isPrimary: boolean;
  isEnabled: boolean;
  generatePage: boolean;
  content: Json;
  seo: Json;
  sortOrder: number;
}

export interface ExportMaterial {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  mediaId: string | null;
  attributes: Json;
  sortOrder: number;
  isActive: boolean;
}

export interface ExportPageSection {
  type: string;
  sortOrder: number;
  props: Json;
  settings: Json;
  isHidden: boolean;
}

export interface ExportPage {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  kind: string;
  systemKey: string | null;
  templateKey: string;
  status: string;
  audience: string;
  showInNav: boolean;
  sortOrder: number;
  seo: Json;
  settings: Json;
  sections: ExportPageSection[];
}

export interface ExportNavigation {
  key: string;
  name: string;
  draft: Json;
}

export interface ExportForm {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  action: string;
  fields: Json;
  settings: Json;
  isActive: boolean;
}

export interface ExportWorkflow {
  id: string;
  serviceId: string | null;
  key: string;
  name: string;
  description: string | null;
  stages: Json;
  isDefault: boolean;
}

export interface ExportCustomField {
  entityType: string;
  key: string;
  label: string;
  type: string;
  options: Json;
  isRequired: boolean;
  helpText: string | null;
  groupName: string | null;
  defaultValue: Json | null;
  validation: Json;
  showOnForms: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface ExportPricingItem {
  id: string;
  serviceId: string | null;
  key: string;
  label: string;
  type: string;
  amount: number;
  unit: string | null;
  category: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ExportPricingRule {
  serviceId: string | null;
  name: string;
  description: string | null;
  priority: number;
  conditions: Json;
  actions: Json;
  isActive: boolean;
}

export interface ExportAutomationRule {
  name: string;
  description: string | null;
  triggerEvent: string;
  conditions: Json;
  actions: Json;
  isActive: boolean;
}

export interface ExportTeamMember {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  mediaId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ExportReview {
  projectId: string | null;
  serviceId: string | null;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  source: string | null;
  reviewedAt: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export interface ExportProject {
  id: string;
  serviceAreaId: string | null;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  locationText: string | null;
  projectSize: string | null;
  completionDate: string | null;
  challenges: string | null;
  solutions: string | null;
  testimonial: string | null;
  testimonialAuthor: string | null;
  materials: Json;
  customFields: Json;
  featuredMediaId: string | null;
  videoMediaId: string | null;
  status: string;
  isFeatured: boolean;
  sortOrder: number;
  seo: Json;
  media: Array<{ mediaId: string; stage: string; caption: string | null; sortOrder: number }>;
  serviceIds: string[];
}

export interface ExportMedia {
  id: string;
  kind: string;
  visibility: string;
  storageDriver: string;
  storageKey: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  title: string | null;
  altText: string | null;
  caption: string | null;
  tags: Json;
  metadata: Json;
  variants: Json;
  sortOrder: number;
  /** Resolved URL to fetch the original bytes (may be signed and short-lived). */
  downloadUrl: string | null;
}

export interface BusinessExportV1 {
  version: typeof BUSINESS_EXPORT_VERSION;
  exportedAt: string;
  platform: { url: string; storageDriver: string };
  business: ExportBusinessDetails;
  locations: ExportLocation[];
  theme: { designFamilySlug: string | null; draft: Partial<ThemeTokens> };
  features: Array<{ featureKey: string; isEnabled: boolean; config: Json }>;
  services: ExportService[];
  serviceAreas: ExportServiceArea[];
  serviceAreaServices: Array<{ serviceAreaId: string; serviceId: string }>;
  materials: ExportMaterial[];
  serviceMaterials: Array<{ serviceId: string; materialId: string }>;
  pages: ExportPage[];
  navigation: ExportNavigation[];
  forms: ExportForm[];
  workflows: ExportWorkflow[];
  customFieldDefinitions: ExportCustomField[];
  pricingItems: ExportPricingItem[];
  pricingRules: ExportPricingRule[];
  automationRules: ExportAutomationRule[];
  teamMembers: ExportTeamMember[];
  reviews: ExportReview[];
  projects: ExportProject[];
  media: ExportMedia[];
  redirects: Array<{ fromPath: string; toPath: string; statusCode: number; isActive: boolean }>;
  seoDefaults: Record<string, unknown>;
  settings: Array<{ key: string; value: Json }>;
}

export interface ExportOptions {
  /** Include portfolio projects (and their media links). Default true. */
  includeProjects?: boolean;
  /** Include reviews. Default true. */
  includeReviews?: boolean;
  /** Include media metadata. Default true. Media referenced by content is always listed. */
  includeMedia?: boolean;
  /** Resolve a downloadUrl for each media item. Default true. */
  resolveMediaUrls?: boolean;
}

const dateOnly = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const dec = (d: Prisma.Decimal | null | undefined) => (d === null || d === undefined ? null : Number(d));

/**
 * Snapshot a business's configuration. Runs with the platform client, so the
 * caller must have passed `requirePlatformAdmin()` or `requireBusinessAccess(id,
 * "export.manage")` for that business before calling.
 */
export async function exportBusiness(businessId: string, options: ExportOptions = {}): Promise<BusinessExportV1> {
  const includeProjects = options.includeProjects ?? true;
  const includeReviews = options.includeReviews ?? true;
  const includeMedia = options.includeMedia ?? true;
  const resolveUrls = options.resolveMediaUrls ?? true;
  const db = platformDb;

  const business = await db.business.findFirst({ where: { id: businessId, deletedAt: null }, include: { industry: true, theme: { include: { designFamily: true } } } });
  if (!business) throw new Error("Business not found.");
  const where = { businessId };

  const [locations, features, services, serviceAreas, serviceAreaServices, materials, serviceMaterials, pages, navigation, forms, workflows, customFields, pricingItems, pricingRules, automationRules, teamMembers, reviews, projects, redirects, settings] = await Promise.all([
    db.businessLocation.findMany({ where, orderBy: { sortOrder: "asc" } }),
    db.businessFeature.findMany({ where }),
    db.service.findMany({ where, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }] }),
    db.serviceArea.findMany({ where, orderBy: { sortOrder: "asc" } }),
    db.serviceAreaService.findMany({ where }),
    db.material.findMany({ where, orderBy: { sortOrder: "asc" } }),
    db.serviceMaterial.findMany({ where: { service: { businessId } } }),
    db.page.findMany({ where: { ...where, status: { not: "ARCHIVED" } }, orderBy: { sortOrder: "asc" }, include: { sections: { orderBy: { sortOrder: "asc" } } } }),
    db.navigationMenu.findMany({ where }),
    db.form.findMany({ where }),
    db.workflow.findMany({ where }),
    db.customFieldDefinition.findMany({ where, orderBy: { sortOrder: "asc" } }),
    db.pricingItem.findMany({ where, orderBy: { sortOrder: "asc" } }),
    db.pricingRule.findMany({ where, orderBy: { priority: "asc" } }),
    db.automationRule.findMany({ where }),
    db.teamMember.findMany({ where, orderBy: { sortOrder: "asc" } }),
    includeReviews ? db.review.findMany({ where, orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
    includeProjects ? db.project.findMany({ where, orderBy: { sortOrder: "asc" }, include: { media: { orderBy: { sortOrder: "asc" } }, services: true } }) : Promise.resolve([]),
    db.redirect.findMany({ where }),
    db.businessSetting.findMany({ where }),
  ]);

  const mediaRows = includeMedia ? await db.media.findMany({ where, orderBy: { createdAt: "asc" } }) : [];
  const media: ExportMedia[] = [];
  for (const m of mediaRows) {
    let downloadUrl: string | null = null;
    if (resolveUrls) {
      try {
        downloadUrl = await resolveMediaUrl(m, 60 * 60 * 24);
        if (downloadUrl.startsWith("/")) downloadUrl = `${env().PLATFORM_URL.replace(/\/$/, "")}${downloadUrl}`;
      } catch {
        downloadUrl = null;
      }
    }
    media.push({
      id: m.id,
      kind: m.kind,
      visibility: m.visibility,
      storageDriver: m.storageDriver,
      storageKey: m.storageKey,
      filename: m.filename,
      originalName: m.originalName,
      mimeType: m.mimeType,
      sizeBytes: Number(m.sizeBytes),
      width: m.width,
      height: m.height,
      durationSeconds: m.durationSeconds,
      title: m.title,
      altText: m.altText,
      caption: m.caption,
      tags: m.tags,
      metadata: m.metadata,
      variants: m.variants,
      sortOrder: m.sortOrder,
      downloadUrl,
    });
  }

  const theme = business.theme;
  return {
    version: BUSINESS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    platform: { url: env().PLATFORM_URL, storageDriver: env().MEDIA_STORAGE_DRIVER },
    business: {
      name: business.name,
      slug: business.slug,
      legalName: business.legalName,
      tradingName: business.tradingName,
      businessNumber: business.businessNumber,
      taxNumber: business.taxNumber,
      tagline: business.tagline,
      description: business.description,
      phone: business.phone,
      email: business.email,
      website: business.website,
      foundedYear: business.foundedYear,
      country: business.country,
      state: business.state,
      timezone: business.timezone,
      currency: business.currency,
      locale: business.locale,
      taxName: business.taxName,
      taxRate: Number(business.taxRate),
      taxInclusive: business.taxInclusive,
      serviceAreaText: business.serviceAreaText,
      industrySlug: business.industry?.slug ?? null,
      industryName: business.industry?.name ?? null,
      logoMediaId: business.logoMediaId,
      settings: asObject(business.settings),
      seoDefaults: asObject(business.seoDefaults),
    },
    locations: locations.map((l) => ({ name: l.name, isPrimary: l.isPrimary, addressLine1: l.addressLine1, addressLine2: l.addressLine2, city: l.city, state: l.state, postcode: l.postcode, country: l.country, phone: l.phone, email: l.email, openingHours: l.openingHours, serviceRadiusKm: l.serviceRadiusKm, isActive: l.isActive, sortOrder: l.sortOrder })),
    theme: { designFamilySlug: theme?.designFamily?.slug ?? null, draft: asObject<Partial<ThemeTokens>>(theme?.draft ?? null) },
    features: features.map((f) => ({ featureKey: f.featureKey, isEnabled: f.isEnabled, config: f.config })),
    services: services.map((s) => ({ id: s.id, parentId: s.parentId, name: s.name, slug: s.slug, shortDescription: s.shortDescription, description: s.description, icon: s.icon, pricingMethod: s.pricingMethod, priceMinCents: s.priceMinCents, priceMaxCents: s.priceMaxCents, priceUnit: s.priceUnit, ctaLabel: s.ctaLabel, ctaHref: s.ctaHref, faqs: s.faqs, seo: s.seo, customFields: s.customFields, featuredMediaId: s.featuredMediaId, videoMediaId: s.videoMediaId, gallery: s.gallery, status: s.status, isEnabled: s.isEnabled, isFeatured: s.isFeatured, sortOrder: s.sortOrder })),
    serviceAreas: serviceAreas.map((a) => ({ id: a.id, parentId: a.parentId, type: a.type, name: a.name, slug: a.slug, postcode: a.postcode, state: a.state, country: a.country, lat: dec(a.lat), lng: dec(a.lng), radiusKm: a.radiusKm, isPrimary: a.isPrimary, isEnabled: a.isEnabled, generatePage: a.generatePage, content: a.content, seo: a.seo, sortOrder: a.sortOrder })),
    serviceAreaServices: serviceAreaServices.map((x) => ({ serviceAreaId: x.serviceAreaId, serviceId: x.serviceId })),
    materials: materials.map((m) => ({ id: m.id, name: m.name, slug: m.slug, category: m.category, description: m.description, mediaId: m.mediaId, attributes: m.attributes, sortOrder: m.sortOrder, isActive: m.isActive })),
    serviceMaterials: serviceMaterials.map((x) => ({ serviceId: x.serviceId, materialId: x.materialId })),
    pages: pages.map((p) => ({ id: p.id, parentId: p.parentId, slug: p.slug, title: p.title, kind: p.kind, systemKey: p.systemKey, templateKey: p.templateKey, status: p.status, audience: p.audience, showInNav: p.showInNav, sortOrder: p.sortOrder, seo: p.seo, settings: p.settings, sections: p.sections.map((s) => ({ type: s.type, sortOrder: s.sortOrder, props: s.props, settings: s.settings, isHidden: s.isHidden })) })),
    navigation: navigation.map((n) => ({ key: n.key, name: n.name, draft: n.draft })),
    forms: forms.map((f) => ({ id: f.id, name: f.name, slug: f.slug, description: f.description, action: f.action, fields: f.fields, settings: f.settings, isActive: f.isActive })),
    workflows: workflows.map((w) => ({ id: w.id, serviceId: w.serviceId, key: w.key, name: w.name, description: w.description, stages: w.stages, isDefault: w.isDefault })),
    customFieldDefinitions: customFields.map((c) => ({ entityType: c.entityType, key: c.key, label: c.label, type: c.type, options: c.options, isRequired: c.isRequired, helpText: c.helpText, groupName: c.groupName, defaultValue: c.defaultValue ?? null, validation: c.validation, showOnForms: c.showOnForms, sortOrder: c.sortOrder, isActive: c.isActive })),
    pricingItems: pricingItems.map((p) => ({ id: p.id, serviceId: p.serviceId, key: p.key, label: p.label, type: p.type, amount: Number(p.amount), unit: p.unit, category: p.category, description: p.description, sortOrder: p.sortOrder, isActive: p.isActive })),
    pricingRules: pricingRules.map((r) => ({ serviceId: r.serviceId, name: r.name, description: r.description, priority: r.priority, conditions: r.conditions, actions: r.actions, isActive: r.isActive })),
    automationRules: automationRules.map((r) => ({ name: r.name, description: r.description, triggerEvent: r.triggerEvent, conditions: r.conditions, actions: r.actions, isActive: r.isActive })),
    teamMembers: teamMembers.map((t) => ({ id: t.id, name: t.name, role: t.role, bio: t.bio, email: t.email, phone: t.phone, mediaId: t.mediaId, sortOrder: t.sortOrder, isActive: t.isActive })),
    reviews: reviews.map((r) => ({ projectId: r.projectId, serviceId: r.serviceId, authorName: r.authorName, rating: r.rating, title: r.title, body: r.body, source: r.source, reviewedAt: dateOnly(r.reviewedAt), isPublished: r.isPublished, isFeatured: r.isFeatured, sortOrder: r.sortOrder })),
    projects: projects.map((p) => ({ id: p.id, serviceAreaId: p.serviceAreaId, title: p.title, slug: p.slug, summary: p.summary, description: p.description, locationText: p.locationText, projectSize: p.projectSize, completionDate: dateOnly(p.completionDate), challenges: p.challenges, solutions: p.solutions, testimonial: p.testimonial, testimonialAuthor: p.testimonialAuthor, materials: p.materials, customFields: p.customFields, featuredMediaId: p.featuredMediaId, videoMediaId: p.videoMediaId, status: p.status, isFeatured: p.isFeatured, sortOrder: p.sortOrder, seo: p.seo, media: p.media.map((m) => ({ mediaId: m.mediaId, stage: m.stage, caption: m.caption, sortOrder: m.sortOrder })), serviceIds: p.services.map((s) => s.serviceId) })),
    media,
    redirects: redirects.map((r) => ({ fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode, isActive: r.isActive })),
    seoDefaults: asObject(business.seoDefaults),
    settings: settings.map((s) => ({ key: s.key, value: s.value })),
  };
}

/** Human-readable counts for previews (import page, template list). */
export function summariseExport(snapshot: BusinessExportV1): Record<string, number> {
  return {
    services: snapshot.services.length,
    serviceAreas: snapshot.serviceAreas.length,
    pages: snapshot.pages.length,
    forms: snapshot.forms.length,
    pricingItems: snapshot.pricingItems.length,
    pricingRules: snapshot.pricingRules.length,
    automationRules: snapshot.automationRules.length,
    customFields: snapshot.customFieldDefinitions.length,
    teamMembers: snapshot.teamMembers.length,
    reviews: snapshot.reviews.length,
    projects: snapshot.projects.length,
    media: snapshot.media.length,
    materials: snapshot.materials.length,
    features: snapshot.features.filter((f) => f.isEnabled).length,
  };
}

/** Filename for downloads: <slug>-export-<date>.json */
export function exportFilename(snapshot: BusinessExportV1): string {
  return `${snapshot.business.slug}-export-${snapshot.exportedAt.slice(0, 10)}.json`;
}
