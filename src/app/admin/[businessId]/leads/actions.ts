"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { LeadStatus } from "@prisma/client";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, num, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { toJson } from "@/lib/json";
import { withTenantTransaction } from "@/lib/db";
import { saveFieldValues } from "@/lib/custom-fields";
import { LeadInputSchema, toLeadData } from "@/lib/crm/leads";
import { upsertCustomerByContact } from "@/lib/crm/customers";
import { EmailSchema, NoteSchema, addNote, addSystemMessage, sendEmailMessage } from "@/lib/crm/messages";
import { TaskInputSchema, completeTask, createTask } from "@/lib/crm/tasks";
import { collectCustomFields } from "@/lib/crm/custom-fields";

function revalidate(businessId: string, leadId?: string, customerId?: string | null) {
  revalidatePath(`/admin/${businessId}/leads`);
  if (leadId) revalidatePath(`/admin/${businessId}/leads/${leadId}`);
  revalidatePath(`/admin/${businessId}/customers`);
  if (customerId) revalidatePath(`/admin/${businessId}/customers/${customerId}`);
}

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

function optId(value: unknown): string | undefined {
  const id = str(value);
  return isUuid(id) ? id : undefined;
}

function parseLeadInput(obj: Record<string, unknown>) {
  return LeadInputSchema.parse({
    name: str(obj.name),
    email: optStr(obj.email) ?? "",
    phone: optStr(obj.phone),
    message: optStr(obj.message),
    serviceId: optId(obj.serviceId) ?? "",
    source: optStr(obj.source),
    locationText: optStr(obj.locationText),
    valueDollars: num(obj.valueDollars),
    assignedToUserId: optId(obj.assignedToUserId) ?? "",
    status: optStr(obj.status) ?? "NEW",
  });
}

export async function createLead(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const input = parseLeadInput(obj);
    const { defs, values } = await collectCustomFields(ctx.db, businessId, "LEAD", obj);
    const lead = await withTenantTransaction(businessId, async (tx) => {
      const created = await tx.lead.create({ data: toLeadData(businessId, input) });
      if (defs.length) await saveFieldValues(tx, businessId, "LEAD", created.id, defs, values);
      return created;
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.created", entityType: "lead", entityId: lead.id, after: { name: lead.name, status: lead.status, source: lead.source } });
    await emitEvent({ type: "lead.created", businessId, payload: { businessId, leadId: lead.id, source: lead.source, serviceId: lead.serviceId, assignedToUserId: lead.assignedToUserId }, actorUserId: ctx.user.id });
    revalidate(businessId, lead.id);
    redirect(`/admin/${businessId}/leads/${lead.id}`);
  });
}

export async function updateLead(businessId: string, leadId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    if (!isUuid(leadId)) throw new Error("Invalid lead.");
    const existing = await ctx.db.lead.findFirst({ where: { id: leadId, businessId, deletedAt: null } });
    if (!existing) throw new Error("Lead not found.");
    const obj = formToObject(formData);
    const input = parseLeadInput({ ...obj, status: existing.status });
    const { defs, values } = await collectCustomFields(ctx.db, businessId, "LEAD", obj);
    const { businessId: _b, status: _s, data: _d, ...data } = toLeadData(businessId, input);
    await withTenantTransaction(businessId, async (tx) => {
      await tx.lead.update({ where: { id: leadId }, data });
      if (defs.length) await saveFieldValues(tx, businessId, "LEAD", leadId, defs, values);
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.updated", entityType: "lead", entityId: leadId, before: { name: existing.name, email: existing.email, phone: existing.phone, assignedToUserId: existing.assignedToUserId }, after: { name: data.name, email: data.email, phone: data.phone, assignedToUserId: data.assignedToUserId } });
    revalidate(businessId, leadId, existing.customerId);
    return ok(undefined, "Lead updated");
  });
}

const StatusSchema = z.enum(["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST", "ARCHIVED"]);

async function changeStatus(businessId: string, leadId: string, status: LeadStatus): Promise<ActionResult> {
  const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
  const lead = await ctx.db.lead.findFirst({ where: { id: leadId, businessId, deletedAt: null } });
  if (!lead) throw new Error("Lead not found.");
  if (lead.status === status) return ok(undefined);
  await ctx.db.lead.update({ where: { id: leadId }, data: { status } });
  await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.status_changed", entityType: "lead", entityId: leadId, before: { status: lead.status }, after: { status } });
  await emitEvent({ type: "lead.status_changed", businessId, payload: { businessId, leadId, from: lead.status, to: status }, actorUserId: ctx.user.id });
  revalidate(businessId, leadId, lead.customerId);
  return ok(undefined, `Status set to ${status.toLowerCase()}`);
}

/** Form-driven status change (detail page buttons and the list's quick select). */
export async function setLeadStatus(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(() => changeStatus(businessId, idFrom(formData.get("leadId"), "lead"), StatusSchema.parse(str(formData.get("status")))));
}

/** Direct call from the kanban board after a drop. */
export async function moveLead(businessId: string, leadId: string, status: string): Promise<ActionResult> {
  return runAction(() => changeStatus(businessId, idFrom(leadId, "lead"), StatusSchema.parse(status)));
}

export async function assignLead(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const leadId = idFrom(formData.get("leadId"), "lead");
    const assignedToUserId = optId(formData.get("assignedToUserId")) ?? null;
    const lead = await ctx.db.lead.findFirst({ where: { id: leadId, businessId, deletedAt: null } });
    if (!lead) throw new Error("Lead not found.");
    await ctx.db.lead.update({ where: { id: leadId }, data: { assignedToUserId } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.assigned", entityType: "lead", entityId: leadId, before: { assignedToUserId: lead.assignedToUserId }, after: { assignedToUserId } });
    revalidate(businessId, leadId);
    return ok(undefined, assignedToUserId ? "Lead assigned" : "Lead unassigned");
  });
}

/** Resolves the lead/customer pair a timeline action targets (either id may be given). */
async function resolveTarget(db: Awaited<ReturnType<typeof requireBusinessAccess>>["db"], businessId: string, formData: FormData) {
  const leadId = optId(formData.get("leadId"));
  const customerIdIn = optId(formData.get("customerId"));
  if (leadId) {
    const lead = await db.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, customerId: true, email: true } });
    if (!lead) throw new Error("Lead not found.");
    return { leadId: lead.id, customerId: lead.customerId, email: lead.email };
  }
  if (customerIdIn) {
    const customer = await db.customer.findFirst({ where: { id: customerIdIn, businessId }, select: { id: true, email: true } });
    if (!customer) throw new Error("Customer not found.");
    return { leadId: null, customerId: customer.id, email: customer.email };
  }
  throw new Error("Nothing to attach this to.");
}

export async function addTimelineNote(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const target = await resolveTarget(ctx.db, businessId, formData);
    const { body } = NoteSchema.parse({ body: str(formData.get("body")) });
    const m = await addNote(ctx.db, businessId, target, body, ctx.user.id, ctx.user.name);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "message.note_added", entityType: "message", entityId: m.id, metadata: { leadId: target.leadId, customerId: target.customerId } });
    revalidate(businessId, target.leadId ?? undefined, target.customerId);
    return ok(undefined, "Note added");
  });
}

export async function sendTimelineEmail(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const target = await resolveTarget(ctx.db, businessId, formData);
    const input = EmailSchema.parse({ to: str(formData.get("to")) || target.email || "", subject: str(formData.get("subject")), body: str(formData.get("body")) });
    const m = await sendEmailMessage(ctx.db, businessId, target, input, { actorUserId: ctx.user.id, actorName: ctx.user.name, fromAddress: ctx.business.email });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "message.email_sent", entityType: "message", entityId: m.id, metadata: { to: input.to, subject: input.subject } });
    revalidate(businessId, target.leadId ?? undefined, target.customerId);
    return ok(undefined, `Email sent to ${input.to}`);
  });
}

export async function createTimelineTask(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const target = await resolveTarget(ctx.db, businessId, formData);
    const input = TaskInputSchema.parse({ title: str(formData.get("title")), description: optStr(formData.get("description")), dueAt: optStr(formData.get("dueAt")), assignedToUserId: optId(formData.get("assignedToUserId")) ?? "" });
    const task = await createTask(ctx.db, businessId, target, input);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "task.created", entityType: "task", entityId: task.id, after: { title: task.title, dueAt: task.dueAt, leadId: target.leadId, customerId: target.customerId } });
    revalidate(businessId, target.leadId ?? undefined, target.customerId);
    revalidatePath(`/admin/${businessId}/tasks`);
    return ok(undefined, "Task created");
  });
}

export async function toggleTimelineTask(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const taskId = idFrom(formData.get("taskId"), "task");
    const completed = bool(formData.get("completed"));
    const task = await completeTask(ctx.db, businessId, taskId, completed);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: completed ? "task.completed" : "task.reopened", entityType: "task", entityId: taskId });
    revalidate(businessId, task.leadId ?? undefined, task.customerId);
    revalidatePath(`/admin/${businessId}/tasks`);
    return ok(undefined, completed ? "Task completed" : "Task reopened");
  });
}

/** Upserts a customer from the lead's contact details and links it. */
export async function convertLeadToCustomer(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const leadId = idFrom(formData.get("leadId"), "lead");
    const lead = await ctx.db.lead.findFirst({ where: { id: leadId, businessId, deletedAt: null } });
    if (!lead) throw new Error("Lead not found.");
    if (lead.customerId) return fail("This lead is already linked to a customer.");
    if (!lead.email && !lead.phone) return fail("Add an email or phone number to the lead first so the customer can be matched later.");
    const result = await withTenantTransaction(businessId, async (tx) => {
      const c = await upsertCustomerByContact(tx, businessId, { name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, address: lead.locationText ? { line1: lead.locationText } : null });
      await tx.lead.update({ where: { id: leadId }, data: { customerId: c.id } });
      await addSystemMessage(tx, businessId, { leadId, customerId: c.id }, c.created ? `Converted to a new customer.` : `Linked to existing customer.`);
      return c;
    });
    if (result.created) await emitEvent({ type: "customer.created", businessId, payload: { businessId, customerId: result.id }, actorUserId: ctx.user.id });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: result.created ? "customer.created" : "lead.customer_linked", entityType: "customer", entityId: result.id, metadata: { leadId } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.converted", entityType: "lead", entityId: leadId, before: { customerId: null }, after: { customerId: result.id } });
    revalidate(businessId, leadId, result.id);
    return ok(undefined, result.created ? "Customer created and linked" : "Linked to existing customer");
  });
}

export async function linkLeadCustomer(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const leadId = idFrom(formData.get("leadId"), "lead");
    const customerId = optId(formData.get("customerId")) ?? null;
    const lead = await ctx.db.lead.findFirst({ where: { id: leadId, businessId, deletedAt: null } });
    if (!lead) throw new Error("Lead not found.");
    if (customerId) {
      const c = await ctx.db.customer.findFirst({ where: { id: customerId, businessId, deletedAt: null }, select: { id: true } });
      if (!c) throw new Error("Customer not found.");
    }
    await ctx.db.lead.update({ where: { id: leadId }, data: { customerId } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.customer_linked", entityType: "lead", entityId: leadId, before: { customerId: lead.customerId }, after: { customerId } });
    revalidate(businessId, leadId, customerId ?? lead.customerId);
    return ok(undefined, customerId ? "Customer linked" : "Customer unlinked");
  });
}

export async function archiveLead(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const leadId = idFrom(formData.get("leadId"), "lead");
    const restore = bool(formData.get("restore"));
    const lead = await ctx.db.lead.findFirst({ where: { id: leadId, businessId } });
    if (!lead) throw new Error("Lead not found.");
    await ctx.db.lead.update({ where: { id: leadId }, data: restore ? { deletedAt: null, status: "NEW" } : { deletedAt: new Date(), status: "ARCHIVED" } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: restore ? "lead.restored" : "lead.archived", entityType: "lead", entityId: leadId, severity: "NOTICE", before: { status: lead.status } });
    revalidate(businessId, leadId, lead.customerId);
    if (!restore) redirect(`/admin/${businessId}/leads`);
    return ok(undefined, "Lead restored");
  });
}

/** Stores lead custom-field values only (used by the detail page's inline custom fields card). */
export async function saveLeadCustomFields(businessId: string, leadId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    if (!isUuid(leadId)) throw new Error("Invalid lead.");
    const lead = await ctx.db.lead.findFirst({ where: { id: leadId, businessId, deletedAt: null }, select: { id: true, data: true } });
    if (!lead) throw new Error("Lead not found.");
    const obj = formToObject(formData);
    const { defs, values } = await collectCustomFields(ctx.db, businessId, "LEAD", obj);
    await withTenantTransaction(businessId, async (tx) => {
      if (defs.length) await saveFieldValues(tx, businessId, "LEAD", leadId, defs, values);
      await tx.lead.update({ where: { id: leadId }, data: { data: toJson({ ...(typeof lead.data === "object" && lead.data ? (lead.data as object) : {}), ...values }) } });
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.updated", entityType: "lead", entityId: leadId, after: { customFields: values } });
    revalidate(businessId, leadId);
    return ok(undefined, "Details saved");
  });
}
