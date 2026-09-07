"use client";

import * as React from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import { COUNTRIES, CURRENCIES, LOCALES, TIMEZONES } from "@/components/super-admin/wizard/options";

type Act = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

export function DetailsForm({ action, initial }: { action: Act; initial: Record<string, string | number | boolean | null> }) {
  const v = (k: string) => (initial[k] === null || initial[k] === undefined ? "" : String(initial[k]));
  return (
    <ActionForm action={action} className="space-y-6" successMessage="Details saved">
      {({ fieldErrors }) => (
        <>
          <Card>
            <CardHeader title="Identity" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" required error={fieldErrors.name}><Input name="name" defaultValue={v("name")} required /></Field>
              <Field label="URL slug" required hint="Changing this changes your website address." error={fieldErrors.slug}><Input name="slug" defaultValue={v("slug")} required pattern="[a-z0-9-]+" /></Field>
              <Field label="Legal name"><Input name="legalName" defaultValue={v("legalName")} /></Field>
              <Field label="Trading name"><Input name="tradingName" defaultValue={v("tradingName")} /></Field>
              <Field label="Business number (ABN)"><Input name="businessNumber" defaultValue={v("businessNumber")} /></Field>
              <Field label="Tax number"><Input name="taxNumber" defaultValue={v("taxNumber")} /></Field>
              <Field label="Tagline" className="sm:col-span-2"><Input name="tagline" defaultValue={v("tagline")} /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea name="description" defaultValue={v("description")} /></Field>
              <Field label="Founded year" error={fieldErrors.foundedYear}><Input name="foundedYear" inputMode="numeric" defaultValue={v("foundedYear")} /></Field>
              <Field label="Service area (text)" hint='e.g. "Perth & surrounds"'><Input name="serviceAreaText" defaultValue={v("serviceAreaText")} /></Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone"><Input name="phone" defaultValue={v("phone")} /></Field>
              <Field label="Email" error={fieldErrors.email}><Input name="email" type="email" defaultValue={v("email")} /></Field>
              <Field label="Existing website" className="sm:col-span-2"><Input name="website" defaultValue={v("website")} placeholder="https://" /></Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Region & tax" />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Field label="Country"><Select name="country" defaultValue={v("country") || "AU"}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</Select></Field>
              <Field label="State / region"><Input name="state" defaultValue={v("state")} /></Field>
              <Field label="Timezone"><Select name="timezone" defaultValue={v("timezone")}>{TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
              <Field label="Currency"><Select name="currency" defaultValue={v("currency")}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</Select></Field>
              <Field label="Locale"><Select name="locale" defaultValue={v("locale")}>{LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
              <Field label="Tax name"><Input name="taxName" defaultValue={v("taxName")} /></Field>
              <Field label="Tax rate (%)" error={fieldErrors.taxRate}><Input name="taxRate" type="number" step="0.001" defaultValue={v("taxRate")} /></Field>
              <div className="flex items-end pb-2"><Checkbox name="taxInclusive" defaultChecked={initial.taxInclusive === true} label="Prices include tax" /></div>
            </CardBody>
          </Card>
          <SubmitButton>Save details</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function LocationForm({ action, initial, onCancel, deleteAction }: { action: Act; initial?: Record<string, unknown>; onCancel?: () => void; deleteAction?: () => Promise<ActionResult> }) {
  const v = (k: string) => (initial?.[k] === null || initial?.[k] === undefined ? "" : String(initial?.[k]));
  const hours = (Array.isArray(initial?.openingHours) && (initial?.openingHours as unknown[]).length === 7 ? (initial!.openingHours as Array<{ day: number; closed: boolean; open: string; close: string }>) : [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, closed: day === 0 || day === 6, open: "07:00", close: "17:00" })));
  const [pending, start] = React.useTransition();
  return (
    <ActionForm action={action} className="space-y-4" successMessage="Location saved">
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={fieldErrors.name}><Input name="name" defaultValue={v("name") || "Head office"} required /></Field>
            <Field label="Phone"><Input name="phone" defaultValue={v("phone")} /></Field>
            <Field label="Address line 1" className="sm:col-span-2"><Input name="addressLine1" defaultValue={v("addressLine1")} /></Field>
            <Field label="Address line 2" className="sm:col-span-2"><Input name="addressLine2" defaultValue={v("addressLine2")} /></Field>
            <Field label="City / suburb"><Input name="city" defaultValue={v("city")} /></Field>
            <Field label="State"><Input name="state" defaultValue={v("state")} /></Field>
            <Field label="Postcode"><Input name="postcode" defaultValue={v("postcode")} /></Field>
            <Field label="Country"><Select name="country" defaultValue={v("country") || "AU"}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</Select></Field>
            <Field label="Email" error={fieldErrors.email}><Input name="email" type="email" defaultValue={v("email")} /></Field>
            <Field label="Service radius (km)"><Input name="serviceRadiusKm" type="number" defaultValue={v("serviceRadiusKm")} /></Field>
            <Field label="Latitude"><Input name="lat" type="number" step="any" defaultValue={v("lat")} /></Field>
            <Field label="Longitude"><Input name="lng" type="number" step="any" defaultValue={v("lng")} /></Field>
          </div>
          <div className="flex gap-6"><Checkbox name="isPrimary" defaultChecked={initial?.isPrimary === true} label="Primary location" /><Checkbox name="isActive" defaultChecked={initial?.isActive !== false} label="Active" /></div>
          <div>
            <div className="mb-2 text-sm font-medium">Opening hours</div>
            <div className="space-y-1.5">
              {hours.map((h, i) => (
                <div key={h.day} className="grid grid-cols-[110px_90px_1fr_1fr] items-center gap-2 text-sm">
                  <span>{DAYS[h.day]}</span>
                  <HoursRow index={i} day={h.day} closed={h.closed} open={h.open} close={h.close} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton>Save location</SubmitButton>
            {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
            {deleteAction && <Button type="button" variant="danger" disabled={pending} onClick={() => { if (window.confirm("Remove this location?")) start(async () => { await deleteAction(); }); }}>Remove</Button>}
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Serialises one opening-hours row into the openingHours[] JSON list. */
function HoursRow({ day, closed: c0, open: o0, close: cl0 }: { index: number; day: number; closed: boolean; open: string; close: string }) {
  const [closed, setClosed] = React.useState(c0);
  const [open, setOpen] = React.useState(o0);
  const [close, setClose] = React.useState(cl0);
  return (
    <>
      <input type="hidden" name="openingHours[]:json" value={JSON.stringify({ day, closed, open, close })} />
      <Checkbox checked={closed} onChange={(e) => setClosed(e.target.checked)} label="Closed" />
      <Input type="time" value={open} disabled={closed} onChange={(e) => setOpen(e.target.value)} />
      <Input type="time" value={close} disabled={closed} onChange={(e) => setClose(e.target.value)} />
    </>
  );
}

export function TerminologyForm({ action, initial, keys }: { action: Act; initial: Record<string, string>; keys: Array<{ key: string; label: string; fallback: string }> }) {
  const [custom, setCustom] = React.useState<string[]>(Object.keys(initial).filter((k) => !keys.some((s) => s.key === k)));
  const [newKey, setNewKey] = React.useState("");
  return (
    <ActionForm action={action} className="space-y-4" successMessage="Terminology saved">
      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((k) => <Field key={k.key} label={k.label} hint={`Default: ${k.fallback}`}><Input name={`terminology.${k.key}`} defaultValue={initial[k.key] ?? k.fallback} /></Field>)}
        {custom.map((k) => <Field key={k} label={k}><Input name={`terminology.${k}`} defaultValue={initial[k] ?? ""} /></Field>)}
      </div>
      <div className="flex items-end gap-2">
        <Field label="Add custom term"><Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="site_visit" /></Field>
        <Button type="button" variant="secondary" onClick={() => { const k = newKey.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); if (k && !custom.includes(k) && !keys.some((s) => s.key === k)) setCustom([...custom, k]); setNewKey(""); }}>Add</Button>
      </div>
      <SubmitButton>Save terminology</SubmitButton>
    </ActionForm>
  );
}

export function NotificationsForm({ action, initial }: { action: Act; initial: { leadEmails: string[]; quoteEmails: string[]; paymentInstructions: string; estimateDisclaimer: string; social: Record<string, string> } }) {
  return (
    <ActionForm action={action} className="space-y-6" successMessage="Saved">
      <Card>
        <CardHeader title="Notifications" description="Who is emailed when things happen. Leave blank to use the business email." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="New lead / form submission emails" hint="Comma separated"><Input name="leadEmails" defaultValue={initial.leadEmails.join(", ")} /></Field>
          <Field label="Quote accepted / declined emails" hint="Comma separated"><Input name="quoteEmails" defaultValue={initial.quoteEmails.join(", ")} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Payments & estimates" />
        <CardBody className="grid gap-4">
          <Field label="Payment instructions" hint="Shown on public invoices when online payments are off (bank details, PayID…)."><Textarea name="paymentInstructions" defaultValue={initial.paymentInstructions} /></Field>
          <Field label="Estimate disclaimer" hint="Shown under website calculator results."><Textarea name="estimateDisclaimer" defaultValue={initial.estimateDisclaimer} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Social links" description="Shown in the website footer." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {["facebook", "instagram", "linkedin", "youtube", "tiktok", "google"].map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><Input name={`social.${k}`} defaultValue={initial.social[k] ?? ""} placeholder="https://" /></Field>)}
        </CardBody>
      </Card>
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

export function DangerZone({ businessName, archiveAction, deletionAction, unpublish, status }: { businessName: string; archiveAction: Act; deletionAction: Act; unpublish: () => Promise<ActionResult>; status: string }) {
  const [pending, start] = React.useTransition();
  return (
    <div className="space-y-6">
      {status === "PUBLISHED" && (
        <Card><CardHeader title="Take the website offline" description="Visitors see a not-found page until you publish again. Nothing is deleted." /><CardBody><Button variant="secondary" disabled={pending} onClick={() => { if (window.confirm("Unpublish the website?")) start(async () => { await unpublish(); window.location.reload(); }); }}>Unpublish website</Button></CardBody></Card>
      )}
      <Card>
        <CardHeader title="Archive this business" description="Hides the business and its website. Data is kept and platform staff can restore it." />
        <CardBody>
          <ActionForm action={archiveAction} className="space-y-3">
            <Field label={`Type "${businessName}" to confirm`}><Input name="confirmName" /></Field>
            <ConfirmButton variant="danger" confirm="Archive this business now?">Archive business</ConfirmButton>
          </ActionForm>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Request permanent deletion" description="Sends a request to the platform team. Deletion is irreversible and is performed manually after review." />
        <CardBody>
          <ActionForm action={deletionAction} className="space-y-3" successMessage="Request sent">
            <Field label="Reason"><Textarea name="reason" /></Field>
            <SubmitButton variant="secondary">Request deletion</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
