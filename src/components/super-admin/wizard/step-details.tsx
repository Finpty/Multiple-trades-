"use client";

import * as React from "react";
import { Alert, Checkbox, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { checkSlugAction, type SlugCheckResult } from "@/app/super-admin/create-business/actions";
import { COUNTRIES, CURRENCIES, LOCALES, TIMEZONES } from "./options";
import { slugifyClient, type WizardDetails } from "./types";
import type { StepProps } from "./wizard";

export function StepDetails({ state, patch, catalog, errors }: StepProps) {
  const d = state.details;
  const set = (p: Partial<WizardDetails>) => patch((prev) => ({ details: { ...prev.details, ...p } }));
  const [slugCheck, setSlugCheck] = React.useState<SlugCheckResult | null>(null);
  const [checking, setChecking] = React.useState(false);

  // Auto slug from name until the user edits the slug.
  React.useEffect(() => {
    if (!d.slugTouched) {
      const auto = slugifyClient(d.name);
      if (auto !== d.slug) set({ slug: auto });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.name, d.slugTouched]);

  // Live availability check (debounced).
  React.useEffect(() => {
    const slug = d.slug.trim();
    if (slug.length < 2) {
      setSlugCheck(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      const res = await checkSlugAction(slug);
      if (cancelled) return;
      setChecking(false);
      setSlugCheck(res.ok ? res.data : null);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [d.slug]);

  const err = (k: string) => errors[`details.${k}`];
  const cols = "grid gap-4 sm:grid-cols-2";

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Identity</h3>
        <div className={cols}>
          <Field label="Business name" required error={err("name")} className="sm:col-span-2">
            <Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. the trading name customers know" autoFocus />
          </Field>
          <Field label="Legal name" error={err("legalName")}>
            <Input value={d.legalName} onChange={(e) => set({ legalName: e.target.value })} />
          </Field>
          <Field label="Trading name" error={err("tradingName")}>
            <Input value={d.tradingName} onChange={(e) => set({ tradingName: e.target.value })} />
          </Field>
          <Field label="Business number" hint="ABN / company number" error={err("businessNumber")}>
            <Input value={d.businessNumber} onChange={(e) => set({ businessNumber: e.target.value })} />
          </Field>
          <Field label="Tax number" error={err("taxNumber")}>
            <Input value={d.taxNumber} onChange={(e) => set({ taxNumber: e.target.value })} />
          </Field>
          <Field label="Tagline" hint="Shown in the website hero" error={err("tagline")} className="sm:col-span-2">
            <Input value={d.tagline} onChange={(e) => set({ tagline: e.target.value })} />
          </Field>
          <Field label="Description" error={err("description")} className="sm:col-span-2">
            <Textarea value={d.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="Founded year" error={err("foundedYear")}>
            <Input inputMode="numeric" value={d.foundedYear} onChange={(e) => set({ foundedYear: e.target.value })} placeholder="e.g. 2012" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Web address</h3>
        <Field label="Slug" required hint="Lowercase letters, numbers and dashes." error={err("slug") ?? (slugCheck && !slugCheck.available ? (slugCheck.reserved ? "This slug is reserved." : "This slug is taken.") : undefined)}>
          <div className="flex gap-2">
            <Input value={d.slug} onChange={(e) => set({ slug: slugifyClient(e.target.value, 60), slugTouched: true })} />
            {d.slugTouched && (
              <button type="button" className="shrink-0 text-xs text-neutral-600 underline" onClick={() => set({ slugTouched: false, slug: slugifyClient(d.name) })}>
                Reset
              </button>
            )}
          </div>
        </Field>
        <div className={cn("rounded-lg border px-3 py-2 text-xs", checking ? "border-neutral-200 bg-neutral-50 text-neutral-500" : slugCheck?.available ? "border-emerald-200 bg-emerald-50 text-emerald-900" : slugCheck ? "border-amber-200 bg-amber-50 text-amber-900" : "border-neutral-200 bg-neutral-50 text-neutral-500")}>
          {checking ? (
            "Checking availability…"
          ) : slugCheck ? (
            <>
              <div className="font-medium">{slugCheck.available ? "Available" : `Not available — suggested: ${slugCheck.suggested}`}</div>
              <div className="mt-1 font-mono">{slugCheck.pathUrl}</div>
              <div className="font-mono">https://{slugCheck.subdomainUrl}</div>
              {!slugCheck.available && (
                <button type="button" className="mt-1 underline" onClick={() => set({ slug: slugCheck.suggested, slugTouched: true })}>
                  Use {slugCheck.suggested}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="font-mono">{catalog.platformUrl}/{d.slug || "your-slug"}</div>
              <div className="font-mono">https://{d.slug || "your-slug"}.{catalog.platformHost}</div>
            </>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Contact</h3>
        <div className={cols}>
          <Field label="Phone" error={err("phone")}>
            <Input value={d.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email" error={err("email")}>
            <Input type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Website" hint="Existing site, if any" error={err("website")} className="sm:col-span-2">
            <Input value={d.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Address</h3>
        <div className={cols}>
          <Field label="Address line 1" className="sm:col-span-2">
            <Input value={d.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input value={d.addressLine2} onChange={(e) => set({ addressLine2: e.target.value })} />
          </Field>
          <Field label="City / suburb">
            <Input value={d.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="State / region">
            <Input value={d.state} onChange={(e) => set({ state: e.target.value })} />
          </Field>
          <Field label="Postcode">
            <Input value={d.postcode} onChange={(e) => set({ postcode: e.target.value })} />
          </Field>
          <Field label="Country" error={err("country")}>
            <Select value={d.country} onChange={(e) => set({ country: e.target.value })}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Service area (text)" hint='Used in copy, e.g. "Perth & surrounds"' className="sm:col-span-2">
            <Input value={d.serviceAreaText} onChange={(e) => set({ serviceAreaText: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Locale &amp; tax</h3>
        <div className={cols}>
          <Field label="Timezone">
            <Select value={d.timezone} onChange={(e) => set({ timezone: e.target.value })}>
              {[...new Set([d.timezone, ...TIMEZONES])].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={d.currency} onChange={(e) => set({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Locale">
            <Select value={d.locale} onChange={(e) => set({ locale: e.target.value })}>
              {[...new Set([d.locale, ...LOCALES])].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tax name">
            <Input value={d.taxName} onChange={(e) => set({ taxName: e.target.value })} placeholder="GST" />
          </Field>
          <Field label="Tax rate (%)" error={err("taxRate")}>
            <Input inputMode="decimal" value={d.taxRate} onChange={(e) => set({ taxRate: e.target.value })} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label="Prices include tax" checked={d.taxInclusive} onChange={(e) => set({ taxInclusive: e.target.checked })} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Organisation</h3>
        <p className="text-xs text-neutral-500">An organisation is the billing/ownership boundary. It may own several businesses.</p>
        <div className={cols}>
          <Field label="Organisation" error={err("organizationId")}>
            <Select value={d.organizationMode === "new" ? "__new" : d.organizationId} onChange={(e) => (e.target.value === "__new" ? set({ organizationMode: "new", organizationId: "" }) : set({ organizationMode: "existing", organizationId: e.target.value }))}>
              <option value="__new">Create a new organisation</option>
              {catalog.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          {d.organizationMode === "new" && (
            <Field label="New organisation name" hint="Defaults to the business name">
              <Input value={d.organizationName} onChange={(e) => set({ organizationName: e.target.value })} placeholder={d.name || "Organisation name"} />
            </Field>
          )}
        </div>
        {d.organizationMode === "existing" && <Alert tone="info">Members of the chosen organisation with business permissions will be able to open this business.</Alert>}
      </section>
    </div>
  );
}
