import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { utcToInput } from "@/lib/operations/dates";
import { Badge, PageHeader, statusTone } from "@/components/ui";
import { BookingForm } from "@/components/admin/operations/bookings/booking-form";
import { loadBookingFormData } from "../form-data";
import { saveBookingAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditBookingPage({ params }: { params: Promise<{ businessId: string; bookingId: string }> }) {
  const { businessId, bookingId } = await params;
  if (!isUuid(businessId) || !isUuid(bookingId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const [b, data] = await Promise.all([ctx.db.booking.findFirst({ where: { id: bookingId, businessId } }), loadBookingFormData(ctx)]);
  if (!b) notFound();
  const tz = ctx.business.timezone;
  const address = (b.address ?? {}) as { line1?: string; suburb?: string; state?: string; postcode?: string };
  const base = `/admin/${businessId}/bookings`;
  return (
    <div>
      <PageHeader title="Edit booking" description={<Badge tone={statusTone(b.status)}>{b.status}</Badge>} breadcrumbs={[{ label: "Bookings", href: base }, { label: "Edit" }]} />
      <BookingForm businessId={businessId} values={{ bookingId: b.id, customerId: b.customerId, serviceId: b.serviceId, startsAt: utcToInput(b.startsAt, tz), endsAt: utcToInput(b.endsAt, tz), address, notes: b.notes ?? "", assignedToUserId: b.assignedToUserId, status: b.status }} {...data} cancelHref={base} save={saveBookingAction} />
    </div>
  );
}
