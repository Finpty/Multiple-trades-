"use client";

import Link from "next/link";
import { Alert, Badge, cn } from "@/components/ui";
import { LivePreview } from "./preview";
import type { StepProps } from "./wizard";

export function StepStyle({ state, patch, catalog, tokens }: StepProps) {
  const industry = catalog.industries.find((i) => i.id === state.industryId);
  const current = state.designFamilySlug ?? catalog.designFamilies[0]?.slug ?? null;
  return (
    <div className="space-y-6">
      <p className="text-xs text-neutral-500">
        A design family is a preset of design tokens — not a separate website. Pick the closest look; your brand edits from the previous step stay on top. More families can be added in{" "}
        <Link href="/super-admin/design-system" className="underline">
          Design System
        </Link>
        .
      </p>
      {catalog.designFamilies.length === 0 ? (
        <Alert tone="warning">No active design families. The platform default tokens will be used; add families in Design System.</Alert>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {catalog.designFamilies.map((f) => {
            const active = f.slug === current;
            const t = f.tokens;
            return (
              <button key={f.id} type="button" onClick={() => patch({ designFamilySlug: f.slug })} className={cn("rounded-xl border p-4 text-left transition", active ? "border-neutral-900 shadow" : "border-neutral-200 hover:border-neutral-400")}>
                <div className="mb-3 overflow-hidden rounded-lg border border-neutral-100" style={{ background: t.colors.background, color: t.colors.text }}>
                  <div className="px-3 py-2 text-[11px]" style={{ borderBottom: `1px solid ${t.colors.border}`, fontFamily: `"${t.fonts.heading}", sans-serif` }}>
                    <span className="font-semibold">Aa</span> <span style={{ color: t.colors.muted }}>{t.fonts.heading}</span>
                  </div>
                  <div className="px-3 py-3">
                    <div className="text-sm" style={{ fontFamily: `"${t.fonts.heading}", sans-serif`, fontWeight: t.fonts.headingWeight }}>
                      Headline
                    </div>
                    <div className="text-[10px]" style={{ color: t.colors.muted, fontFamily: `"${t.fonts.body}", sans-serif` }}>
                      Body text set in {t.fonts.body}
                    </div>
                    <span className="mt-2 inline-block px-2 py-1 text-[10px] font-semibold" style={{ background: t.buttonStyle === "outline" || t.buttonStyle === "ghost" ? "transparent" : t.colors.primary, color: t.buttonStyle === "outline" || t.buttonStyle === "ghost" ? t.colors.primary : t.colors.background, border: t.buttonStyle === "outline" ? `2px solid ${t.colors.primary}` : "none", borderRadius: t.buttonStyle === "pill" ? 999 : { none: 0, sm: 4, md: 8, lg: 14, xl: 24 }[t.radius] }}>
                      Button
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{f.name}</div>
                    <div className="text-xs text-neutral-500">{f.description}</div>
                  </div>
                  {active && <Badge tone="green">Selected</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {Object.values(t.colors).map((c, i) => (
                    <span key={i} className="h-4 w-4 rounded-full border border-neutral-200" style={{ background: c }} />
                  ))}
                  <span className="ml-2 text-[11px] text-neutral-500">
                    {t.mode} · {t.radius} corners · {t.spacing}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div className="xl:hidden">
        <LivePreview tokens={tokens} state={state} industryName={industry?.name ?? null} compact />
      </div>
    </div>
  );
}
