"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Alert, Button, Field, Textarea, cn } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import type { KanbanColumn } from "./kanban-board";

/** Horizontal stage stepper; clicking a stage asks for an optional note then moves the job. */
export function StageStepper({ stages, current, jobId, disabled, onMove }: {
  stages: KanbanColumn[];
  current: string;
  jobId: string;
  disabled?: boolean;
  onMove: (jobId: string, toStage: string, note?: string) => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<KanbanColumn | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const currentIndex = stages.findIndex((s) => s.key === current);

  function confirm() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const r = await onMove(jobId, target.key, note.trim() || undefined);
      if (!r.ok) setError(r.error);
      else {
        setTarget(null);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <ol className="flex flex-wrap gap-1">
        {stages.map((s, i) => {
          const done = i < currentIndex;
          const active = s.key === current;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={disabled || active || pending}
                onClick={() => setTarget(s)}
                title={s.description || s.name}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-default",
                  active ? "border-transparent text-white" : done ? "border-neutral-200 bg-neutral-100 text-neutral-600 hover:bg-neutral-200" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                )}
                style={active ? { backgroundColor: s.color } : undefined}
              >
                {done ? <Check className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />}
                {s.name}
              </button>
            </li>
          );
        })}
      </ol>
      {target && (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm text-neutral-800">Move to <strong>{target.name}</strong>{target.isTerminal ? " and mark the job complete" : ""}?</p>
          <Field label="Note (optional)" className="mt-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this moving?" />
          </Field>
          {error && <Alert tone="danger" className="mt-2">{error}</Alert>}
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={confirm} disabled={pending}>{pending ? "Moving…" : "Move"}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => { setTarget(null); setError(null); }} disabled={pending}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
