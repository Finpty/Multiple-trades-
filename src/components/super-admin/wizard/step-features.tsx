"use client";

import { Alert, cn } from "@/components/ui";
import type { StepProps } from "./wizard";

export function StepFeatures({ state, patch, catalog }: StepProps) {
  const enabled = new Set(state.features);
  const toggle = (key: string, on: boolean) => patch({ features: on ? [...state.features, key] : state.features.filter((k) => k !== key), featuresTouched: true });
  const groups = [...new Set(catalog.features.map((f) => f.category))];
  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-600">Modules switched on for this business. Nothing is deployed — features are toggles the business can change any time.</p>
      {!catalog.aiEnabled && catalog.features.some((f) => f.requiresAi) && <Alert tone="info">AI is currently disabled platform-wide. AI-assisted features can still be enabled; they show manual workflows until an AI provider is configured.</Alert>}
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{g}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.features.filter((f) => f.category === g).map((f) => {
              const on = enabled.has(f.key);
              return (
                <label key={f.key} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", on ? "border-neutral-900 bg-neutral-50" : "border-neutral-200", f.isPlatformOnly && "cursor-not-allowed opacity-60")}>
                  <input type="checkbox" className="mt-0.5" checked={on} disabled={f.isPlatformOnly} onChange={(e) => toggle(f.key, e.target.checked)} />
                  <span>
                    <span className="font-medium">{f.name}</span>
                    {f.requiresAi && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-800">AI optional</span>}
                    {f.isPlatformOnly && <span className="ml-1 rounded bg-neutral-200 px-1 text-[10px]">platform</span>}
                    {f.description && <span className="block text-xs text-neutral-500">{f.description}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
