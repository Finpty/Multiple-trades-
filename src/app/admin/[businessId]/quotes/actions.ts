"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, num, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { platformUrl } from "@/lib/site/context";
import { resolveCustomerFromForm } from "@/lib/operations/customers";
import { QuoteInputSchema, acceptQuote, archiveQuote, createInvoiceFromQuote, createQuote, declineQuote, duplicateQuote, reopenQuote, sendQuote, updateQuote } from "@/lib/operations/quotes";
import { createJobFromQuote } from "@/lib/operations/jobs";
import { runTestCalculation, type TestCalcResult } from "@/lib/pricing/admin";

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}
function revalidate(businessId: string, quoteId?: string) {
  revalidatePath(`/admin/${businessId}/quotes`);
  if (quoteId) revalidatePath(`/admin/${businessId}/quotes/${quoteId}`);
  revalidatePath(`/admin/${businessId}/leads`);
  revalidatePath(`/admin/${businessId}/customers`);
}

export async function saveQuoteAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "quotes.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const quoteId = optStr(obj.quoteId);
    const customerId = await resolveCustomerFromForm(ctx.db, businessId, obj, ctx.user.id);
    const input = QuoteInputSchema.parse({
      customerId,
      leadId: optStr(obj.leadId) ?? null,
      title: str(obj.title),
      lineItems: obj.lineItems,
      notes: optStr(obj.notes),
      terms: optStr(obj.terms),
      validUntil: optStr(obj.validUntil) ? new Date(`${str(obj.validUntil)}T23:59:59`) : null,
      depositPercent: num(obj.depositPercent) ?? 0,
      inputs: obj.inputs && typeof obj.inputs === "object" ? obj.inputs : undefined,
    });
    const quote = quoteId ? await updateQuote(businessId, idFrom(quoteId, "quote"), input, { actorUserId: ctx.user.id }) : await createQuote(businessId, input, { actorUserId: ctx.user.id });
    revalidate(businessId, quote.id);
    return ok({ id: quote.id }, quoteId ? "Quote updated" : "Quote created");
  });
}

export async function quoteStateAction(businessId: string, quoteId: string, state: "send" | "accept" | "decline" | "reopen" | "archive" | "duplicate", extra?: { message?: string; reason?: string; acceptedByName?: string }): Promise<ActionResult<{ id?: string; note?: string }>> {
  return runAction<{ id?: string; note?: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "quotes.manage", { throwOnly: true });
    const id = idFrom(quoteId, "quote");
    const actor = { actorUserId: ctx.user.id };
    switch (state) {
      case "send": {
        const q = await ctx.db.quote.findFirst({ where: { id, businessId }, select: { publicToken: true } });
        if (!q) throw new Error("Quote not found.");
        const r = await sendQuote(businessId, id, { ...actor, publicUrl: platformUrl(`/q/${q.publicToken}`), message: extra?.message });
        revalidate(businessId, id);
        return ok({ note: r.emailed ? `Sent to ${r.to}.` : r.to ? `Marked as sent; the email to ${r.to} could not be delivered (check mail settings).` : "Marked as sent. The customer has no email — share the link manually." }, r.emailed ? `Quote emailed to ${r.to}` : "Quote marked as sent");
      }
      case "accept": await acceptQuote(businessId, id, { ...actor, acceptedByName: extra?.acceptedByName?.trim() || ctx.user.name || "Staff", source: "admin" }); revalidate(businessId, id); return ok({}, "Quote marked as accepted");
      case "decline": await declineQuote(businessId, id, { ...actor, reason: extra?.reason, source: "admin" }); revalidate(businessId, id); return ok({}, "Quote marked as declined");
      case "reopen": await reopenQuote(businessId, id, actor); revalidate(businessId, id); return ok({}, "Quote reopened");
      case "archive": await archiveQuote(businessId, id, actor); revalidate(businessId, id); return ok({}, "Quote archived");
      case "duplicate": { const copy = await duplicateQuote(businessId, id, actor); revalidate(businessId, copy.id); return ok({ id: copy.id }, `Copied as ${copy.number}`); }
    }
  });
}

export async function quoteToJobAction(businessId: string, quoteId: string): Promise<ActionResult<{ jobId: string }>> {
  return runAction<{ jobId: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const job = await createJobFromQuote(businessId, idFrom(quoteId, "quote"), { actorUserId: ctx.user.id });
    revalidate(businessId, quoteId);
    revalidatePath(`/admin/${businessId}/jobs`);
    return ok({ jobId: job.id }, `Job ${job.number} ready`);
  });
}

export async function quoteToInvoiceAction(businessId: string, quoteId: string, depositOnly: boolean): Promise<ActionResult<{ invoiceId: string }>> {
  return runAction<{ invoiceId: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "invoices.manage", { throwOnly: true });
    const invoice = await createInvoiceFromQuote(businessId, idFrom(quoteId, "quote"), { actorUserId: ctx.user.id, depositOnly });
    revalidate(businessId, quoteId);
    revalidatePath(`/admin/${businessId}/invoices`);
    return ok({ invoiceId: invoice.id }, `Invoice ${invoice.number} created`);
  });
}

/** Runs the pricing engine for the quote builder's calculator panel. */
export async function quoteCalculateAction(businessId: string, serviceId: string | null, inputs: Record<string, unknown>): Promise<ActionResult<TestCalcResult>> {
  return runAction<TestCalcResult>(async () => {
    const ctx = await requireBusinessAccess(businessId, "quotes.manage", { throwOnly: true });
    const result = await runTestCalculation(ctx.db, { id: businessId, taxRate: ctx.business.taxRate, taxInclusive: ctx.business.taxInclusive }, serviceId && isUuid(serviceId) ? serviceId : null, inputs);
    return ok(result);
  });
}
