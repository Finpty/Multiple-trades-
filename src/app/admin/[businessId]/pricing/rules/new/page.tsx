import { requireBusinessAccess } from "@/lib/authz";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { PageHeader } from "@/components/ui";
import { PricingRuleForm } from "@/components/admin/config/pricing-rule-form";
import { saveRuleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewRulePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "pricing.manage");
  const [items, services, fields] = await Promise.all([ctx.db.pricingItem.findMany({ where: { businessId, isActive: true }, orderBy: { sortOrder: "asc" } }), ctx.db.service.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }), listFieldDefinitions(ctx.db, businessId, "ESTIMATE")]);
  return (
    <>
      <PageHeader title="New pricing rule" breadcrumbs={[{ label: "Pricing", href: `/admin/${businessId}/pricing?tab=rules` }, { label: "New rule" }]} />
      <PricingRuleForm action={saveRuleAction.bind(null, businessId, null)} items={items.map((i) => ({ key: i.key, label: i.label, type: i.type }))} services={services} fields={fields.map((f) => ({ key: f.key, label: f.label }))} />
    </>
  );
}
