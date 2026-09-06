"use client";

import { Field, Input, Alert } from "@/components/ui";
import type { StepProps } from "./wizard";

export function StepUsers({ state, patch, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">Optionally invite the business owner now. They receive an email link to set their password and land in their business admin with the <strong>Business Owner</strong> role. You keep platform access to every business regardless.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner email" error={errors["owner.email"]}><Input type="email" value={state.owner.email} placeholder="owner@example.com" onChange={(e) => patch({ owner: { ...state.owner, email: e.target.value } })} /></Field>
        <Field label="Owner name"><Input value={state.owner.name} placeholder="Full name" onChange={(e) => patch({ owner: { ...state.owner, name: e.target.value } })} /></Field>
      </div>
      <Alert tone="neutral">More users and roles (admin, editor, staff, viewer) can be added later from the business admin under <em>Users &amp; Roles</em>.</Alert>
    </div>
  );
}
