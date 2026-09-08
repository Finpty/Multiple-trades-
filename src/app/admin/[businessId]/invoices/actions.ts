"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, num, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { platformUrl } from "@/lib/site/context";
import { resolveCustomerFromForm } from "@/lib/operations/customers";
import { InvoiceInputSchema, PaymentInputSchema, archiveInvoice, createInvoice, duplicateInvoice, recordPayment, sendInvoice, updateInvoice, voidInvoice } from "@/lib/operations/invoices";

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}
function revalidate(businessId: string, invoiceId?: string) {
  revalidatePath(`/admin/${businessId}/invoices`);
  if (invoiceId) revalidatePath(`/admin/${businessId}/invoices/${invoiceId}`);
  revalidatePath(`/admin/${businessId}/customers`);
  revalidatePath(`/admin/${businessId}/jobs`);
  revalidatePath(`/admin/${businessId}/quotes`);
}

export async function saveInvoiceAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "invoices.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const invoiceId = optStr(obj.invoiceId);
    const customerId = await resolveCustomerFromForm(ctx.db, businessId, obj, ctx.user.id);
    const input = InvoiceInputSchema.parse({
      customerId,
      jobId: optStr(obj.jobId) ?? null,
      quoteId: optStr(obj.quoteId) ?? null,
      dueAt: optStr(obj.dueAt) ? new Date(`${str(obj.dueAt)}T00:00:00Z`) : null,
      notes: optStr(obj.notes),
      lineItems: obj.lineItems,
    });
    const invoice = invoiceId ? await updateInvoice(businessId, idFrom(invoiceId, "invoice"), input, { actorUserId: ctx.user.id }) : await createInvoice(businessId, input, { actorUserId: ctx.user.id });
    revalidate(businessId, invoice.id);
    return ok({ id: invoice.id }, invoiceId ? "Invoice updated" : "Invoice created");
  });
}

export async function invoiceStateAction(businessId: string, invoiceId: string, state: "send" | "void" | "archive" | "duplicate"): Promise<ActionResult<{ id?: string; note?: string }>> {
  return runAction<{ id?: string; note?: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "invoices.manage", { throwOnly: true });
    const id = idFrom(invoiceId, "invoice");
    const actor = { actorUserId: ctx.user.id };
    switch (state) {
      case "send": {
        const inv = await ctx.db.invoice.findFirst({ where: { id, businessId }, select: { publicToken: true } });
        if (!inv) throw new Error("Invoice not found.");
        const r = await sendInvoice(businessId, id, { ...actor, publicUrl: platformUrl(`/i/${inv.publicToken}`) });
        revalidate(businessId, id);
        return ok({ note: r.emailed ? `Sent to ${r.to}.` : r.to ? `Marked as sent; the email to ${r.to} could not be delivered.` : "Marked as sent. The customer has no email — share the link manually." }, r.emailed ? `Invoice emailed to ${r.to}` : "Invoice marked as sent");
      }
      case "void": await voidInvoice(businessId, id, actor); revalidate(businessId, id); return ok({}, "Invoice voided");
      case "archive": await archiveInvoice(businessId, id, actor); revalidate(businessId, id); return ok({}, "Invoice archived");
      case "duplicate": { const copy = await duplicateInvoice(businessId, id, actor); revalidate(businessId, copy.id); return ok({ id: copy.id }, `Copied as ${copy.number}`); }
    }
  });
}

export async function recordPaymentAction(businessId: string, invoiceId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "invoices.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const input = PaymentInputSchema.parse({ amountCents: Math.round((num(obj.amount) ?? 0) * 100), method: str(obj.method) || "bank_transfer", receivedAt: optStr(obj.receivedAt) ? new Date(`${str(obj.receivedAt)}T12:00:00Z`) : new Date(), reference: optStr(obj.reference) });
    const r = await recordPayment(businessId, idFrom(invoiceId, "invoice"), input, { actorUserId: ctx.user.id });
    revalidate(businessId, invoiceId);
    return ok(undefined, r.invoice.status === "PAID" ? "Payment recorded — invoice paid in full" : "Payment recorded");
  });
}
