"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { asObject, toJson } from "@/lib/json";
import { withTenantTransaction } from "@/lib/db";
import { FormFieldsSchema, FormMetaSchema, FormSettingsSchema, formFields, parseNotifyEmails, slugify } from "@/lib/forms/builder";
import { upsertCustomerByContact } from "@/lib/crm/customers";
import { LEAD_CONTACT_KEYS, pickContact } from "@/lib/crm/leads";

function revalidate(businessId: string, formId?: string) {
  revalidatePath(`/admin/${businessId}/forms`);
  if (formId) {
    revalidatePath(`/admin/${businessId}/forms/${formId}`);
    revalidatePath(`/admin/${businessId}/forms/${formId}/submissions`);
  }
}

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

async function uniqueSlug(db: Awaited<ReturnType<typeof requireBusinessAccess>>["db"], businessId: string, base: string, excludeId?: string): Promise<string> {
  let slug = base;
  for (let i = 2; i < 100; i += 1) {
    const clash = await db.form.findFirst({ where: { businessId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  throw new Error("Could not find a free slug.");
}

const DEFAULT_FIELDS = [
  { id: "f_name", key: "name", type: "text", label: "Your name", required: true, width: "half" },
  { id: "f_phone", key: "phone", type: "phone", label: "Phone", required: true, width: "half" },
  { id: "f_email", key: "email", type: "email", label: "Email", required: true },
  { id: "f_message", key: "message", type: "textarea", label: "Tell us about the job" },
];

/** Creates a form with a sensible starter field set and opens the builder. */
export async function createForm(businessId: string, _prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "forms.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const name = str(obj.name);
    if (!name) throw new z.ZodError([{ code: "custom", path: ["name"], message: "Name is required." }]);
    const action = FormMetaSchema.shape.action.parse(str(obj.action) || "LEAD");
    const slug = await uniqueSlug(ctx.db, businessId, slugify(str(obj.slug) || name));
    const form = await ctx.db.form.create({
      data: { businessId, name, slug, action, fields: toJson(DEFAULT_FIELDS), settings: toJson({ submitLabel: "Send enquiry", successMessage: "Thanks — we have received your enquiry and will be in touch shortly." }) },
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "form.created", entityType: "form", entityId: form.id, after: { name, slug, action } });
    revalidate(businessId, form.id);
    redirect(`/admin/${businessId}/forms/${form.id}`);
  });
}

/** Saves the whole builder state: meta, fields and settings in one call. */
export async function saveForm(businessId: string, formId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "forms.manage", { throwOnly: true });
    if (!isUuid(formId)) throw new Error("Invalid form.");
    const existing = await ctx.db.form.findFirst({ where: { id: formId, businessId } });
    if (!existing) throw new Error("Form not found.");
    const obj = formToObject(formData);
    const meta = FormMetaSchema.parse({ name: str(obj.name), slug: slugify(str(obj.slug) || str(obj.name)), description: str(obj.description) || undefined, action: str(obj.action) || existing.action, isActive: bool(obj.isActive) });
    const fields = FormFieldsSchema.parse(Array.isArray(obj.fields) ? obj.fields : []);
    const settings = FormSettingsSchema.parse({
      submitLabel: str(obj.submitLabel) || undefined,
      successMessage: str(obj.successMessage) || undefined,
      redirectUrl: str(obj.redirectUrl) || undefined,
      notifyEmails: parseNotifyEmails(str(obj.notifyEmails)),
      autoReplySubject: str(obj.autoReplySubject) || undefined,
      autoReplyBody: str(obj.autoReplyBody) || undefined,
    });
    const slugClash = await ctx.db.form.findFirst({ where: { businessId, slug: meta.slug, NOT: { id: formId } }, select: { id: true } });
    if (slugClash) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Another form already uses this slug." }]);
    const updated = await ctx.db.form.update({ where: { id: formId }, data: { ...meta, description: meta.description ?? null, fields: toJson(fields), settings: toJson(settings) } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "form.updated", entityType: "form", entityId: formId, before: { name: existing.name, slug: existing.slug, fields: existing.fields, settings: existing.settings, isActive: existing.isActive }, after: { name: updated.name, slug: updated.slug, fields, settings, isActive: updated.isActive } });
    revalidate(businessId, formId);
    return ok(undefined, "Form saved");
  });
}

export async function toggleFormActive(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "forms.manage", { throwOnly: true });
    const formId = idFrom(formData.get("formId"), "form");
    const form = await ctx.db.form.findFirst({ where: { id: formId, businessId, deletedAt: null } });
    if (!form) throw new Error("Form not found.");
    await ctx.db.form.update({ where: { id: formId }, data: { isActive: !form.isActive } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: form.isActive ? "form.deactivated" : "form.activated", entityType: "form", entityId: formId });
    revalidate(businessId, formId);
    return ok(undefined, form.isActive ? "Form deactivated" : "Form activated");
  });
}

export async function duplicateForm(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "forms.manage", { throwOnly: true });
    const formId = idFrom(formData.get("formId"), "form");
    const form = await ctx.db.form.findFirst({ where: { id: formId, businessId } });
    if (!form) throw new Error("Form not found.");
    const slug = await uniqueSlug(ctx.db, businessId, `${form.slug}-copy`);
    const copy = await ctx.db.form.create({ data: { businessId, name: `${form.name} (copy)`, slug, description: form.description, action: form.action, fields: toJson(formFields(form)), settings: toJson(asObject(form.settings)), isActive: false } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "form.duplicated", entityType: "form", entityId: copy.id, metadata: { sourceFormId: formId } });
    revalidate(businessId);
    redirect(`/admin/${businessId}/forms/${copy.id}`);
  });
}

export async function archiveForm(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "forms.manage", { throwOnly: true });
    const formId = idFrom(formData.get("formId"), "form");
    const restore = bool(formData.get("restore"));
    const form = await ctx.db.form.findFirst({ where: { id: formId, businessId } });
    if (!form) throw new Error("Form not found.");
    await ctx.db.form.update({ where: { id: formId }, data: restore ? { deletedAt: null } : { deletedAt: new Date(), isActive: false } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: restore ? "form.restored" : "form.archived", entityType: "form", entityId: formId, severity: restore ? "INFO" : "NOTICE" });
    revalidate(businessId, formId);
    return ok(undefined, restore ? "Form restored" : "Form archived");
  });
}

export async function setSubmissionStatus(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "forms.manage", { throwOnly: true });
    const submissionId = idFrom(formData.get("submissionId"), "submission");
    const status = z.enum(["NEW", "PROCESSED", "SPAM"]).parse(str(formData.get("status")));
    const sub = await ctx.db.formSubmission.findFirst({ where: { id: submissionId, businessId }, select: { id: true, formId: true, status: true } });
    if (!sub) throw new Error("Submission not found.");
    await ctx.db.formSubmission.update({ where: { id: submissionId }, data: { status } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "form_submission.status_changed", entityType: "form_submission", entityId: submissionId, before: { status: sub.status }, after: { status } });
    revalidate(businessId, sub.formId);
    revalidatePath(`/admin/${businessId}/forms/${sub.formId}/submissions/${submissionId}`);
    return ok(undefined, status === "SPAM" ? "Marked as spam" : "Updated");
  });
}

export async function deleteSubmission(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "forms.manage", { throwOnly: true });
    const submissionId = idFrom(formData.get("submissionId"), "submission");
    const sub = await ctx.db.formSubmission.findFirst({ where: { id: submissionId, businessId } });
    if (!sub) throw new Error("Submission not found.");
    await ctx.db.formSubmission.delete({ where: { id: submissionId } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "form_submission.deleted", entityType: "form_submission", entityId: submissionId, severity: "WARNING", before: { data: sub.data, status: sub.status } });
    revalidate(businessId, sub.formId);
    redirect(`/admin/${businessId}/forms/${sub.formId}/submissions`);
  });
}

/** Creates a lead (and upserts the customer) from a submission that has none, e.g. after un-spamming. */
export async function createLeadFromSubmission(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "crm.manage", { throwOnly: true });
    const submissionId = idFrom(formData.get("submissionId"), "submission");
    const sub = await ctx.db.formSubmission.findFirst({ where: { id: submissionId, businessId }, include: { form: true, lead: { select: { id: true } } } });
    if (!sub) throw new Error("Submission not found.");
    if (sub.lead) return fail("A lead already exists for this submission.");
    const values = asObject<Record<string, unknown>>(sub.data);
    const contact = pickContact(values);
    const events: Array<{ type: "lead.created" | "customer.created"; id: string }> = [];
    const leadId = await withTenantTransaction(businessId, async (tx) => {
      const customer = await upsertCustomerByContact(tx, businessId, { name: contact.name, email: contact.email, phone: contact.phone, source: `website:${sub.form.slug}` });
      if (customer.created) events.push({ type: "customer.created", id: customer.id });
      const lead = await tx.lead.create({
        data: { businessId, customerId: customer.id, formSubmissionId: sub.id, source: `website:${sub.form.slug}`, name: contact.name, email: contact.email, phone: contact.phone, message: contact.message, locationText: contact.locationText, data: toJson(values) },
      });
      await tx.formSubmission.update({ where: { id: sub.id }, data: { status: "PROCESSED" } });
      events.push({ type: "lead.created", id: lead.id });
      return lead.id;
    });
    for (const e of events) {
      if (e.type === "customer.created") await emitEvent({ type: "customer.created", businessId, payload: { businessId, customerId: e.id }, actorUserId: ctx.user.id });
      else await emitEvent({ type: "lead.created", businessId, payload: { businessId, leadId: e.id, source: `website:${sub.form.slug}`, serviceId: null, assignedToUserId: null }, actorUserId: ctx.user.id });
    }
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "lead.created", entityType: "lead", entityId: leadId, metadata: { submissionId, keys: LEAD_CONTACT_KEYS } });
    revalidate(businessId, sub.formId);
    revalidatePath(`/admin/${businessId}/leads`);
    redirect(`/admin/${businessId}/leads/${leadId}`);
  });
}
