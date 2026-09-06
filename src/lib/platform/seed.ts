import { platformDb, prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { SYSTEM_ROLES } from "@/lib/authz/permissions";
import { env } from "@/lib/env";
import { toJson } from "@/lib/json";
import { PLATFORM_SETTING_DEFAULTS } from "./settings";
import { FEATURE_DEFINITIONS } from "@/lib/catalog/features";
import { DESIGN_FAMILIES } from "@/lib/catalog/design-families";
import { INDUSTRY_CATALOG } from "@/lib/catalog/industries";

export async function seedSystemRoles() {
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { key: role.key },
      create: { key: role.key, name: role.name, description: role.description, scope: role.scope, permissions: toJson(role.permissions), isSystem: true },
      update: { name: role.name, description: role.description, scope: role.scope, permissions: toJson(role.permissions), isSystem: true },
    });
  }
}

export async function seedPlatformOwner() {
  const e = env();
  const email = e.SEED_OWNER_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.platformRole !== "OWNER") await prisma.user.update({ where: { id: existing.id }, data: { platformRole: "OWNER" } });
    return existing;
  }
  return prisma.user.create({
    data: { email, name: e.SEED_OWNER_NAME, passwordHash: await hashPassword(e.SEED_OWNER_PASSWORD), platformRole: "OWNER", emailVerifiedAt: new Date() },
  });
}

export async function seedPlatformSettings() {
  for (const [key, value] of Object.entries(PLATFORM_SETTING_DEFAULTS)) {
    await prisma.platformSetting.upsert({ where: { key }, create: { key, value: toJson(value) }, update: {} });
  }
}

export async function seedFeatureDefinitions() {
  for (const [i, f] of FEATURE_DEFINITIONS.entries()) {
    await prisma.featureDefinition.upsert({
      where: { key: f.key },
      create: { ...f, sortOrder: i, configSchema: toJson(f.configSchema ?? {}) },
      update: { name: f.name, description: f.description, category: f.category, requiresAi: f.requiresAi ?? false, sortOrder: i },
    });
  }
}

export async function seedDesignFamilies() {
  for (const [i, d] of DESIGN_FAMILIES.entries()) {
    await prisma.designFamily.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, name: d.name, description: d.description, tokens: toJson(d.tokens), isSystem: true, sortOrder: i },
      update: { name: d.name, description: d.description, tokens: toJson(d.tokens), sortOrder: i },
    });
  }
}

export async function seedIndustries() {
  for (const [i, ind] of INDUSTRY_CATALOG.entries()) {
    const data = {
      name: ind.name,
      description: ind.description,
      icon: ind.icon,
      sortOrder: i,
      terminology: toJson(ind.terminology ?? {}),
      defaultServices: toJson(ind.defaultServices ?? []),
      jobFields: toJson(ind.jobFields ?? []),
      estimateFields: toJson(ind.estimateFields ?? []),
      pricingFields: toJson(ind.pricingFields ?? []),
      websiteSections: toJson(ind.websiteSections ?? {}),
      leadQuestions: toJson(ind.leadQuestions ?? []),
      projectStages: toJson(ind.projectStages ?? []),
      defaultFeatures: toJson(ind.defaultFeatures ?? []),
    };
    // System industries are only created, never overwritten: admins may edit them.
    await prisma.industry.upsert({ where: { slug: ind.slug }, create: { slug: ind.slug, isSystem: true, ...data }, update: {} });
  }
}

export async function seedPlatform() {
  await seedSystemRoles();
  const owner = await seedPlatformOwner();
  await seedPlatformSettings();
  await seedFeatureDefinitions();
  await seedDesignFamilies();
  await seedIndustries();
  let demo: string[] = [];
  if (env().SEED_DEMO_BUSINESSES !== "false") {
    const { seedDemoBusinesses } = await import("@/lib/business/demo");
    demo = await seedDemoBusinesses(owner.id);
  }
  const counts = {
    roles: await prisma.role.count(),
    industries: await prisma.industry.count(),
    designFamilies: await prisma.designFamily.count(),
    features: await prisma.featureDefinition.count(),
    businesses: await platformDb.business.count(),
    demo,
  };
  return counts;
}
