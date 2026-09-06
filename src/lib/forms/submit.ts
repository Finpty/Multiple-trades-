import type { Business, Form } from "@prisma/client";
import { platformDb, prisma, tenantDb, withTenantTransaction } from "@/lib/db";
import { emitEvent, flushEvents } from "@/lib/events";
import { recordAudit } from "@/lib/audit";
import { asArray, asObject, toJson } from "@/lib/json";
import { sendMail } from "@/lib/mail";
import { coerceFieldValues, listFieldDefinitions, saveFieldValues } from "@/lib/custom-fields";
import type { FormFieldDefinition, FormSettings } from "@/lib/site/public-api";

export interface ProcessSubmissionInput {
  business: Business;
  form: Form;
  fields: FormFieldDefinition[];
  values: Record<string, unknown>;
  files: Array<{ fieldKey: string; mediaId: string }>;
  meta: { ip?: string | null; userAgent?: string | null; pageUrl?: string | null };
}

export interface ProcessSubmissionResult {
  submissionId: string;
  leadId: string | null;
  customerId: string | null;
  bookingId: string | null;
  message: string;
  redirectUrl: string | null;
}

function pick(values: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = values[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "Customer", lastName: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

function addressText(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return Object.values(v as Record<string, string>).filter(Boolean).join(", ") || null;
  return null;
}

/**
 * Turns a validated website form submission into CRM records. Runs inside a
 * tenant transaction, emits domain events after commit and notifies staff.
 * Never depends on AI or any external service to succeed.
 */
export async function processFormSubmission(input: ProcessSubmissionInput): Promise<ProcessSubmissionResult> {
  const { business, form, values, files, meta } = input;
  const businessId = business.id;
  const settings = asObject<FormSettings>(form.settings);
  const name = pick(values, ["name", "full_name", "fullName", "first_name"]) ?? "Website enquiry";
  const email = pick(values, ["email"])?.toLowerCase() ?? null;
  const phone = pick(values, ["phone", "mobile"]);
  const message = pick(values, ["message", "description", "details", "notes"]);
  const serviceRef = pick(values, ["serviceId", "service"]);
  const locationText = addressText(values.address) ?? pick(values, ["suburb", "location"]);

  const db = tenantDb(businessId);
  const service = serviceRef
    ? await db.service.findFirst({ where: { businessId, OR: [{ id: serviceRef.match(/^[0-9a-f-]{36}$/i) ? serviceRef : "00000000-0000-0000-0000-000000000000" }, { slug: serviceRef }] }, select: { id: true, name: true } })
    : null;
  const leadDefs = await listFieldDefinitions(db, businessId, "LEAD");
  const { values: leadFieldValues } = coerceFieldValues(leadDefs, values);

  const eventIds: string[] = [];
  const result = await withTenantTransaction(businessId, async (tx) => {
    const submission = await tx.formSubmission.create({
      data: { businessId, formId: form.id, data: toJson(values), files: toJson(files), ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 512) ?? null, pageUrl: meta.pageUrl?.slice(0, 1000) ?? null },
    });
    eventIds.push(await emitEvent({ type: "form.submitted", businessId, payload: { businessId, formId: form.id, submissionId: submission.id, action: form.action } }, tx));

    let customerId: string | null = null;
    let customerCreated = false;
    if (email || phone) {
      const existing = await tx.customer.findFirst({ where: { businessId, deletedAt: null, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] } });
      if (existing) customerId = existing.id;
      else {
        const { firstName, lastName } = splitName(name);
        const created = await tx.customer.create({ data: { businessId, firstName, lastName, email, phone, source: `website:${form.slug}`, address: toJson(typeof values.address === "object" && values.address ? values.address : {}) } });
        customerId = created.id;
        customerCreated = true;
        eventIds.push(await emitEvent({ type: "customer.created", businessId, payload: { businessId, customerId } }, tx));
      }
    }

    const lead = await tx.lead.create({
      data: {
        businessId,
        customerId,
        serviceId: service?.id ?? null,
        formSubmissionId: submission.id,
        source: `website:${form.slug}`,
        status: "NEW",
        name,
        email,
        phone,
        message,
        locationText,
        address: toJson(typeof values.address === "object" && values.address ? values.address : {}),
        data: toJson(values),
      },
    });
    if (leadDefs.length) await saveFieldValues(tx, businessId, "LEAD", lead.id, leadDefs, leadFieldValues);
    eventIds.push(await emitEvent({ type: "lead.created", businessId, payload: { businessId, leadId: lead.id, source: `website:${form.slug}`, serviceId: service?.id ?? null, assignedToUserId: null } }, tx));

    let bookingId: string | null = null;
    if (form.action === "BOOKING_REQUEST") {
      const date = pick(values, ["date", "preferred_date", "preferredDate"]);
      const time = pick(values, ["time", "preferred_time", "preferredTime"]) ?? "09:00";
      const startsAt = date && !Number.isNaN(Date.parse(`${date}T${time}`)) ? new Date(`${date}T${time}`) : new Date(Date.now() + 86_400_000);
      const booking = await tx.booking.create({ data: { businessId, customerId, serviceId: service?.id ?? null, leadId: lead.id, startsAt, status: "REQUESTED", notes: message, address: toJson(typeof values.address === "object" && values.address ? values.address : {}) } });
      bookingId = booking.id;
      eventIds.push(await emitEvent({ type: "booking.requested", businessId, payload: { businessId, bookingId } }, tx));
    }
    await tx.analyticsEvent.create({ data: { businessId, type: "form_submit", path: meta.pageUrl ? safePath(meta.pageUrl) : null, metadata: toJson({ formSlug: form.slug, action: form.action }) } });
    return { submissionId: submission.id, leadId: lead.id, customerId, customerCreated, bookingId };
  });

  await recordAudit({ actorType: "API", businessId, action: "form.submitted", entityType: "form_submission", entityId: result.submissionId, metadata: { formSlug: form.slug, leadId: result.leadId, ip: meta.ip }, ip: meta.ip, userAgent: meta.userAgent });
  await flushEvents(eventIds);

  // Staff notification (email + in-app) and auto-reply — best effort.
  const notifyEmails = (asArray<string>(settings.notifyEmails as unknown as never) ?? []).filter(Boolean);
  const recipients = notifyEmails.length ? notifyEmails : business.email ? [business.email] : [];
  const summary = Object.entries(values)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined && !(typeof v === "string" && v.startsWith("data:image/")))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n");
  for (const to of recipients) {
    await sendMail({ to, subject: `New ${form.name} from ${name}`, text: `${form.name} submitted on your website.\n\n${summary}\n\nService: ${service?.name ?? "—"}\nPage: ${meta.pageUrl ?? "—"}` });
  }
  if (email && settings.autoReplyBody) {
    await sendMail({ to: email, subject: settings.autoReplySubject ?? `Thanks for contacting ${business.name}`, text: interpolate(settings.autoReplyBody, { name, business: business.name, service: service?.name ?? "" }) });
  }
  await notifyStaff(businessId, `New enquiry from ${name}`, message ?? form.name, { leadId: result.leadId, formSlug: form.slug }).catch(() => undefined);

  return {
    submissionId: result.submissionId,
    leadId: result.leadId,
    customerId: result.customerId,
    bookingId: result.bookingId,
    message: settings.successMessage ?? "Thanks — we have received your enquiry and will be in touch shortly.",
    redirectUrl: settings.redirectUrl ?? null,
  };
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname.slice(0, 500);
  } catch {
    return url.slice(0, 500);
  }
}

/** In-app notifications for members who can manage the CRM. */
export async function notifyStaff(businessId: string, title: string, body: string, data: Record<string, unknown>): Promise<void> {
  const members = await prisma.businessMembership.findMany({ where: { businessId, status: "ACTIVE" }, include: { role: true } });
  const targets = members.filter((m) => asArray<string>(m.role.permissions).some((p) => p === "crm.manage" || p === "users.manage"));
  if (targets.length === 0) return;
  await platformDb.notification.createMany({ data: targets.map((m) => ({ userId: m.userId, businessId, type: "lead.created", title, body: body.slice(0, 500), data: toJson(data) })) });
}
