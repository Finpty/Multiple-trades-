import { requirePlatformAdmin } from "@/lib/authz";
import { prisma, platformDb } from "@/lib/db";
import { env } from "@/lib/env";
import { asArray, asObject } from "@/lib/json";
import { getPlatformSetting } from "@/lib/platform/settings";
import { DEFAULT_THEME_TOKENS, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";
import { listActiveTemplateCards } from "@/lib/business/templates";
import { isUuid } from "@/lib/ids";
import { ButtonLink, PageHeader } from "@/components/ui";
import { CreateBusinessWizard } from "@/components/super-admin/wizard/wizard";
import type { WizardCatalog } from "@/components/super-admin/wizard/types";

export const dynamic = "force-dynamic";

export default async function CreateBusinessPage({ searchParams }: { searchParams: Promise<{ template?: string; industry?: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const sp = await searchParams;
  const [industries, templates, designFamilies, features, organizations, aiEnabled, defaultCountry, defaultCurrency, defaultTimezone] = await Promise.all([
    prisma.industry.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    listActiveTemplateCards(),
    prisma.designFamily.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.featureDefinition.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    platformDb.organization.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getPlatformSetting<boolean>("ai.enabled", false),
    getPlatformSetting<string>("platform.defaultCountry", "AU"),
    getPlatformSetting<string>("platform.defaultCurrency", "AUD"),
    getPlatformSetting<string>("platform.defaultTimezone", "Australia/Perth"),
  ]);

  const countServices = (seed: unknown[]): number => seed.reduce<number>((n, s) => n + 1 + (s && typeof s === "object" && Array.isArray((s as { children?: unknown[] }).children) ? countServices((s as { children: unknown[] }).children) : 0), 0);
  let platformHost = "localhost:3000";
  try {
    platformHost = new URL(env().PLATFORM_URL).host;
  } catch {
    /* keep default */
  }

  const catalog: WizardCatalog = {
    industries: industries.map((i) => ({ id: i.id, slug: i.slug, name: i.name, description: i.description, icon: i.icon, serviceCount: countServices(asArray(i.defaultServices)), defaultServices: asArray(i.defaultServices), pricingFields: asArray(i.pricingFields), defaultFeatures: asArray<string>(i.defaultFeatures) })),
    templates,
    designFamilies: designFamilies.map((f) => ({ id: f.id, slug: f.slug, name: f.name, description: f.description, tokens: mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>(f.tokens)) })),
    features: features.map((f) => ({ key: f.key, name: f.name, description: f.description, category: f.category, defaultEnabled: f.defaultEnabled, requiresAi: f.requiresAi, isPlatformOnly: f.isPlatformOnly })),
    organizations,
    platformUrl: env().PLATFORM_URL.replace(/\/$/, ""),
    platformHost,
    aiEnabled: !!aiEnabled,
    defaults: { country: defaultCountry || "AU", currency: defaultCurrency || "AUD", timezone: defaultTimezone || "Australia/Perth" },
  };

  return (
    <div>
      <PageHeader
        title="Create business"
        description="Generate a complete business — website, services, pricing, forms, workflow and admin — from an industry definition. Everything can be changed later from the business admin."
        actions={
          <>
            <ButtonLink href="/super-admin/create-business/import" variant="secondary">Import from file</ButtonLink>
            <ButtonLink href="/super-admin/templates" variant="secondary">Templates</ButtonLink>
          </>
        }
      />
      <CreateBusinessWizard catalog={catalog} initialTemplateId={isUuid(sp.template) ? sp.template : null} initialIndustryId={isUuid(sp.industry) ? sp.industry : null} />
    </div>
  );
}
