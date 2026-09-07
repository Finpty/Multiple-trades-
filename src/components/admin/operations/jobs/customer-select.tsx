"use client";

import * as React from "react";
import { Field, Input, Select } from "@/components/ui";

export interface CustomerChoice {
  id: string;
  label: string;
}

/**
 * Customer picker with an inline "create new" path. Emits `customerId`
 * (existing id or "__new") plus `newCustomer.*` fields consumed by
 * resolveCustomerFromForm on the server.
 */
export function CustomerSelect({ customers, value, errors = {}, required, label = "Customer" }: { customers: CustomerChoice[]; value?: string | null; errors?: Record<string, string>; required?: boolean; label?: string }) {
  const [choice, setChoice] = React.useState<string>(value ?? "");
  const isNew = choice === "__new";
  return (
    <div className="space-y-3">
      <Field label={label} error={errors.customerId} required={required}>
        <Select name="customerId" value={choice} onChange={(e) => setChoice(e.target.value)} required={required}>
          <option value="">No customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
          <option value="__new">+ Create new customer…</option>
        </Select>
      </Field>
      {isNew && (
        <div className="grid gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName}>
            <Input name="newCustomer.firstName" required placeholder="Jane" />
          </Field>
          <Field label="Last name" error={errors.lastName}>
            <Input name="newCustomer.lastName" placeholder="Smith" />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input name="newCustomer.email" type="email" placeholder="jane@example.com" />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input name="newCustomer.phone" placeholder="04xx xxx xxx" />
          </Field>
        </div>
      )}
    </div>
  );
}
