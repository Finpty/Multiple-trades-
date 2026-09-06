"use client";

import * as React from "react";
import { cn } from "@/components/ui";

export interface EditorTab {
  key: string;
  label: string;
  badge?: React.ReactNode;
}

/**
 * Client tab strip for a single-form editor. Inactive panels are hidden (not
 * unmounted) so all their fields still submit with the form. Tabs whose panel
 * contains a field error get a red dot.
 */
export function EditorTabs({ tabs, current, onChange, errorTabs }: { tabs: EditorTab[]; current: string; onChange: (key: string) => void; errorTabs?: Set<string> }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === current}
          onClick={() => onChange(t.key)}
          className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm", t.key === current ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900")}
        >
          {t.label}
          {t.badge}
          {errorTabs?.has(t.key) && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Has errors" />}
        </button>
      ))}
    </nav>
  );
}

export function EditorPanel({ active, children, className }: { active: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div role="tabpanel" hidden={!active} className={cn("space-y-5", className)}>
      {children}
    </div>
  );
}
