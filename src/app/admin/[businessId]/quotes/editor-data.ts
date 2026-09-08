import type { BusinessContext } from "@/lib/authz";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { listCustomerOptions } from "@/lib/operations/customers";
import { asObject } from "@/lib/json";
import { lineItemsOf, quoteDepositPercent } from "@/lib/operations/quotes";
import type { Quote } from "@prisma/client";
import type { PriceListItem, QuoteEditorValues } from "@/components/admin/operations/quotes/quote-editor";

export async function loadQuoteEditorData(ctx: BusinessContext) {
  const businessId = ctx.business.id;
  const [customers, items, services, estimateFields] = await Promise.all([
    listCustomerOptions(ctx.db, businessId),
    ctx.db.pricingItem.findMany({ where: { businessId, isActive: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }] }),
    ctx.db.service.findMany({ where: { businessId, isEnabled: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listFieldDefinitions(ctx.db, businessId, "ESTIMATE"),
  ]);
  const priceList: PriceListItem[] = items.filter((i) => i.type === "RATE" || i.type === "FEE").map((i) => ({ key: i.key, label: i.label, unit: i.unit, amountCents: Math.round(Number(i.amount) * 100), category: i.category, type: i.type }));
  return {
    customers: customers.map((c) => ({ id: c.id, label: `${c.label}${c.email ? ` · ${c.email}` : ""}` })),
    priceList,
    services,
    estimateFields,
    tax: { rate: Number(ctx.business.taxRate), inclusive: ctx.business.taxInclusive, name: ctx.business.taxName, currency: ctx.business.currency },
  };
}

export function quoteToEditorValues(q: Quote): QuoteEditorValues {
  return {
    quoteId: q.id,
    customerId: q.customerId,
    leadId: q.leadId,
    title: q.title,
    lines: lineItemsOf(q).map((l) => ({ id: l.id ?? "", description: l.description, quantity: l.quantity, unit: l.unit ?? "", unitCents: l.unitCents, pricingItemKey: l.pricingItemKey })),
    notes: q.notes ?? "",
    terms: q.terms ?? "",
    validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : "",
    depositPercent: quoteDepositPercent(q),
    inputs: asObject<Record<string, unknown>>(q.inputs),
  };
}
