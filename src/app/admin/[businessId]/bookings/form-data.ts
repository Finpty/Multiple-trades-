import type { BusinessContext } from "@/lib/authz";
import { listBusinessMembers } from "@/lib/crm/members";
import { listCustomerOptions } from "@/lib/operations/customers";
import { BOOKING_STATUSES } from "@/lib/operations/bookings";

export async function loadBookingFormData(ctx: BusinessContext) {
  const businessId = ctx.business.id;
  const [customers, services, members] = await Promise.all([
    listCustomerOptions(ctx.db, businessId),
    ctx.db.service.findMany({ where: { businessId, isEnabled: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listBusinessMembers(businessId),
  ]);
  return { customers: customers.map((c) => ({ id: c.id, label: `${c.label}${c.phone ? ` · ${c.phone}` : ""}` })), services, members: members.map((m) => ({ id: m.id, name: m.name })), statuses: BOOKING_STATUSES.map((s) => ({ value: s.value, label: s.label })) };
}
