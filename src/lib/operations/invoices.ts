import { platformDb, tenantDb } from "@/lib/db";
import { emitEvent } from "@/lib/events";

/**
 * Marks SENT invoices past their due date as OVERDUE and emits invoice.overdue
 * once per invoice per day (idempotent). Called by the cron runner.
 */
export async function markOverdueInvoices(): Promise<{ marked: number; reminded: number }> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = await platformDb.invoice.findMany({ where: { status: { in: ["SENT", "OVERDUE"] }, dueAt: { lt: today }, deletedAt: null }, select: { id: true, businessId: true, status: true, dueAt: true } });
  let marked = 0;
  let reminded = 0;
  for (const inv of due) {
    const daysOverdue = Math.max(1, Math.floor((today.getTime() - (inv.dueAt?.getTime() ?? today.getTime())) / 86_400_000));
    if (inv.status === "SENT") {
      await tenantDb(inv.businessId).invoice.update({ where: { id: inv.id }, data: { status: "OVERDUE" } });
      marked++;
    }
    // One reminder event per day: skip if an invoice.overdue event exists today for this invoice.
    const already = await platformDb.domainEvent.findFirst({ where: { businessId: inv.businessId, type: "invoice.overdue", createdAt: { gte: today }, payload: { path: ["invoiceId"], equals: inv.id } }, select: { id: true } });
    if (!already) {
      await emitEvent({ type: "invoice.overdue", businessId: inv.businessId, payload: { businessId: inv.businessId, invoiceId: inv.id, daysOverdue } });
      reminded++;
    }
  }
  return { marked, reminded };
}
