"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomerSelect, type CustomerChoice } from "@/components/admin/operations/jobs/customer-select";
import type { ActionResult } from "@/lib/actions";

export interface BookingFormValues { bookingId: string | null; customerId: string | null; serviceId: string | null; startsAt: string; endsAt: string; address: { line1?: string; suburb?: string; state?: string; postcode?: string }; notes: string; assignedToUserId: string | null; status: string }

export function BookingForm({ businessId, values, customers, services, members, statuses, cancelHref, save }: { businessId: string; values: BookingFormValues; customers: CustomerChoice[]; services: Array<{ id: string; name: string }>; members: Array<{ id: string; name: string }>; statuses: Array<{ value: string; label: string }>; cancelHref: string; save: (prev: ActionResult<{ id: string }> | undefined, fd: FormData) => Promise<ActionResult<{ id: string }>> }) {
  const router = useRouter();
  const onSuccess = React.useCallback(() => router.push(`/admin/${businessId}/bookings`), [router, businessId]);
  return (
    <ActionForm action={save} onSuccess={onSuccess} refreshOnSuccess={false}>
      {({ fieldErrors }) => (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <input type="hidden" name="businessId" value={businessId} />
          {values.bookingId && <input type="hidden" name="bookingId" value={values.bookingId} />}
          <div className="space-y-4">
            <Card><CardHeader title="When & what" /><CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" required error={fieldErrors.startsAt}><Input type="datetime-local" name="startsAt" defaultValue={values.startsAt} required /></Field>
              <Field label="Ends" error={fieldErrors.endsAt}><Input type="datetime-local" name="endsAt" defaultValue={values.endsAt} /></Field>
              <Field label="Service" className="sm:col-span-2"><Select name="serviceId" defaultValue={values.serviceId ?? ""}><option value="">Not specified</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <div className="sm:col-span-2"><CustomerSelect customers={customers} value={values.customerId} errors={fieldErrors} /></div>
            </CardBody></Card>
            <Card><CardHeader title="Site address" /><CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Street" className="sm:col-span-2"><Input name="address.line1" defaultValue={values.address.line1 ?? ""} /></Field>
              <Field label="Suburb"><Input name="address.suburb" defaultValue={values.address.suburb ?? ""} /></Field>
              <Field label="State"><Input name="address.state" defaultValue={values.address.state ?? ""} /></Field>
              <Field label="Postcode"><Input name="address.postcode" defaultValue={values.address.postcode ?? ""} /></Field>
            </CardBody></Card>
            <Card><CardBody><Field label="Notes"><Textarea name="notes" rows={3} defaultValue={values.notes} placeholder="Access, parking, what to bring…" /></Field></CardBody></Card>
          </div>
          <div className="space-y-4">
            <Card><CardHeader title="Assignment" /><CardBody className="space-y-4">
              <Field label="Status"><Select name="status" defaultValue={values.status}>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
              <Field label="Assigned to"><Select name="assignedToUserId" defaultValue={values.assignedToUserId ?? ""}><option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
            </CardBody></Card>
            <div className="flex gap-2"><SubmitButton>{values.bookingId ? "Save booking" : "Create booking"}</SubmitButton><ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink></div>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
