import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { PricingRuleForm } from "@/components/admin/config/pricing-rule-form";
import { saveRuleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditRulePage({ params }: { params: Promise<{ businessId: string; ruleId: string }> }) {
  const { businessId, ruleId } = await params;
  if (!isUuid(ruleId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "pricing.manage");
  const rule = await ctx.db.pricingRule.findFirst({ where: { id: ruleId, businessId } });
  if (!rule) notFound();
  const [items, services, fields] = await Promise.all([ctx.db.pricingItem.findMany({ where: { businessId, isActive: true }, orderBy: { sortOrder: "asc" } }), ctx.db.service.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }), listFieldDefinitions(ctx.db, businessId, "ESTIMATE")]);
  return (
    <>
      <PageHeader title={rule.name} breadcrumbs={[{ label: "Pricing", href: `/admin/${businessId}/pricing?tab=rules` }, { label: rule.name }]} />
      <PricingRuleForm action={saveRuleAction.bind(null, businessId, ruleId)} initial={{ name: rule.name, description: rule.description ?? "", priority: rule.priority, serviceId: rule.serviceId, conditions: rule.conditions as never, actions: rule.actions as never, isActive: rule.isActive }} items={items.map((i) => ({ key: i.key, label: i.label, type: i.type }))} services={services} fields={fields.map((f) => ({ key: f.key, label: f.label }))} />
    </>
  );
}
