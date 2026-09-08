import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { BOOKING_STATUSES, groupByDay, listBookings } from "@/lib/operations/bookings";
import { addressText } from "@/lib/operations/jobs";
import { fmtTime } from "@/lib/operations/dates";
import { listBusinessMembers } from "@/lib/crm/members";
import { customerName } from "@/lib/operations/customers";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Select, cn, statusTone } from "@/components/ui";
import { BookingRowActions } from "@/components/admin/operations/bookings/booking-row-actions";
import { bookingStatusAction, bookingToJobAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BookingsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ range?: string; status?: string; assignee?: string; focus?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const sp = await searchParams;
  const range = sp.range === "past" ? "past" : "upcoming";
  const [rows, members, jobs] = await Promise.all([
    listBookings(ctx.db, businessId, { range, status: sp.status, assignee: sp.assignee }),
    listBusinessMembers(businessId),
    ctx.db.job.findMany({ where: { businessId, deletedAt: null, scheduledStart: { not: null } }, select: { id: true, customerId: true, scheduledStart: true } }),
  ]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const jobFor = (b: { customerId: string | null; startsAt: Date }) => jobs.find((j) => j.customerId === b.customerId && j.scheduledStart && Math.abs(j.scheduledStart.getTime() - b.startsAt.getTime()) < 60_000)?.id ?? null;
  const groups = groupByDay(rows, ctx.business.timezone);
  const base = `/admin/${businessId}/bookings`;
  const qs = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(); const merged = { range, status: sp.status, assignee: sp.assignee, ...patch }; for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v); const s = p.toString(); return s ? `${base}?${s}` : base; };
  return (
    <div>
      <PageHeader title="Bookings" description="Site visits and appointments. Requests from the website land here; confirm them, assign a team member and open a job when work is agreed." actions={<ButtonLink href={`${base}/new`}>New booking</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">{(["upcoming", "past"] as const).map((r) => <Link key={r} href={qs({ range: r })} className={cn("rounded-full px-3 py-1 text-sm capitalize", r === range ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>{r}</Link>)}</div>
        <form className="ml-auto flex gap-2" action={base}>
          <input type="hidden" name="range" value={range} />
          <Select name="status" defaultValue={sp.status ?? ""} className="w-auto" aria-label="Status"><option value="">Any status</option>{BOOKING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
          <Select name="assignee" defaultValue={sp.assignee ?? ""} className="w-auto" aria-label="Assignee"><option value="">Anyone</option><option value="unassigned">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
          <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">Filter</button>
        </form>
      </div>
      {rows.length === 0 ? <EmptyState title={range === "past" ? "No past bookings" : "No upcoming bookings"} description="Bookings made through the website appear here automatically." action={<ButtonLink href={`${base}/new`}>New booking</ButtonLink>} /> : (
        <div className="space-y-5">
          {groups.map((g) => (
            <Card key={g.day}>
              <div className="border-b px-4 py-2 text-sm font-semibold">{g.day}</div>
              <ul className="divide-y">
                {g.rows.map((b) => (
                  <li key={b.id} id={b.id} className={cn("grid gap-3 px-4 py-3 text-sm md:grid-cols-[110px_minmax(0,1fr)_140px_auto] md:items-center", sp.focus === b.id && "bg-amber-50")}>
                    <div className="font-medium tabular-nums">{fmtTime(b.startsAt, ctx.business.timezone)}{b.endsAt ? ` – ${fmtTime(b.endsAt, ctx.business.timezone)}` : ""}</div>
                    <div className="min-w-0">
                      <div className="font-medium">{b.service?.name ?? "Booking"}{b.customer && <> · <Link href={`/admin/${businessId}/customers/${b.customer.id}`} className="hover:underline">{customerName(b.customer)}</Link></>}</div>
                      <div className="truncate text-xs text-neutral-500">{[addressText(b.address), b.customer?.phone, b.notes].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="flex flex-wrap gap-1"><Badge tone={statusTone(b.status)}>{b.status}</Badge><span className="text-xs text-neutral-500">{b.assignedToUserId ? (memberName.get(b.assignedToUserId) ?? "Assigned") : "Unassigned"}</span></div>
                    <BookingRowActions businessId={businessId} booking={{ id: b.id, status: b.status, jobId: jobFor(b) }} setStatus={bookingStatusAction} toJob={bookingToJobAction} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
