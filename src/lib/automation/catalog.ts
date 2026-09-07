import type { DomainEventPayloads, DomainEventType } from "@/lib/events/types";
import { DOMAIN_EVENT_TYPES } from "@/lib/events/types";

export type EventGroup = "Leads & customers" | "Quotes" | "Jobs" | "Invoices & payments" | "Bookings & reviews" | "Website" | "Media & content" | "Business" | "Other";

export interface EventCatalogEntry {
  type: DomainEventType;
  label: string;
  description: string;
  group: EventGroup;
}

/** Friendly names for the trigger picker. Every catalogued event is listed so nothing is hidden from the owner. */
export const EVENT_CATALOG: Record<DomainEventType, Omit<EventCatalogEntry, "type">> = {
  "lead.created": { label: "New lead received", description: "A lead arrives from a form, phone call or manual entry.", group: "Leads & customers" },
  "lead.status_changed": { label: "Lead status changed", description: "A lead moves to a different status (contacted, qualified, won…).", group: "Leads & customers" },
  "customer.created": { label: "Customer created", description: "A new customer record is added.", group: "Leads & customers" },
  "form.submitted": { label: "Website form submitted", description: "Any website form is submitted.", group: "Leads & customers" },
  "quote.created": { label: "Quote created", description: "A new quote is drafted.", group: "Quotes" },
  "quote.sent": { label: "Quote sent", description: "A quote is emailed to the customer.", group: "Quotes" },
  "quote.accepted": { label: "Quote accepted", description: "The customer accepts a quote online.", group: "Quotes" },
  "quote.declined": { label: "Quote declined", description: "The customer declines a quote.", group: "Quotes" },
  "job.created": { label: "Job created", description: "A job is opened (manually, from a quote or from a booking).", group: "Jobs" },
  "job.stage_changed": { label: "Job moved to a stage", description: "A job is dragged or moved to another workflow stage.", group: "Jobs" },
  "job.completed": { label: "Job completed", description: "A job reaches its final stage.", group: "Jobs" },
  "invoice.created": { label: "Invoice created", description: "An invoice is drafted.", group: "Invoices & payments" },
  "invoice.sent": { label: "Invoice sent", description: "An invoice is sent to the customer.", group: "Invoices & payments" },
  "invoice.overdue": { label: "Invoice overdue", description: "Fires once a day for every unpaid invoice past its due date.", group: "Invoices & payments" },
  "payment.received": { label: "Payment received", description: "A payment is recorded against an invoice.", group: "Invoices & payments" },
  "booking.requested": { label: "Booking requested", description: "A booking is requested online or created in the admin.", group: "Bookings & reviews" },
  "review.requested": { label: "Review requested", description: "A review request goes out to a customer.", group: "Bookings & reviews" },
  "project.created": { label: "Project created", description: "A portfolio project is created.", group: "Media & content" },
  "project.completed": { label: "Project completed", description: "A portfolio project is marked complete.", group: "Media & content" },
  "service.created": { label: "Service created", description: "A new service is added.", group: "Media & content" },
  "media.uploaded": { label: "Media uploaded", description: "A file is uploaded to the media library.", group: "Media & content" },
  "page.published": { label: "Page published", description: "A website page is published.", group: "Website" },
  "page.restored": { label: "Page restored", description: "A page revision is restored.", group: "Website" },
  "theme.published": { label: "Theme published", description: "Brand & theme changes go live.", group: "Website" },
  "domain.added": { label: "Domain added", description: "A custom domain is connected.", group: "Website" },
  "domain.verified": { label: "Domain verified", description: "A custom domain passes verification.", group: "Website" },
  "business.created": { label: "Business created", description: "The business is created on the platform.", group: "Business" },
  "business.updated": { label: "Business details updated", description: "Business settings change.", group: "Business" },
  "business.published": { label: "Business published", description: "The website goes live.", group: "Business" },
  "business.unpublished": { label: "Business unpublished", description: "The website is taken offline.", group: "Business" },
  "business.duplicated": { label: "Business duplicated", description: "The business is cloned.", group: "Business" },
  "business.archived": { label: "Business archived", description: "The business is archived.", group: "Business" },
  "user.registered": { label: "User registered", description: "A user signs up to the platform.", group: "Other" },
  "ai.request.completed": { label: "AI request completed", description: "An AI-assisted action finished.", group: "Other" },
};

export const EVENT_GROUP_ORDER: EventGroup[] = ["Leads & customers", "Quotes", "Jobs", "Invoices & payments", "Bookings & reviews", "Website", "Media & content", "Business", "Other"];

export function eventCatalog(): EventCatalogEntry[] {
  return DOMAIN_EVENT_TYPES.map((type) => ({ type, ...EVENT_CATALOG[type] }));
}

export function eventLabel(type: string): string {
  return (EVENT_CATALOG as Record<string, { label: string } | undefined>)[type]?.label ?? type;
}

type PayloadKeys = { [K in DomainEventType]: ReadonlyArray<keyof DomainEventPayloads[K] & string> };

/**
 * Payload keys per event, checked against DomainEventPayloads by the compiler,
 * so the conditions editor and placeholder hints stay in sync with the catalogue.
 */
export const EVENT_PAYLOAD_KEYS = {
  "user.registered": ["userId", "email"],
  "business.created": ["businessId", "organizationId", "slug", "name"],
  "business.updated": ["businessId", "fields"],
  "business.published": ["businessId", "pageCount"],
  "business.unpublished": ["businessId"],
  "business.duplicated": ["sourceBusinessId", "businessId"],
  "business.archived": ["businessId"],
  "page.published": ["businessId", "pageId", "slug", "version"],
  "page.restored": ["businessId", "pageId", "version"],
  "theme.published": ["businessId"],
  "domain.added": ["businessId", "domainId", "hostname"],
  "domain.verified": ["businessId", "domainId", "hostname"],
  "media.uploaded": ["businessId", "mediaId", "kind"],
  "service.created": ["businessId", "serviceId"],
  "project.created": ["businessId", "projectId"],
  "project.completed": ["businessId", "projectId", "customerId"],
  "form.submitted": ["businessId", "formId", "submissionId", "action"],
  "lead.created": ["businessId", "leadId", "source", "serviceId", "assignedToUserId"],
  "lead.status_changed": ["businessId", "leadId", "from", "to"],
  "customer.created": ["businessId", "customerId"],
  "quote.created": ["businessId", "quoteId", "customerId", "totalCents"],
  "quote.sent": ["businessId", "quoteId"],
  "quote.accepted": ["businessId", "quoteId", "customerId", "totalCents"],
  "quote.declined": ["businessId", "quoteId"],
  "job.created": ["businessId", "jobId", "customerId"],
  "job.stage_changed": ["businessId", "jobId", "from", "to", "isTerminal"],
  "job.completed": ["businessId", "jobId", "customerId", "projectId"],
  "invoice.created": ["businessId", "invoiceId", "totalCents"],
  "invoice.sent": ["businessId", "invoiceId"],
  "invoice.overdue": ["businessId", "invoiceId", "daysOverdue"],
  "payment.received": ["businessId", "paymentId", "invoiceId", "amountCents"],
  "booking.requested": ["businessId", "bookingId"],
  "review.requested": ["businessId", "customerId", "jobId"],
  "ai.request.completed": ["businessId", "feature", "provider", "model"],
} as const satisfies PayloadKeys;

const FIELD_LABELS: Record<string, string> = {
  businessId: "Business id",
  customerId: "Customer id",
  leadId: "Lead id",
  quoteId: "Quote id",
  jobId: "Job id",
  invoiceId: "Invoice id",
  paymentId: "Payment id",
  bookingId: "Booking id",
  projectId: "Project id",
  serviceId: "Service id",
  assignedToUserId: "Assigned user id",
  totalCents: "Total (cents)",
  amountCents: "Amount (cents)",
  daysOverdue: "Days overdue",
  isTerminal: "Is final stage",
  from: "From (previous value)",
  to: "To (new value)",
  source: "Source",
  action: "Form action",
  kind: "Media kind",
  hostname: "Hostname",
  email: "Email",
};

export interface EventFieldOption {
  value: string;
  label: string;
  group?: string;
}

/** Condition field options for one event type, prefixed "event." to match the engine context. */
export function eventFieldOptions(type: string): EventFieldOption[] {
  const keys = (EVENT_PAYLOAD_KEYS as Record<string, ReadonlyArray<string> | undefined>)[type] ?? ["businessId"];
  const label = eventLabel(type);
  return keys.map((k) => ({ value: `event.${k}`, label: FIELD_LABELS[k] ?? k, group: label }));
}

/** All field options grouped by event, for the editor before a trigger is chosen. */
export function allEventFieldOptions(): Record<string, EventFieldOption[]> {
  const out: Record<string, EventFieldOption[]> = {};
  for (const type of DOMAIN_EVENT_TYPES) out[type] = eventFieldOptions(type);
  return out;
}

/** Placeholder names usable inside action text as {{name}}. */
export function eventPlaceholders(type: string): string[] {
  return ((EVENT_PAYLOAD_KEYS as Record<string, ReadonlyArray<string> | undefined>)[type] ?? []).map((k) => `{{${k}}}`);
}
