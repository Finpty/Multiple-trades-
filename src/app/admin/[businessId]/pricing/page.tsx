import Link from "next/link";
import { requireBusinessAccess } from "@/lib/authz";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { summariseActions, summariseConditions } from "@/lib/pricing/admin";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, TBody, Table, Td, Th, THead, Tabs } from "@/components/ui";
import { PricingItemsTable } from "@/components/admin/config/pricing-items";
import { PricingTest } from "@/components/admin/config/pricing-test";
import { RuleRowActions } from "@/components/admin/config/pricing-rule-actions";
import { archiveItemAction, archiveRuleAction, duplicateRuleAction, quickUpdateItemAction, saveItemAction, testCalcAction, toggleRuleAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing" };

export default async function PricingPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { businessId } = await params;
  const { tab = "items" } = await searchParams;
  const ctx = await requireBusinessAccess(businessId, "pricing.manage");
  const b = `/admin/${businessId}/pricing`;
  const [items, rules, services, estimateFields] = await Promise.all([
    ctx.db.pricingItem.findMany({ where: { businessId }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }], include: { service: { select: { name: true } } } }),
    ctx.db.pricingRule.findMany({ where: { businessId }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], include: { service: { select: { name: true } } } }),
    ctx.db.service.findMany({ where: { businessId, isEnabled: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    listFieldDefinitions(ctx.db, businessId, "ESTIMATE"),
  ]);
  return (
    <>
      <PageHeader title="Pricing" description="Rates, fees and rules that power quotes and the website calculator. Change numbers here — never code." actions={tab === "rules" ? <ButtonLink href={`${b}/rules/new`}>New rule</ButtonLink> : undefined} />
      <Tabs current={tab} items={[{ key: "items", label: "Pricing items", href: `${b}?tab=items` }, { key: "rules", label: "Rules", href: `${b}?tab=rules` }, { key: "test", label: "Test calculator", href: `${b}?tab=test` }]} />
      {tab === "items" && (
        <PricingItemsTable
          businessId={businessId}
          currency={ctx.business.currency}
          items={items.map((i) => ({ id: i.id, key: i.key, label: i.label, type: i.type, amount: Number(i.amount), unit: i.unit, category: i.category, description: i.description, serviceId: i.serviceId, serviceName: i.service?.name ?? null, isActive: i.isActive }))}
          services={services}
          save={saveItemAction}
          quickUpdate={quickUpdateItemAction}
          archive={archiveItemAction}
        />
      )}
      {tab === "rules" && (
        rules.length === 0 ? (
          <div className="space-y-4">
            <Alert tone="info">No rules yet. Without rules the engine uses a sensible default: every RATE with a unit becomes a line item (area × rate, hours × rate…) and the minimum charge applies. Add rules to model complexity, multipliers, conditional fees and more.</Alert>
            <EmptyState title="Create your first pricing rule" description="Example: IF tile_size_mm > 1200 THEN multiply labour by the large-format multiplier." action={<ButtonLink href={`${b}/rules/new`}>New rule</ButtonLink>} />
          </div>
        ) : (
          <Table>
            <THead><tr><Th>Priority</Th><Th>Rule</Th><Th>Service</Th><Th>IF</Th><Th>THEN</Th><Th>Status</Th><Th></Th></tr></THead>
            <TBody>
              {rules.map((r) => (
                <tr key={r.id} className={r.isActive ? "" : "opacity-60"}>
                  <Td>{r.priority}</Td>
                  <Td><Link href={`${b}/rules/${r.id}`} className="font-medium hover:underline">{r.name}</Link>{r.description && <span className="block text-xs text-neutral-500">{r.description}</span>}</Td>
                  <Td className="text-neutral-500">{r.service?.name ?? "All"}</Td>
                  <Td className="max-w-xs text-xs text-neutral-700">{summariseConditions(r.conditions)}</Td>
                  <Td className="max-w-xs text-xs text-neutral-700">{summariseActions(r.actions)}</Td>
                  <Td><Badge tone={r.isActive ? "green" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge></Td>
                  <Td><RuleRowActions businessId={businessId} ruleId={r.id} isActive={r.isActive} toggle={toggleRuleAction} archive={archiveRuleAction} duplicate={duplicateRuleAction} /></Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )
      )}
      {tab === "test" && (
        <Card>
          <CardHeader title="Test calculator" description="Runs exactly the engine used by quotes and the website calculator, with your current items and rules." />
          <CardBody><PricingTest businessId={businessId} currency={ctx.business.currency} services={services} fields={estimateFields} run={testCalcAction} /></CardBody>
        </Card>
      )}
    </>
  );
}
