import type { FieldEntityType } from "@prisma/client";
import { requireBusinessAccess } from "@/lib/authz";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { Alert, PageHeader, Tabs } from "@/components/ui";
import { CustomFieldsManager } from "@/components/admin/config/custom-fields-manager";
import { archiveDefinitionAction, reorderDefinitionsAction, saveDefinitionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Custom fields" };

const ENTITIES: Array<{ key: FieldEntityType; label: string; hint: string }> = [
  { key: "JOB", label: "Jobs", hint: "Captured on every job (tile size, voltage, roof type…)." },
  { key: "ESTIMATE", label: "Estimates", hint: "Inputs for the pricing engine, quotes and the website calculator." },
  { key: "LEAD", label: "Leads", hint: "Extra questions on enquiries and quote requests." },
  { key: "SERVICE", label: "Services", hint: "Attributes on service pages." },
  { key: "PROJECT", label: "Projects", hint: "Portfolio details (materials, dimensions…)." },
  { key: "CUSTOMER", label: "Customers", hint: "Customer profile fields." },
  { key: "QUOTE", label: "Quotes", hint: "Extra quote information." },
  { key: "BUSINESS", label: "Business", hint: "Business-level attributes." },
];

export default async function CustomFieldsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ entity?: string }> }) {
  const { businessId } = await params;
  const sp = await searchParams;
  const entity = (ENTITIES.find((e) => e.key === sp.entity)?.key ?? "JOB") as FieldEntityType;
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const [defs, usage] = await Promise.all([
    listFieldDefinitions(ctx.db, businessId, entity, { activeOnly: false }),
    ctx.db.customFieldValue.groupBy({ by: ["definitionId"], where: { businessId, entityType: entity }, _count: { _all: true } }),
  ]);
  const usageMap = Object.fromEntries(usage.map((u) => [u.definitionId, u._count._all]));
  const b = `/admin/${businessId}/custom-fields`;
  return (
    <>
      <PageHeader title="Custom fields" description="Every trade captures different information. Define fields here; they appear on the matching forms across the admin and website." />
      <Tabs current={entity} items={ENTITIES.map((e) => ({ key: e.key, label: e.label, href: `${b}?entity=${e.key}` }))} />
      <Alert tone="neutral" className="mb-4">{ENTITIES.find((e) => e.key === entity)?.hint}</Alert>
      <CustomFieldsManager businessId={businessId} entityType={entity} definitions={defs} usage={usageMap} save={saveDefinitionAction} reorder={reorderDefinitionsAction} archive={archiveDefinitionAction} />
    </>
  );
}
