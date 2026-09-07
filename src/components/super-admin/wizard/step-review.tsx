"use client";

import { Button, Checkbox, Description, cn } from "@/components/ui";
import type { StepProps } from "./wizard";

export function StepReview({ state, patch, catalog, onGoTo, onSubmit, submitting }: StepProps) {
  const industry = catalog.industries.find((i) => i.id === state.industryId);
  const family = catalog.designFamilies.find((f) => f.slug === state.designFamilySlug) ?? catalog.designFamilies[0];
  const d = state.details;
  const Section = ({ title, step, children }: { title: string; step: number; children: React.ReactNode }) => (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><button type="button" className="text-xs text-neutral-600 underline" onClick={() => onGoTo(step)}>Edit</button></div>
      {children}
    </div>
  );
  return (
    <div className="space-y-4">
      <Section title="Business type" step={0}><Description items={[{ label: "Industry", value: industry?.name ?? "—" }, { label: "Template", value: state.templateName ?? "None (industry defaults)" }]} /></Section>
      <Section title="Details" step={1}>
        <Description items={[{ label: "Name", value: d.name }, { label: "URL", value: `${catalog.platformUrl}/${d.slug}` }, { label: "Legal name", value: d.legalName }, { label: "Business number", value: d.businessNumber }, { label: "Phone", value: d.phone }, { label: "Email", value: d.email }, { label: "Address", value: [d.addressLine1, d.city, d.state, d.postcode].filter(Boolean).join(", ") }, { label: "Service area", value: d.serviceAreaText }, { label: "Tax", value: `${d.taxName} ${d.taxRate}% ${d.taxInclusive ? "inclusive" : "exclusive"}` }, { label: "Organisation", value: d.organizationMode === "existing" ? catalog.organizations.find((o) => o.id === d.organizationId)?.name ?? "—" : d.organizationName || `New: ${d.name}` }]} />
      </Section>
      <Section title="Brand & style" step={2}><Description items={[{ label: "Design family", value: family?.name ?? "Platform default" }, { label: "Brand overrides", value: Object.keys(state.brandOverrides).length ? `${Object.keys(state.brandOverrides).length} customised` : "None" }]} /></Section>
      <Section title="Services" step={4}>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">{state.services.map((s) => <li key={s.uid} className={cn(s.depth > 0 && "pl-4 text-neutral-600", !s.isEnabled && "line-through opacity-60")}>{s.name || "(unnamed)"}</li>)}</ul>
      </Section>
      <Section title="Pricing" step={5}><p className="text-sm text-neutral-700">{state.pricingItems.length} pricing item(s): {state.pricingItems.slice(0, 6).map((p) => p.label).join(", ")}{state.pricingItems.length > 6 ? "…" : ""}</p></Section>
      <Section title="Service areas" step={6}><p className="text-sm text-neutral-700">{state.serviceAreas.length ? state.serviceAreas.map((a) => a.name + (a.isPrimary ? " (primary)" : "")).join(", ") : "None yet"}</p></Section>
      <Section title="Features" step={7}><p className="text-sm text-neutral-700">{state.features.length} enabled: {state.features.map((k) => catalog.features.find((f) => f.key === k)?.name ?? k).join(", ")}</p></Section>
      <Section title="Users" step={8}><p className="text-sm text-neutral-700">{state.owner.email ? `Invite ${state.owner.name || state.owner.email} as Business Owner` : "No owner invited yet"}</p></Section>
      <div className="rounded-lg bg-neutral-50 p-4">
        <Checkbox checked={state.publishNow} onChange={(e) => patch({ publishNow: e.target.checked })} label="Publish the website immediately after creation (you can unpublish any time)" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="lg" disabled={submitting} onClick={() => onSubmit(state.publishNow)}>{submitting ? "Creating…" : "Create business"}</Button>
          {!state.publishNow && <Button size="lg" variant="secondary" disabled={submitting} onClick={() => onSubmit(true)}>Create and publish now</Button>}
        </div>
        <p className="mt-2 text-xs text-neutral-500">Creates the business, theme, services, pricing, areas, forms, workflow, custom fields, pages and navigation from your choices. Nothing here requires code or AI.</p>
      </div>
    </div>
  );
}
