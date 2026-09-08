"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { resolveCustomerFromForm } from "@/lib/operations/customers";
import { zonedToUtc } from "@/lib/operations/dates";
import { BookingInputSchema, createBooking, createJobFromBooking, setBookingStatus, updateBooking } from "@/lib/operations/bookings";

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}
function revalidate(businessId: string) {
  revalidatePath(`/admin/${businessId}/bookings`);
  revalidatePath(`/admin/${businessId}/jobs`);
  revalidatePath(`/admin/${businessId}/customers`);
}

export async function saveBookingAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const bookingId = optStr(obj.bookingId);
    const customerId = await resolveCustomerFromForm(ctx.db, businessId, obj, ctx.user.id);
    const tz = ctx.business.timezone;
    const input = BookingInputSchema.parse({
      customerId,
      serviceId: optStr(obj.serviceId) ?? null,
      startsAt: zonedToUtc(obj.startsAt, tz) ?? undefined,
      endsAt: zonedToUtc(obj.endsAt, tz),
      address: { line1: optStr(obj["address.line1"]), suburb: optStr(obj["address.suburb"]), state: optStr(obj["address.state"]), postcode: optStr(obj["address.postcode"]) },
      notes: optStr(obj.notes),
      assignedToUserId: optStr(obj.assignedToUserId) ?? null,
      status: optStr(obj.status) ?? "REQUESTED",
    });
    const booking = bookingId ? await updateBooking(businessId, idFrom(bookingId, "booking"), input, { actorUserId: ctx.user.id }) : await createBooking(businessId, input, { actorUserId: ctx.user.id });
    revalidate(businessId);
    return ok({ id: booking.id }, bookingId ? "Booking updated" : "Booking created");
  });
}

export async function bookingStatusAction(businessId: string, bookingId: string, status: "CONFIRMED" | "COMPLETED" | "CANCELED" | "REQUESTED"): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    await setBookingStatus(businessId, idFrom(bookingId, "booking"), status, { actorUserId: ctx.user.id });
    revalidate(businessId);
    return ok(undefined, { CONFIRMED: "Booking confirmed", COMPLETED: "Booking completed", CANCELED: "Booking cancelled", REQUESTED: "Booking reopened" }[status]);
  });
}

export async function bookingToJobAction(businessId: string, bookingId: string): Promise<ActionResult<{ jobId: string }>> {
  return runAction<{ jobId: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const r = await createJobFromBooking(businessId, idFrom(bookingId, "booking"), { actorUserId: ctx.user.id });
    revalidate(businessId);
    return ok(r, "Job created from booking");
  });
}
