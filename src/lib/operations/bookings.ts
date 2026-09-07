import { z } from "zod";
import type { Booking, BookingStatus, Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { tenantDb } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { toJson } from "@/lib/json";
import { recordAudit } from "@/lib/audit";
import { AddressSchema, addressText, createJob } from "./jobs";

export const BOOKING_STATUSES: Array<{ value: BookingStatus; label: string }> = [
  { value: "REQUESTED", label: "Requested" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELED", label: "Canceled" },
];

export const BookingInputSchema = z
  .object({
    customerId: z.string().uuid().nullable().optional(),
    serviceId: z.string().uuid().nullable().optional(),
    startsAt: z.coerce.date({ errorMap: () => ({ message: "Start date and time are required" }) }),
    endsAt: z.coerce.date().nullable().optional(),
    address: AddressSchema.default({}),
    notes: z.string().max(5000).optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    status: z.enum(["REQUESTED", "CONFIRMED", "CANCELED", "COMPLETED"]).default("REQUESTED"),
  })
  .refine((v) => !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "End must be after start" });
export type BookingInput = z.infer<typeof BookingInputSchema>;

export const bookingInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, company: true, phone: true, email: true } },
  service: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude;
export type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export interface BookingListFilter {
  range?: "upcoming" | "past";
  status?: string;
  assignee?: string;
  serviceId?: string;
}

export async function listBookings(db: TenantDb, businessId: string, f: BookingListFilter = {}): Promise<BookingRow[]> {
  const where: Prisma.BookingWhereInput = { businessId };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (f.range === "past") where.startsAt = { lt: startOfToday };
  else where.startsAt = { gte: startOfToday };
  if (f.status && BOOKING_STATUSES.some((s) => s.value === f.status)) where.status = f.status as BookingStatus;
  if (f.assignee === "unassigned") where.assignedToUserId = null;
  else if (f.assignee) where.assignedToUserId = f.assignee;
  if (f.serviceId) where.serviceId = f.serviceId;
  return db.booking.findMany({ where, include: bookingInclude, orderBy: { startsAt: f.range === "past" ? "desc" : "asc" }, take: 500 });
}

/** Groups bookings by calendar day (local time) preserving order. */
export function groupByDay<T extends { startsAt: Date }>(rows: T[], timeZone: string): Array<{ day: string; rows: T[] }> {
  const fmt = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone });
  const out: Array<{ day: string; rows: T[] }> = [];
  for (const r of rows) {
    const day = fmt.format(r.startsAt);
    const last = out[out.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else out.push({ day, rows: [r] });
  }
  return out;
}

async function assertBookingRefs(db: TenantDb, businessId: string, input: BookingInput) {
  if (input.customerId && !(await db.customer.findFirst({ where: { id: input.customerId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Customer not found.");
  if (input.serviceId && !(await db.service.findFirst({ where: { id: input.serviceId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Service not found.");
}

function bookingData(input: BookingInput) {
  return {
    customerId: input.customerId ?? null,
    serviceId: input.serviceId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    address: toJson(input.address),
    notes: input.notes || null,
    assignedToUserId: input.assignedToUserId ?? null,
    status: input.status,
  };
}

export async function createBooking(businessId: string, input: BookingInput, ctx: { actorUserId: string | null }): Promise<Booking> {
  const db = tenantDb(businessId);
  await assertBookingRefs(db, businessId, input);
  const booking = await db.booking.create({ data: { businessId, ...bookingData(input) } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "booking.created", entityType: "booking", entityId: booking.id, after: { startsAt: booking.startsAt, status: booking.status } });
  await emitEvent({ type: "booking.requested", businessId, payload: { businessId, bookingId: booking.id }, actorUserId: ctx.actorUserId });
  return booking;
}

export async function updateBooking(businessId: string, bookingId: string, input: BookingInput, ctx: { actorUserId: string | null }): Promise<Booking> {
  const db = tenantDb(businessId);
  const existing = await db.booking.findFirst({ where: { id: bookingId, businessId } });
  if (!existing) throw new Error("Booking not found.");
  await assertBookingRefs(db, businessId, input);
  const booking = await db.booking.update({ where: { id: bookingId }, data: bookingData(input) });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "booking.updated", entityType: "booking", entityId: bookingId, before: { startsAt: existing.startsAt, status: existing.status }, after: { startsAt: booking.startsAt, status: booking.status } });
  return booking;
}

export async function setBookingStatus(businessId: string, bookingId: string, status: BookingStatus, ctx: { actorUserId: string | null }): Promise<Booking> {
  const db = tenantDb(businessId);
  const existing = await db.booking.findFirst({ where: { id: bookingId, businessId } });
  if (!existing) throw new Error("Booking not found.");
  const booking = await db.booking.update({ where: { id: bookingId }, data: { status } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: `booking.${status.toLowerCase()}`, entityType: "booking", entityId: bookingId, before: { status: existing.status }, after: { status } });
  return booking;
}

/** Opens a job at the first stage of the default workflow from a booking. */
export async function createJobFromBooking(businessId: string, bookingId: string, ctx: { actorUserId: string | null }): Promise<{ jobId: string }> {
  const db = tenantDb(businessId);
  const booking = await db.booking.findFirst({ where: { id: bookingId, businessId }, include: bookingInclude });
  if (!booking) throw new Error("Booking not found.");
  const workflow = (await db.workflow.findFirst({ where: { businessId, isDefault: true, deletedAt: null } })) ?? (await db.workflow.findFirst({ where: { businessId, deletedAt: null } }));
  if (!workflow) throw new Error("Create a workflow before opening jobs.");
  const customer = booking.customer ? [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" ") : null;
  const title = [booking.service?.name ?? "Booking", customer].filter(Boolean).join(" — ");
  const job = await createJob(
    businessId,
    {
      title,
      description: booking.notes ?? undefined,
      workflowId: workflow.id,
      customerId: booking.customerId,
      priority: 0,
      scheduledStart: booking.startsAt,
      scheduledEnd: booking.endsAt,
      address: (booking.address as Record<string, string>) ?? {},
      assignedToUserId: booking.assignedToUserId,
      valueCents: null,
    },
    ctx,
  );
  await db.booking.update({ where: { id: bookingId }, data: { status: booking.status === "REQUESTED" ? "CONFIRMED" : booking.status } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "booking.job_created", entityType: "booking", entityId: bookingId, metadata: { jobId: job.id, address: addressText(booking.address) } });
  return { jobId: job.id };
}
