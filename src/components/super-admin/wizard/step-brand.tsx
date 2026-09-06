"use client";

import * as React from "react";
import { Alert, Button, Field, Input, Select, cn } from "@/components/ui";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { COLOR_KEYS, FONT_WEIGHTS, GOOGLE_FONTS, THEME_ENUMS } from "./options";
import { LivePreview } from "./preview";
import type { StepProps } from "./wizard";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isCustom = !GOOGLE_FONTS.includes(value);
  const [custom, setCustom] = React.useState(isCustom);
  return (
    <div className="space-y-1.5">
      <Select value={custom ? "__custom" : value} onChange={(e) => (e.target.value === "__custom" ? setCustom(true) : (setCustom(false), onChange(e.target.value)))}>
        {GOOGLE_FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
        <option value="__custom">Custom Google font…</option>
      </Select>
      {custom && <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Exact Google Fonts family name" />}
    </div>
  );
}

export function StepBrand({ state, patch, tokens, catalog }: StepProps) {
  const set = (p: Partial<ThemeTokens>) => patch((prev) => ({ brandOverrides: { ...prev.brandOverrides, ...p } }));
  const setColor = (key: keyof ThemeTokens["colors"], value: string) => patch((prev) => ({ brandOverrides: { ...prev.brandOverrides, colors: { ...(prev.brandOverrides.colors ?? tokens.colors), [key]: value } } }));
  const setFont = (p: Partial<ThemeTokens["fonts"]>) => patch((prev) => ({ brandOverrides: { ...prev.brandOverrides, fonts: { ...(prev.brandOverrides.fonts ?? tokens.fonts), ...p } } }));
  const family = catalog.designFamilies.find((f) => f.slug === state.designFamilySlug) ?? catalog.designFamilies[0];
  const hasOverrides = Object.keys(state.brandOverrides).length > 0;
  const industry = catalog.industries.find((i) => i.id === state.industryId);
  const enumLabel = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">
          Base preset: <strong>{family?.name ?? "Default"}</strong> (change it in the next step). Your edits here stay on top of whichever family you pick.
        </p>
        {hasOverrides && (
          <Button type="button" variant="ghost" size="sm" onClick={() => patch({ brandOverrides: {} })}>
            Reset to preset
          </Button>
        )}
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Colours</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLOR_KEYS.map((c) => {
            const value = tokens.colors[c.key];
            return (
              <div key={c.key} className="rounded-lg border border-neutral-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input type="color" value={HEX.test(value) && value.length === 7 ? value : "#000000"} onChange={(e) => setColor(c.key, e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-neutral-300 bg-white p-0.5" aria-label={`${c.label} colour`} />
                  <div>
                    <div className="text-xs font-medium">{c.label}</div>
                    <div className="text-[10px] text-neutral-500">{c.hint}</div>
                  </div>
                </div>
                <Input value={value} onChange={(e) => setColor(c.key, e.target.value)} className={cn("font-mono text-xs", !HEX.test(value) && "border-red-400")} />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Typography</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heading font">
            <FontSelect value={tokens.fonts.heading} onChange={(v) => setFont({ heading: v })} />
          </Field>
          <Field label="Body font">
            <FontSelect value={tokens.fonts.body} onChange={(v) => setFont({ body: v })} />
          </Field>
          <Field label="Heading weight">
            <Select value={tokens.fonts.headingWeight} onChange={(e) => setFont({ headingWeight: Number(e.target.value) })}>
              {FONT_WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Body weight">
            <Select value={tokens.fonts.bodyWeight} onChange={(e) => setFont({ bodyWeight: Number(e.target.value) })}>
              {FONT_WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Shape &amp; motion</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["radius", "Corner radius"],
              ["buttonStyle", "Button style"],
              ["borderStyle", "Border style"],
              ["imageStyle", "Image style"],
              ["animation", "Animation"],
              ["mode", "Light / dark"],
              ["spacing", "Spacing"],
              ["tone", "Brand tone"],
            ] as Array<[keyof typeof THEME_ENUMS, string]>
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Select value={tokens[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<ThemeTokens>)}>
                {THEME_ENUMS[key].map((v) => (
                  <option key={v} value={v}>
                    {enumLabel(v)}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Logos &amp; icons</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {["Logo", "Secondary logo", "Icon", "Favicon"].map((l) => (
            <div key={l} className="flex h-20 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-center text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{l}</span>
              <span>after creation</span>
            </div>
          ))}
        </div>
        <Alert tone="info" className="mt-3">
          Media belongs to a business, so uploads happen right after creation. The setup checklist that opens next has a one-click logo upload, and the Brand &amp; Theme page handles the rest.
        </Alert>
      </section>

      <div className="xl:hidden">
        <LivePreview tokens={tokens} state={state} industryName={industry?.name ?? null} compact />
      </div>
    </div>
  );
}
