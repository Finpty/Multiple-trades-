"use client";

import { Button, cn, formatDateTime } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import type { TimelineEntry } from "@/lib/crm/timeline";
import { toggleTimelineTask } from "@/app/admin/[businessId]/leads/actions";

const KIND_STYLES: Record<TimelineEntry["kind"], { label: string; dot: string }> = {
  note: { label: "Note", dot: "bg-amber-400" },
  email: { label: "Email", dot: "bg-sky-500" },
  sms: { label: "SMS", dot: "bg-violet-500" },
  system: { label: "System", dot: "bg-neutral-400" },
  task: { label: "Task", dot: "bg-emerald-500" },
  audit: { label: "Activity", dot: "bg-neutral-300" },
};

/** Newest-first activity list with inline task completion. */
export function TimelineView({ businessId, entries, canManage }: { businessId: string; entries: Array<Omit<TimelineEntry, "at" | "task"> & { at: string; task?: { id: string; done: boolean; dueAt: string | null } }>; canManage: boolean }) {
  if (entries.length === 0) return <p className="text-sm text-neutral-500">No activity yet. Add a note, send an email or create a task to start the history.</p>;
  return (
    <ol className="relative space-y-4 border-l border-neutral-200 pl-5">
      {entries.map((e) => {
        const s = KIND_STYLES[e.kind];
        return (
          <li key={e.id} className="relative">
            <span className={cn("absolute -left-[1.55rem] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", s.dot)} />
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{s.label}</span>
              <span>{formatDateTime(e.at)}</span>
              {e.by && <span>· {e.by}</span>}
              {e.task?.dueAt && <span>· due {formatDateTime(e.task.dueAt)}</span>}
            </div>
            <div className={cn("text-sm text-neutral-900", e.task?.done && "text-neutral-400 line-through")}>{e.title}</div>
            {e.body && <div className={cn("mt-1 whitespace-pre-wrap text-sm text-neutral-700", e.kind === "audit" && "text-xs text-neutral-500")}>{e.body}</div>}
            {e.task && canManage && (
              <ActionForm action={toggleTimelineTask.bind(null, businessId)} className="mt-1">
                <input type="hidden" name="taskId" value={e.task.id} />
                <input type="hidden" name="completed" value={e.task.done ? "false" : "true"} />
                <Button type="submit" variant="link" size="sm" className="h-auto px-0 text-xs">
                  {e.task.done ? "Reopen task" : "Mark complete"}
                </Button>
              </ActionForm>
            )}
          </li>
        );
      })}
    </ol>
  );
}
