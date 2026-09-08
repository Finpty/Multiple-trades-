import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { utcToInput } from "@/lib/operations/dates";
import { PageHeader } from "@/components/ui";
import { BookingForm } from "@/components/admin/operations/bookings/booking-form";
import { loadBookingFormData } from "../form-data";
import { saveBookingAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ customerId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const sp = await searchParams;
  const data = await loadBookingFormData(ctx);
  const tomorrow = new Date(Date.now() + 86_400_000); tomorrow.setUTCHours(0, 0, 0, 0);
  const start = utcToInput(tomorrow, ctx.business.timezone).slice(0, 10) + "T09:00";
  const base = `/admin/${businessId}/bookings`;
  return (
    <div>
      <PageHeader title="New booking" breadcrumbs={[{ label: "Bookings", href: base }, { label: "New" }]} />
      <BookingForm businessId={businessId} values={{ bookingId: null, customerId: isUuid(sp.customerId) ? sp.customerId! : null, serviceId: null, startsAt: start, endsAt: "", address: {}, notes: "", assignedToUserId: null, status: "CONFIRMED" }} {...data} cancelHref={base} save={saveBookingAction} />
    </div>
  );
}
