"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { fail, formToObject, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { withTenantTransaction } from "@/lib/db";
import { saveFieldValues } from "@/lib/custom-fields";
import { CustomerInputSchema, mergeCustomers as mergeCustomerRows, toCustomerData } from "@/lib/crm/customers";
import { collectCustomFields } from "@/lib/crm/custom-fields";

function revalidate(businessId: string, customerId?: string) {
  revalidatePath(`/admin/${businessId}/customers`);
  if (customerId) revalidatePath(`/admin/${businessId}/customers/${customerId}`);
  revalidatePath(`/admin/${businessId}/leads`);
}

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

function parseCustomerInput(obj: Record<string, unknown>) {
  const tags = Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim()) : [];
  return CustomerInputSchema.parse({
    firstName: str(obj.firstName),
    lastName: optStr(obj.lastName),
    email: optStr(obj.email) ?? "",
    phone: optStr(obj.phone),
    company: optStr(obj.company),
    address: { line1: optStr(obj["address.line1"]), line2: optStr(obj["address.line2"]), suburb: optStr(obj["address.suburb"]), state: optStr(obj["address.state"]), postcode: optStr(obj["address.postcode"]), country: optStr(obj["address.country"]) },
    notes: optStr(obj.notes),
    tags,
    source: optStr(obj.source),
    status: optStr(obj.status) ?? "ACTIVE",
  });
}

export async function createCustomer(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const input = parseCustomerInput(obj);
    const { defs, values } = await collectCustomFields(ctx.db, businessId, "CUSTOMER", obj);
    if (input.email) {
      const clash = await ctx.db.customer.findFirst({ where: { businessId, deletedAt: null, email: input.email }, select: { id: true } });
      if (clash) throw new z.ZodError([{ code: "custom", path: ["email"], message: "A customer with this email already exists." }]);
    }
    const customer = await withTenantTransaction(businessId, async (tx) => {
      const created = await tx.customer.create({ data: { ...toCustomerData(businessId, input), customFields: values as never } });
      if (defs.length) await saveFieldValues(tx, businessId, "CUSTOMER", created.id, defs, values);
      return created;
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "customer.created", entityType: "customer", entityId: customer.id, after: { firstName: customer.firstName, lastName: customer.lastName, email: customer.email } });
    await emitEvent({ type: "customer.created", businessId, payload: { businessId, customerId: customer.id }, actorUserId: ctx.user.id });
    revalidate(businessId, customer.id);
    redirect(`/admin/${businessId}/customers/${customer.id}`);
  });
}

export async function updateCustomer(businessId: string, customerId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    if (!isUuid(customerId)) throw new Error("Invalid customer.");
    const existing = await ctx.db.customer.findFirst({ where: { id: customerId, businessId, deletedAt: null } });
    if (!existing) throw new Error("Customer not found.");
    const obj = formToObject(formData);
    const input = parseCustomerInput(obj);
    const { defs, values } = await collectCustomFields(ctx.db, businessId, "CUSTOMER", obj);
    if (input.email) {
      const clash = await ctx.db.customer.findFirst({ where: { businessId, deletedAt: null, email: input.email, NOT: { id: customerId } }, select: { id: true } });
      if (clash) throw new z.ZodError([{ code: "custom", path: ["email"], message: "Another customer already uses this email." }]);
    }
    const { businessId: _b, ...data } = toCustomerData(businessId, input);
    await withTenantTransaction(businessId, async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: { ...data, customFields: values as never } });
      if (defs.length) await saveFieldValues(tx, businessId, "CUSTOMER", customerId, defs, values);
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "customer.updated", entityType: "customer", entityId: customerId, before: { firstName: existing.firstName, lastName: existing.lastName, email: existing.email, phone: existing.phone, status: existing.status }, after: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, status: data.status } });
    revalidate(businessId, customerId);
    return ok(undefined, "Customer updated");
  });
}

export async function setCustomerStatus(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const customerId = idFrom(formData.get("customerId"), "customer");
    const status = z.enum(["ACTIVE", "ARCHIVED"]).parse(str(formData.get("status")));
    const existing = await ctx.db.customer.findFirst({ where: { id: customerId, businessId, deletedAt: null } });
    if (!existing) throw new Error("Customer not found.");
    await ctx.db.customer.update({ where: { id: customerId }, data: { status } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: status === "ARCHIVED" ? "customer.archived" : "customer.restored", entityType: "customer", entityId: customerId, severity: "NOTICE", before: { status: existing.status }, after: { status } });
    revalidate(businessId, customerId);
    return ok(undefined, status === "ARCHIVED" ? "Customer archived" : "Customer restored");
  });
}

/** Merges the duplicate into the kept customer, relinking every related record. Audited as CRITICAL. */
export async function mergeCustomers(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const a = idFrom(formData.get("customerA"), "customer");
    const b = idFrom(formData.get("customerB"), "customer");
    const keepId = str(formData.get("keep")) === "b" ? b : a;
    const mergeId = keepId === a ? b : a;
    if (a === b) return fail("Choose two different customers.");
    const rows = await ctx.db.customer.findMany({ where: { businessId, deletedAt: null, id: { in: [a, b] } }, select: { id: true } });
    if (rows.length !== 2) throw new Error("Customer not found.");
    const result = await withTenantTransaction(businessId, (tx) => mergeCustomerRows(tx, businessId, keepId, mergeId));
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "customer.merged", entityType: "customer", entityId: keepId, severity: "CRITICAL", before: { merged: { id: result.before.id, firstName: result.before.firstName, lastName: result.before.lastName, email: result.before.email, phone: result.before.phone } }, after: { id: result.keep.id, firstName: result.keep.firstName, lastName: result.keep.lastName, email: result.keep.email, phone: result.keep.phone }, metadata: { mergedCustomerId: mergeId } });
    revalidate(businessId, keepId);
    revalidatePath(`/admin/${businessId}/customers/${mergeId}`);
    revalidatePath(`/admin/${businessId}/quotes`);
    redirect(`/admin/${businessId}/customers/${keepId}`);
  });
}

export async function saveCustomerCustomFields(businessId: string, customerId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    if (!isUuid(customerId)) throw new Error("Invalid customer.");
    const existing = await ctx.db.customer.findFirst({ where: { id: customerId, businessId, deletedAt: null }, select: { id: true } });
    if (!existing) throw new Error("Customer not found.");
    const obj = formToObject(formData);
    const { defs, values } = await collectCustomFields(ctx.db, businessId, "CUSTOMER", obj);
    await withTenantTransaction(businessId, async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: { customFields: values as never } });
      if (defs.length) await saveFieldValues(tx, businessId, "CUSTOMER", customerId, defs, values);
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "customer.updated", entityType: "customer", entityId: customerId, after: { customFields: values } });
    revalidate(businessId, customerId);
    return ok(undefined, "Details saved");
  });
}
