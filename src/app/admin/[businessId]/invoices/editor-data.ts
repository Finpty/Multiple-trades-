import type { BusinessContext } from "@/lib/authz";
import { listCustomerOptions } from "@/lib/operations/customers";
import { lineItemsOf } from "@/lib/operations/invoices";
import type { Invoice } from "@prisma/client";
import type { InvoiceEditorValues, PriceListItem } from "@/components/admin/operations/invoices/invoice-editor";

export async function loadInvoiceEditorData(ctx: BusinessContext) {
  const businessId = ctx.business.id;
  const [customers, jobs, quotes, items] = await Promise.all([
    listCustomerOptions(ctx.db, businessId),
    ctx.db.job.findMany({ where: { businessId, deletedAt: null, status: { not: "CANCELED" } }, select: { id: true, number: true, title: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    ctx.db.quote.findMany({ where: { businessId, deletedAt: null, status: { in: ["ACCEPTED", "SENT", "VIEWED"] } }, select: { id: true, number: true, title: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    ctx.db.pricingItem.findMany({ where: { businessId, isActive: true, type: { in: ["RATE", "FEE"] } }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
  ]);
  const priceList: PriceListItem[] = items.map((i) => ({ key: i.key, label: i.label, unit: i.unit, amountCents: Math.round(Number(i.amount) * 100) }));
  return {
    customers: customers.map((c) => ({ id: c.id, label: `${c.label}${c.email ? ` · ${c.email}` : ""}` })),
    jobs: jobs.map((j) => ({ id: j.id, label: `${j.number} — ${j.title}` })),
    quotes: quotes.map((q) => ({ id: q.id, label: `${q.number} — ${q.title}` })),
    priceList,
    tax: { rate: Number(ctx.business.taxRate), inclusive: ctx.business.taxInclusive, name: ctx.business.taxName, currency: ctx.business.currency },
  };
}

export function invoiceToEditorValues(inv: Invoice): InvoiceEditorValues {
  return { invoiceId: inv.id, customerId: inv.customerId, jobId: inv.jobId, quoteId: inv.quoteId, lines: lineItemsOf(inv).map((l) => ({ id: l.id ?? "", description: l.description, quantity: l.quantity, unit: l.unit ?? "", unitCents: l.unitCents })), notes: inv.notes ?? "", dueAt: inv.dueAt ? inv.dueAt.toISOString().slice(0, 10) : "" };
}
