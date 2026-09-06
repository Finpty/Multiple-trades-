"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export interface BusinessDetailsValues {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  tradingName: string | null;
  businessNumber: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tagline: string | null;
  description: string | null;
  country: string;
  state: string | null;
  timezone: string;
  currency: string;
  locale: string;
  taxName: string;
  taxRate: string;
  taxInclusive: boolean;
  serviceAreaText: string | null;
  industryId: string | null;
  organizationId: string;
}

export function BusinessDetailsForm({ business, industries, organizations, action, disabled }: {
  business: BusinessDetailsValues;
  industries: Array<{ id: string; name: string }>;
  organizations: Array<{ id: string; name: string }>;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  disabled?: boolean;
}) {
  return (
    <ActionForm action={action}>
      {({ fieldErrors, pending }) => (
        <fieldset disabled={disabled || pending} className="space-y-6">
          <input type="hidden" name="businessId" value={business.id} />
          <Card>
            <CardHeader title="Identity" description="Name and slug are used across the admin and the public site." />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <Field label="Business name" required error={fieldErrors.name}>
                <Input name="name" defaultValue={business.name} required maxLength={120} />
              </Field>
              <Field label="Slug" required error={fieldErrors.slug} hint="Lowercase letters, numbers and dashes. Changing it changes the site URL.">
                <Input name="slug" defaultValue={business.slug} required maxLength={60} pattern="[a-z0-9-]+" />
              </Field>
              <Field label="Legal name" error={fieldErrors.legalName}>
                <Input name="legalName" defaultValue={business.legalName ?? ""} maxLength={160} />
              </Field>
              <Field label="Trading name" error={fieldErrors.tradingName}>
                <Input name="tradingName" defaultValue={business.tradingName ?? ""} maxLength={160} />
              </Field>
              <Field label="Business number" error={fieldErrors.businessNumber}>
                <Input name="businessNumber" defaultValue={business.businessNumber ?? ""} maxLength={60} />
              </Field>
              <Field label="Tax number" error={fieldErrors.taxNumber}>
                <Input name="taxNumber" defaultValue={business.taxNumber ?? ""} maxLength={60} />
              </Field>
              <Field label="Industry" error={fieldErrors.industryId}>
                <Select name="industryId" defaultValue={business.industryId ?? ""}>
                  <option value="">No industry</option>
                  {industries.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Organisation" required error={fieldErrors.organizationId}>
                <Select name="organizationId" defaultValue={business.organizationId} required>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact & positioning" />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <Field label="Phone" error={fieldErrors.phone}>
                <Input name="phone" defaultValue={business.phone ?? ""} maxLength={40} />
              </Field>
              <Field label="Email" error={fieldErrors.email}>
                <Input name="email" type="email" defaultValue={business.email ?? ""} />
              </Field>
              <Field label="Website" error={fieldErrors.website}>
                <Input name="website" defaultValue={business.website ?? ""} maxLength={200} placeholder="https://" />
              </Field>
              <Field label="Service area (text)" error={fieldErrors.serviceAreaText} hint="Short description shown on the site, e.g. a city or region.">
                <Input name="serviceAreaText" defaultValue={business.serviceAreaText ?? ""} maxLength={200} />
              </Field>
              <Field label="Tagline" error={fieldErrors.tagline} className="md:col-span-2">
                <Input name="tagline" defaultValue={business.tagline ?? ""} maxLength={200} />
              </Field>
              <Field label="Description" error={fieldErrors.description} className="md:col-span-2">
                <Textarea name="description" defaultValue={business.description ?? ""} maxLength={4000} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Region, locale & tax" />
            <CardBody className="grid gap-4 md:grid-cols-3">
              <Field label="Country" required error={fieldErrors.country} hint="2-letter code">
                <Input name="country" defaultValue={business.country} maxLength={2} required />
              </Field>
              <Field label="State / region" error={fieldErrors.state}>
                <Input name="state" defaultValue={business.state ?? ""} maxLength={80} />
              </Field>
              <Field label="Timezone" required error={fieldErrors.timezone}>
                <Input name="timezone" defaultValue={business.timezone} required maxLength={80} />
              </Field>
              <Field label="Currency" required error={fieldErrors.currency} hint="3-letter code">
                <Input name="currency" defaultValue={business.currency} maxLength={3} required />
              </Field>
              <Field label="Locale" required error={fieldErrors.locale}>
                <Input name="locale" defaultValue={business.locale} required maxLength={20} />
              </Field>
              <Field label="Tax name" required error={fieldErrors.taxName}>
                <Input name="taxName" defaultValue={business.taxName} required maxLength={20} />
              </Field>
              <Field label="Tax rate (%)" required error={fieldErrors.taxRate}>
                <Input name="taxRate" type="number" step="0.001" min={0} max={100} defaultValue={business.taxRate} required />
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox name="taxInclusive" defaultChecked={business.taxInclusive} label="Prices include tax" />
              </div>
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <SubmitButton pendingText="Saving…">Save details</SubmitButton>
          </div>
        </fieldset>
      )}
    </ActionForm>
  );
}
