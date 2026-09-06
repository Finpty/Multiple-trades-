import type { Booking, Customer, Invoice, Job, Quote } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { tenantDb } from "@/lib/db";
import { asArray } from "@/lib/json";
import type { SiteContext } from "@/lib/tenant/resolve";

/**
 * Customer portal data. A visitor sees the portal only when their platform
 * session belongs to a user linked as Customer.portalUserId of THIS business.
 * Everything is read-only; documents open through their public tokens on the
 * platform host (/q/<token>, /i/<token>).
 */
export type PortalQuote = Pick<Quote, "id" | "number" | "title" | "status" | "currency" | "totalCents" | "validUntil" | "publicToken" | "sentAt" | "acceptedAt" | "updatedAt">;
export type PortalInvoice = Pick<Invoice, "id" | "number" | "status" | "currency" | "totalCents" | "paidCents" | "dueAt" | "publicToken" | "updatedAt">;
export type PortalJob = Pick<Job, "id" | "number" | "title" | "status" | "stageKey" | "scheduledStart" | "scheduledEnd" | "completedAt" | "updatedAt"> & { stageName: string; stageColor: string | null };
export type PortalBooking = Pick<Booking, "id" | "startsAt" | "endsAt" | "status" | "notes"> & { serviceName: string | null };

export interface PortalData {
  customer: Pick<Customer, "id" | "firstName" | "lastName" | "email">;
  quotes: PortalQuote[];
  invoices: PortalInvoice[];
  jobs: PortalJob[];
  bookings: PortalBooking[];
}

export type PortalState = { kind: "anonymous" } | { kind: "not-customer"; email: string | null } | { kind: "ready"; data: PortalData };

export async function loadPortal(ctx: SiteContext): Promise<PortalState> {
  const { user } = await getCurrentSession();
  if (!user) return { kind: "anonymous" };
  const businessId = ctx.business.id;
  const db = tenantDb(businessId);
  const customer = await db.customer.findFirst({ where: { businessId, portalUserId: user.id, deletedAt: null, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, email: true } });
  if (!customer) return { kind: "not-customer", email: user.email ?? null };

  const [quotes, invoices, jobs, bookings, workflows] = await Promise.all([
    db.quote.findMany({ where: { businessId, customerId: customer.id, deletedAt: null, status: { notIn: ["DRAFT", "ARCHIVED"] } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, number: true, title: true, status: true, currency: true, totalCents: true, validUntil: true, publicToken: true, sentAt: true, acceptedAt: true, updatedAt: true } }),
    db.invoice.findMany({ where: { businessId, customerId: customer.id, deletedAt: null, status: { not: "DRAFT" } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, number: true, status: true, currency: true, totalCents: true, paidCents: true, dueAt: true, publicToken: true, updatedAt: true } }),
    db.job.findMany({ where: { businessId, customerId: customer.id, deletedAt: null, status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, number: true, title: true, status: true, stageKey: true, workflowId: true, scheduledStart: true, scheduledEnd: true, completedAt: true, updatedAt: true } }),
    db.booking.findMany({ where: { businessId, customerId: customer.id }, orderBy: { startsAt: "desc" }, take: 50, select: { id: true, startsAt: true, endsAt: true, status: true, notes: true, service: { select: { name: true } } } }),
    db.workflow.findMany({ where: { businessId }, select: { id: true, stages: true } }),
  ]);

  const stageLookup = new Map<string, { name: string; color: string | null }>();
  for (const wf of workflows) {
    for (const s of asArray<Record<string, unknown>>(wf.stages)) {
      if (s && typeof s.key === "string" && typeof s.name === "string") stageLookup.set(`${wf.id}:${s.key}`, { name: s.name, color: typeof s.color === "string" ? s.color : null });
    }
  }

  return {
    kind: "ready",
    data: {
      customer,
      quotes,
      invoices,
      jobs: jobs.map(({ workflowId, ...j }) => {
        const stage = stageLookup.get(`${workflowId}:${j.stageKey}`);
        return { ...j, stageName: stage?.name ?? j.stageKey.replace(/[_-]+/g, " "), stageColor: stage?.color ?? null };
      }),
      bookings: bookings.map(({ service, ...b }) => ({ ...b, serviceName: service?.name ?? null })),
    },
  };
}
