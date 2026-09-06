"use client";

import * as React from "react";
import { Alert, Badge, Button, cn } from "@/components/ui";
import { BLOCK_META, type BlockType } from "@/lib/blocks/schema";
import type { EditorOptions } from "@/lib/website/options";
import type { SectionView } from "@/lib/website/section-types";
import { SectionPropsForm, SectionSettingsForm } from "@/components/editor/schema-form/section-props-form";

export interface SectionPanelProps {
  businessId: string;
  section: SectionView;
  draft: { props: Record<string, unknown>; settings: Record<string, unknown> };
  dirty: boolean;
  errors: Record<string, string>;
  saving: boolean;
  options: EditorOptions;
  onChange: (next: { props: Record<string, unknown>; settings: Record<string, unknown> }) => void;
  onSave: () => void;
  onDiscard: () => void;
}

/** Right-hand pane: content (props) form + section layout settings for the selected section. */
export function SectionPanel({ businessId, section, draft, dirty, errors, saving, options, onChange, onSave, onDiscard }: SectionPanelProps) {
  const [tab, setTab] = React.useState<"content" | "settings">("content");
  const meta = BLOCK_META[section.type as BlockType];
  const settingsErrorCount = Object.keys(errors).filter((k) => k.startsWith("settings.")).length;
  const contentErrorCount = Object.keys(errors).length - settingsErrorCount;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">{meta?.label ?? section.type}</h3>
            {section.isHidden && <Badge tone="neutral">Hidden</Badge>}
            {dirty && <Badge tone="amber">Unsaved changes</Badge>}
          </div>
          {meta && <p className="text-xs text-neutral-500">{meta.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>Discard</Button>}
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !dirty}>{saving ? "Saving…" : "Save section"}</Button>
        </div>
      </div>
      <div className="flex gap-1 border-b border-neutral-200 px-4">
        {(["content", "settings"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("border-b-2 px-3 py-2 text-sm", tab === t ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900")}>
            {t === "content" ? "Content" : "Section settings"}
            {t === "content" && contentErrorCount > 0 && <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] text-red-700">{contentErrorCount}</span>}
            {t === "settings" && settingsErrorCount > 0 && <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] text-red-700">{settingsErrorCount}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {errors._ && <Alert tone="danger" className="mb-4">{errors._}</Alert>}
        {tab === "content" ? (
          <SectionPropsForm type={section.type} value={draft.props} onChange={(props) => onChange({ ...draft, props })} businessId={businessId} options={options} errors={errors} disabled={saving} />
        ) : (
          <SectionSettingsForm value={draft.settings} onChange={(settings) => onChange({ ...draft, settings })} businessId={businessId} errors={errors} disabled={saving} />
        )}
      </div>
    </div>
  );
}
