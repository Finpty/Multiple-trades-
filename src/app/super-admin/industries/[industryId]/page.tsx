import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { businessesUsingIndustry, getIndustry, SYSTEM_PAGE_KEYS, TERMINOLOGY_KEYS, type IndustrySection } from "@/lib/platform/industries";
import { prisma } from "@/lib/db";
import { asArray, asObject } from "@/lib/json";
import { Badge, Card, CardBody, CardHeader, PageHeader, Tabs, Alert } from "@/components/ui";
import { IndustryGeneralForm } from "@/components/super-admin/catalog/industry-general-form";
import { SectionForm } from "@/components/super-admin/catalog/section-form";
import { FeaturesEditor, FieldsEditor, PricingEditor, ServicesEditor, StagesEditor, TerminologyEditor, WebsiteSectionsEditor } from "@/components/super-admin/catalog/industry-editors";
import { IndustryActions } from "@/components/super-admin/catalog/industry-actions";
import { defaultSystemPages } from "@/lib/business/defaults";
import { updateGeneralAction, updateSectionAction } from "../actions";
import Link from "next/link";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";

const TABS: Array<{ key: string; label: string }> = [
  { key: "general", label: "General" },
  { key: "terminology", label: "Terminology" },
  { key: "services", label: "Default services" },
  { key: "jobFields", label: "Job fields" },
  { key: "estimateFields", label: "Estimate fields" },
  { key: "leadQuestions", label: "Lead questions" },
  { key: "pricingFields", label: "Pricing" },
  { key: "projectStages", label: "Project stages" },
  { key: "websiteSections", label: "Website sections" },
  { key: "defaultFeatures", label: "Features" },
  { key: "usage", label: "Businesses" },
];

export default async function IndustryEditorPage({ params, searchParams }: { params: Promise<{ industryId: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { industryId } = await params;
  if (!isUuid(industryId)) notFound();
  const { tab = "general" } = await searchParams;
  const industry = await getIndustry(industryId);
  if (!industry) notFound();
  const features = await prisma.featureDefinition.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  const base = `/super-admin/industries/${industryId}`;
  const bound = (section: IndustrySection) => updateSectionAction.bind(null, industryId, section);
  const platformDefaults = Object.fromEntries(defaultSystemPages({ name: "Example Business", industryName: industry.name, terminology: asObject(industry.terminology) }).map((p) => [p.systemKey, p.sections]));

  return (
    <>
      <PageHeader
        title={industry.name}
        description={industry.description ?? "Configure everything a business in this industry inherits on creation."}
        breadcrumbs={[{ label: "Industries", href: "/super-admin/industries" }, { label: industry.name }]}
        actions={<><Badge tone={industry.isActive ? "green" : "neutral"}>{industry.isActive ? "Active" : "Inactive"}</Badge><IndustryActions industryId={industryId} isActive={industry.isActive} businesses={industry._count.businesses} /></>}
      />
      <Tabs items={TABS.map((t) => ({ key: t.key, label: t.label, href: `${base}?tab=${t.key}` }))} current={tab} />
      {tab === "general" && (
        <Card className="max-w-2xl"><CardBody><IndustryGeneralForm action={updateGeneralAction.bind(null, industryId)} submitLabel="Save" initial={{ name: industry.name, slug: industry.slug, description: industry.description ?? "", icon: industry.icon ?? "wrench", isActive: industry.isActive, sortOrder: industry.sortOrder }} /></CardBody></Card>
      )}
      {tab === "terminology" && (
        <SectionForm action={bound("terminology")} title="Terminology" description="Words the admin and website use for this trade (e.g. a plumber's 'Job' vs a builder's 'Project').">
          <TerminologyEditor initial={asObject<Record<string, string>>(industry.terminology)} keys={TERMINOLOGY_KEYS} />
        </SectionForm>
      )}
      {tab === "services" && (
        <SectionForm action={bound("services")} title="Default services" description="Created for every new business in this industry; the business can edit them afterwards. Nest sub-services under a parent.">
          <ServicesEditor initial={asArray(industry.defaultServices)} />
        </SectionForm>
      )}
      {tab === "jobFields" && (
        <SectionForm action={bound("jobFields")} title="Job fields" description="Custom fields captured on every job (e.g. tile size, voltage, roof type).">
          <FieldsEditor initial={asArray(industry.jobFields)} />
        </SectionForm>
      )}
      {tab === "estimateFields" && (
        <SectionForm action={bound("estimateFields")} title="Estimate fields" description="Inputs the pricing engine and website calculator ask for (e.g. area in m², number of points).">
          <FieldsEditor initial={asArray(industry.estimateFields)} />
        </SectionForm>
      )}
      {tab === "leadQuestions" && (
        <SectionForm action={bound("leadQuestions")} title="Lead questions" description="Extra questions appended to the default quote-request form.">
          <FieldsEditor initial={asArray(industry.leadQuestions)} />
        </SectionForm>
      )}
      {tab === "pricingFields" && (
        <SectionForm action={bound("pricingFields")} title="Pricing items" description="Rates, fees, multipliers and percentages every new business starts with. Amounts are in dollars (or the business currency).">
          <PricingEditor initial={asArray(industry.pricingFields)} />
        </SectionForm>
      )}
      {tab === "projectStages" && (
        <SectionForm action={bound("projectStages")} title="Project stages" description="The default job workflow. The last stage (or any stage marked terminal) completes the job.">
          <StagesEditor initial={asArray(industry.projectStages)} />
        </SectionForm>
      )}
      {tab === "websiteSections" && (
        <SectionForm action={bound("websiteSections")} title="Website sections" description="Override the blocks generated for each system page. Pages without an override use the platform default shown.">
          <WebsiteSectionsEditor initial={asObject(industry.websiteSections)} pageKeys={[...SYSTEM_PAGE_KEYS]} platformDefaults={platformDefaults as Record<string, Array<{ type: string; props: Record<string, unknown> }>>} />
        </SectionForm>
      )}
      {tab === "defaultFeatures" && (
        <SectionForm action={bound("defaultFeatures")} title="Default features" description="Features switched on for new businesses in this industry. Each business can change them later.">
          <FeaturesEditor initial={asArray<string>(industry.defaultFeatures)} features={features.map((f) => ({ key: f.key, name: f.name, description: f.description ?? "", category: f.category, requiresAi: f.requiresAi }))} />
        </SectionForm>
      )}
      {tab === "usage" && <UsageTab industryId={industryId} />}
    </>
  );
}

async function UsageTab({ industryId }: { industryId: string }) {
  const rows = await businessesUsingIndustry(industryId);
  return (
    <Card>
      <CardHeader title="Businesses using this industry" description={`${rows.length} business(es)`} />
      <CardBody>
        {rows.length === 0 ? (
          <Alert tone="neutral">No businesses yet. Create one from <Link href="/super-admin/create-business" className="underline">Create Business</Link>.</Alert>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm"><Link href={`/super-admin/businesses/${b.id}`} className="font-medium hover:underline">{b.name}</Link><span className="text-neutral-500">/{b.slug} · {b.status}</span></li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
