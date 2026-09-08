/**
 * Domain event catalogue. Every important mutation emits one of these. Handlers
 * (automation rules, notifications, analytics, webhooks, AI assistants) subscribe
 * to the type; the emitting module never knows who listens.
 */
export interface DomainEventPayloads {
  "user.registered": { userId: string; email: string };
  "business.created": { businessId: string; organizationId: string; slug: string; name: string };
  "business.updated": { businessId: string; fields: string[] };
  "business.published": { businessId: string; pageCount: number };
  "business.unpublished": { businessId: string };
  "business.duplicated": { sourceBusinessId: string; businessId: string };
  "business.archived": { businessId: string };
  "page.published": { businessId: string; pageId: string; slug: string; version: number };
  "page.restored": { businessId: string; pageId: string; version: number };
  "theme.restored": { businessId: string; version: number };
  "theme.published": { businessId: string };
  "domain.added": { businessId: string; domainId: string; hostname: string };
  "domain.verified": { businessId: string; domainId: string; hostname: string };
  "media.uploaded": { businessId: string; mediaId: string; kind: string };
  "service.created": { businessId: string; serviceId: string };
  "project.created": { businessId: string; projectId: string };
  "project.completed": { businessId: string; projectId: string; customerId?: string | null };
  "form.submitted": { businessId: string; formId: string; submissionId: string; action: string };
  "lead.created": { businessId: string; leadId: string; source?: string | null; serviceId?: string | null; assignedToUserId?: string | null };
  "lead.status_changed": { businessId: string; leadId: string; from: string; to: string };
  "customer.created": { businessId: string; customerId: string };
  "quote.created": { businessId: string; quoteId: string; customerId?: string | null; totalCents: number };
  "quote.sent": { businessId: string; quoteId: string };
  "quote.accepted": { businessId: string; quoteId: string; customerId?: string | null; totalCents: number };
  "quote.declined": { businessId: string; quoteId: string };
  "job.created": { businessId: string; jobId: string; customerId?: string | null };
  "job.stage_changed": { businessId: string; jobId: string; from: string | null; to: string; isTerminal: boolean };
  "job.completed": { businessId: string; jobId: string; customerId?: string | null; projectId?: string | null };
  "invoice.created": { businessId: string; invoiceId: string; totalCents: number };
  "invoice.sent": { businessId: string; invoiceId: string };
  "invoice.overdue": { businessId: string; invoiceId: string; daysOverdue: number };
  "payment.received": { businessId: string; paymentId: string; invoiceId?: string | null; amountCents: number };
  "booking.requested": { businessId: string; bookingId: string };
  "review.requested": { businessId: string; customerId?: string | null; jobId?: string | null };
  "ai.request.completed": { businessId?: string | null; feature: string; provider: string; model: string };
}

export type DomainEventType = keyof DomainEventPayloads;

export interface DomainEventEnvelope<T extends DomainEventType = DomainEventType> {
  id: string;
  type: T;
  payload: DomainEventPayloads[T];
  businessId: string | null;
  organizationId: string | null;
  actorUserId: string | null;
  createdAt: Date;
}

export const DOMAIN_EVENT_TYPES = [
  "user.registered",
  "business.created",
  "business.updated",
  "business.published",
  "business.unpublished",
  "business.duplicated",
  "business.archived",
  "page.published",
  "page.restored",
  "theme.restored",
  "theme.published",
  "domain.added",
  "domain.verified",
  "media.uploaded",
  "service.created",
  "project.created",
  "project.completed",
  "form.submitted",
  "lead.created",
  "lead.status_changed",
  "customer.created",
  "quote.created",
  "quote.sent",
  "quote.accepted",
  "quote.declined",
  "job.created",
  "job.stage_changed",
  "job.completed",
  "invoice.created",
  "invoice.sent",
  "invoice.overdue",
  "payment.received",
  "booking.requested",
  "review.requested",
  "ai.request.completed",
] as const satisfies readonly DomainEventType[];
