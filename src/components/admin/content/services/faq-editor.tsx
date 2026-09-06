"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { DragHandle, SortableList } from "./sortable-list";

export interface FaqDraft {
  key: string;
  question: string;
  answer: string;
}

export function newFaqKey(): string {
  return `faq-${Math.random().toString(36).slice(2, 10)}`;
}

/** Repeatable, reorderable question/answer rows. Submits `<name>:json`. */
export function FaqEditor({ name, items, onChange }: { name: string; items: FaqDraft[]; onChange: (items: FaqDraft[]) => void }) {
  const update = (key: string, patch: Partial<FaqDraft>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  return (
    <div className="space-y-3">
      <input type="hidden" name={`${name}:json`} value={JSON.stringify(items.filter((i) => i.question.trim() || i.answer.trim()).map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() })))} />
      {items.length === 0 && <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">No FAQs yet. Answer the questions customers ask most — they appear on the service page and in search results.</p>}
      <SortableList
        items={items}
        getId={(i) => i.key}
        onReorder={onChange}
        className="space-y-3"
        renderItem={(item, index, handle) => (
          <div className="flex gap-2 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <DragHandle {...handle} />
              <span className="text-[11px] text-neutral-400">{index + 1}</span>
            </div>
            <div className="flex-1 space-y-2">
              <Input value={item.question} onChange={(e) => update(item.key, { question: e.target.value })} placeholder="Question" aria-label={`Question ${index + 1}`} />
              <Textarea value={item.answer} onChange={(e) => update(item.key, { answer: e.target.value })} placeholder="Answer" rows={3} className="min-h-[72px]" aria-label={`Answer ${index + 1}`} />
            </div>
            <button type="button" aria-label="Remove FAQ" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600" onClick={() => onChange(items.filter((i) => i.key !== item.key))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, { key: newFaqKey(), question: "", answer: "" }])}>
        <Plus className="h-4 w-4" /> Add FAQ
      </Button>
    </div>
  );
}
