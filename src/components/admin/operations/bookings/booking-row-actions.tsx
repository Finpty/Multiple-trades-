"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export function BookingRowActions({ businessId, booking, setStatus, toJob }: { businessId: string; booking: { id: string; status: string; jobId: string | null }; setStatus: (businessId: string, id: string, status: "CONFIRMED" | "COMPLETED" | "CANCELED" | "REQUESTED") => Promise<ActionResult>; toJob: (businessId: string, id: string) => Promise<ActionResult<{ jobId: string }>> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); if (!r.ok) setErr(r.error); else { setErr(null); router.refresh(); } });
  const s = booking.status;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {err && <span className="text-xs text-red-600">{err}</span>}
      {s === "REQUESTED" && <Button size="sm" disabled={pending} onClick={() => run(() => setStatus(businessId, booking.id, "CONFIRMED"))}>Confirm</Button>}
      {s === "CONFIRMED" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setStatus(businessId, booking.id, "COMPLETED"))}>Complete</Button>}
      {(s === "REQUESTED" || s === "CONFIRMED") && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Cancel this booking?")) run(() => setStatus(businessId, booking.id, "CANCELED")); }}>Cancel</Button>}
      {s === "CANCELED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setStatus(businessId, booking.id, "REQUESTED"))}>Reopen</Button>}
      {booking.jobId ? <ButtonLink size="sm" variant="ghost" href={`/admin/${businessId}/jobs/${booking.jobId}`}>Job</ButtonLink> : s !== "CANCELED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await toJob(businessId, booking.id); if (r.ok) router.push(`/admin/${businessId}/jobs/${r.data.jobId}`); else setErr(r.error); })}>Create job</Button>}
      <ButtonLink size="sm" variant="ghost" href={`/admin/${businessId}/bookings/${booking.id}`}>Edit</ButtonLink>
    </div>
  );
}
