"use client";

import * as React from "react";
import Link from "next/link";
import { Alert, Badge, Button, Input, cn } from "@/components/ui";
import { Icon } from "@/components/admin/icon";
import type { StepProps } from "./wizard";

export function StepType({ state, catalog, errors, onIndustryChange, onTemplateChange }: StepProps) {
  const [q, setQ] = React.useState("");
  const [showAllTemplates, setShowAllTemplates] = React.useState(false);
  const industries = catalog.industries.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.description ?? "").toLowerCase().includes(q.toLowerCase()));
  const templatesForIndustry = catalog.templates.filter((t) => t.industryId === state.industryId);
  const visibleTemplates = showAllTemplates || !state.industryId || templatesForIndustry.length === 0 ? catalog.templates : templatesForIndustry;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">What kind of business is this?</h3>
            <p className="text-xs text-neutral-500">The industry defines default services, pricing, custom fields, forms and workflow stages. All of it stays editable.</p>
          </div>
          <Link href="/super-admin/industries/new" className="text-sm text-neutral-700 underline-offset-2 hover:underline">
            + Create a new industry
          </Link>
        </div>
        <Input placeholder="Search industries…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-sm" />
        {errors.industryId && <p className="mb-2 text-xs text-red-600">{errors.industryId}</p>}
        {catalog.industries.length === 0 ? (
          <Alert tone="warning" title="No active industries">
            Create an industry first — every business is generated from one. <Link href="/super-admin/industries/new" className="underline">Create industry</Link>
          </Alert>
        ) : industries.length === 0 ? (
          <p className="text-sm text-neutral-500">No industries match “{q}”.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((i) => {
              const active = i.id === state.industryId;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onIndustryChange(i.id)}
                  className={cn("flex flex-col items-start rounded-xl border p-4 text-left transition", active ? "border-neutral-900 bg-neutral-900 text-white shadow" : "border-neutral-200 bg-white hover:border-neutral-400")}
                >
                  <span className={cn("mb-2 flex h-9 w-9 items-center justify-center rounded-lg", active ? "bg-white/15" : "bg-neutral-100")}>
                    <Icon name={i.icon ?? "Wrench"} className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold">{i.name}</span>
                  <span className={cn("mt-1 line-clamp-2 text-xs", active ? "text-neutral-300" : "text-neutral-500")}>{i.description ?? "No description"}</span>
                  <span className={cn("mt-2 text-[11px]", active ? "text-neutral-300" : "text-neutral-400")}>
                    {i.serviceCount} default service{i.serviceCount === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Start from a template (optional)</h3>
          <p className="text-xs text-neutral-500">A template pre-fills every later step from a saved business configuration: brand, services, pricing, areas, features, pages and forms.</p>
        </div>
        {catalog.templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            No templates yet. Save any business as a template from <Link href="/super-admin/templates" className="underline">Templates</Link>.
          </div>
        ) : (
          <>
            {state.industryId && templatesForIndustry.length > 0 && (
              <div className="mb-2 text-xs text-neutral-500">
                Showing {showAllTemplates ? "all templates" : "templates for the selected industry"} ·{" "}
                <button type="button" className="underline" onClick={() => setShowAllTemplates((v) => !v)}>
                  {showAllTemplates ? "Only this industry" : "Show all"}
                </button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void onTemplateChange(null)} className={cn("flex flex-col items-start rounded-xl border p-4 text-left", !state.templateId ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-400")}>
                <span className="text-sm font-semibold">Blank — industry defaults</span>
                <span className="mt-1 text-xs text-neutral-500">Generate everything from the industry definition.</span>
                {!state.templateId && <Badge tone="green" className="mt-2">Selected</Badge>}
              </button>
              {visibleTemplates.map((t) => {
                const active = t.id === state.templateId;
                const industry = catalog.industries.find((i) => i.id === t.industryId);
                return (
                  <div key={t.id} className={cn("flex flex-col rounded-xl border p-4", active ? "border-neutral-900" : "border-neutral-200")}>
                    {t.previewImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.previewImageUrl} alt="" className="mb-3 h-24 w-full rounded-md object-cover" />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{t.name}</span>
                      {t.isPremium && <Badge tone="purple">Premium{t.priceCents ? ` · $${(t.priceCents / 100).toFixed(0)}` : ""}</Badge>}
                      {t.category && <Badge>{t.category}</Badge>}
                    </div>
                    <span className="mt-1 line-clamp-2 text-xs text-neutral-500">{t.description ?? "No description"}</span>
                    <span className="mt-2 text-[11px] text-neutral-400">
                      {industry?.name ?? "Any industry"} · {t.counts.services ?? 0} services · {t.counts.pages ?? 0} pages · {t.counts.forms ?? 0} forms
                    </span>
                    <div className="mt-3">
                      {active ? (
                        <Badge tone="green">Selected</Badge>
                      ) : (
                        <Button type="button" size="sm" variant="secondary" onClick={() => void onTemplateChange(t.id)}>
                          Start from template
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
