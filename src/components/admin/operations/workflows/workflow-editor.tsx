"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Alert, Badge, Button, ButtonLink, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Switch, Textarea, cn } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export interface EditorStage {
  uid: string;
  key: string;
  name: string;
  color: string;
  description: string;
  isTerminal: boolean;
  keyTouched: boolean;
}

export interface WorkflowEditorValues {
  id?: string;
  name: string;
  key: string;
  description: string;
  isDefault: boolean;
  serviceId: string | null;
  stages: Array<{ key: string; name: string; color?: string; description?: string; isTerminal?: boolean }>;
}

const PALETTE = ["#64748b", "#0ea5e9", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#f97316", "#a855f7", "#10b981"];

function slugKey(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

let uidCounter = 0;
const uid = () => `s${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export function WorkflowEditor({ businessId, action, values, services, jobCounts, cancelHref, isOnlyWorkflow }: {
  businessId: string;
  action: (prev: ActionResult<{ id: string }> | undefined, fd: FormData) => Promise<ActionResult<{ id: string }>>;
  values: WorkflowEditorValues;
  services: Array<{ id: string; name: string }>;
  jobCounts: Record<string, number>;
  cancelHref: string;
  isOnlyWorkflow: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(values.name);
  const [key, setKey] = React.useState(values.key);
  const [keyTouched, setKeyTouched] = React.useState(!!values.id);
  const [stages, setStages] = React.useState<EditorStage[]>(() =>
    values.stages.map((s, i) => ({ uid: uid(), key: s.key, name: s.name, color: s.color ?? PALETTE[i % PALETTE.length]!, description: s.description ?? "", isTerminal: !!s.isTerminal, keyTouched: true })),
  );
  const [moves, setMoves] = React.useState<Record<string, string>>({});
  const originalKeys = React.useMemo(() => values.stages.map((s) => s.key), [values.stages]);
  const currentKeys = stages.map((s) => s.key);
  const removedWithJobs = originalKeys.filter((k) => !currentKeys.includes(k) && (jobCounts[k] ?? 0) > 0);
  const duplicateKeys = currentKeys.filter((k, i) => k && currentKeys.indexOf(k) !== i);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function update(i: number, patch: Partial<EditorStage>) {
    setStages((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStage() {
    setStages((list) => [...list, { uid: uid(), key: "", name: "", color: PALETTE[list.length % PALETTE.length]!, description: "", isTerminal: false, keyTouched: false }]);
  }
  function removeStage(i: number) {
    setStages((list) => list.filter((_, idx) => idx !== i));
  }
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setStages((list) => arrayMove(list, list.findIndex((s) => s.uid === e.active.id), list.findIndex((s) => s.uid === e.over!.id)));
  }

  const payload = stages.map((s) => ({ key: s.key, name: s.name, color: s.color, description: s.description || undefined, isTerminal: s.isTerminal }));

  return (
    <ActionForm action={action} onSuccess={(d) => router.push(`/admin/${businessId}/workflows/${d.id}`)} refreshOnSuccess={false}>
      {({ fieldErrors }) => (
        <div className="grid gap-6 lg:grid-cols-3">
          <input type="hidden" name="businessId" value={businessId} />
          {values.id && <input type="hidden" name="workflowId" value={values.id} />}
          <input type="hidden" name="stages:json" value={JSON.stringify(payload)} />
          <input type="hidden" name="stageMoves:json" value={JSON.stringify(moves)} />
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Workflow" />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" required error={fieldErrors.name}>
                    <Input name="name" value={name} required onChange={(e) => { setName(e.target.value); if (!keyTouched) setKey(slugKey(e.target.value)); }} />
                  </Field>
                  <Field label="Key" required hint="Used in exports and automations" error={fieldErrors.key}>
                    <Input name="key" value={key} required onChange={(e) => { setKeyTouched(true); setKey(slugKey(e.target.value)); }} />
                  </Field>
                </div>
                <Field label="Description" error={fieldErrors.description}>
                  <Textarea name="description" rows={2} defaultValue={values.description} />
                </Field>
                <Field label="Service" hint="Optional: suggest this workflow for jobs of one service" error={fieldErrors.serviceId}>
                  <Select name="serviceId" defaultValue={values.serviceId ?? ""}>
                    <option value="">Any service</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </Field>
                <Switch name="isDefault" checked={values.isDefault || isOnlyWorkflow} label="Default workflow" description="New jobs use this workflow unless another is chosen. Only one workflow can be the default." disabled={isOnlyWorkflow} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Stages" description="Drag to reorder. The first stage is where new jobs start; a final stage completes the job." actions={<Button type="button" variant="secondary" size="sm" onClick={addStage}><Plus className="mr-1 h-4 w-4" />Add stage</Button>} />
              <CardBody className="space-y-2">
                {fieldErrors.stages && <Alert tone="danger">{fieldErrors.stages}</Alert>}
                {duplicateKeys.length > 0 && <Alert tone="warning">Duplicate stage keys: {[...new Set(duplicateKeys)].join(", ")}. Each key must be unique.</Alert>}
                {stages.length === 0 && <p className="text-sm text-neutral-500">No stages yet — add the first one.</p>}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={stages.map((s) => s.uid)} strategy={verticalListSortingStrategy}>
                    {stages.map((s, i) => (
                      <StageRow key={s.uid} stage={s} index={i} jobs={jobCounts[s.key] ?? 0} duplicate={duplicateKeys.includes(s.key)} errors={fieldErrors} onChange={(p) => update(i, p)} onRemove={() => removeStage(i)} />
                    ))}
                  </SortableContext>
                </DndContext>
                {removedWithJobs.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="mb-2 text-sm font-medium text-amber-900">Some removed stages still contain jobs. Choose where those jobs should go:</p>
                    {removedWithJobs.map((k) => (
                      <div key={k} className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="min-w-40"><code>{k}</code> ({jobCounts[k]} job{jobCounts[k] === 1 ? "" : "s"}) →</span>
                        <Select className="w-auto" value={moves[k] ?? ""} onChange={(e) => setMoves((m) => ({ ...m, [k]: e.target.value }))} required>
                          <option value="">Choose a stage…</option>
                          {stages.filter((s) => s.key).map((s) => <option key={s.uid} value={s.key}>{s.name || s.key}</option>)}
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Board preview" />
              <CardBody>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {stages.map((s) => (
                    <div key={s.uid} className="w-36 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50">
                      <div className="flex items-center gap-1.5 border-b border-neutral-200 px-2 py-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="truncate text-xs font-medium">{s.name || "Untitled"}</span>
                        {s.isTerminal && <Badge tone="green">Final</Badge>}
                      </div>
                      <div className="space-y-1 p-2">
                        <div className="h-8 rounded border border-dashed border-neutral-200 bg-white" />
                        <div className="h-8 rounded border border-dashed border-neutral-200 bg-white" />
                      </div>
                    </div>
                  ))}
                  {stages.length === 0 && <p className="text-xs text-neutral-500">Add stages to see the board.</p>}
                </div>
              </CardBody>
            </Card>
            <div className="flex flex-wrap gap-2">
              <SubmitButton disabled={duplicateKeys.length > 0}>{values.id ? "Save workflow" : "Create workflow"}</SubmitButton>
              <ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink>
            </div>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

function StageRow({ stage, index, jobs, duplicate, errors, onChange, onRemove }: { stage: EditorStage; index: number; jobs: number; duplicate: boolean; errors: Record<string, string>; onChange: (p: Partial<EditorStage>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: stage.uid });
  const err = errors[`stages.${index}.key`] ?? errors[`stages.${index}.name`];
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("rounded-lg border bg-white p-3", isDragging ? "border-neutral-900 shadow-lg" : "border-neutral-200", duplicate && "border-red-400")}>
      <div className="flex items-start gap-2">
        <button ref={setActivatorNodeRef} type="button" aria-label="Drag stage" className="mt-2 cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
        <div className="grid flex-1 gap-2 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <Input value={stage.name} placeholder="Stage name" aria-label="Stage name" onChange={(e) => onChange({ name: e.target.value, ...(stage.keyTouched ? {} : { key: slugKey(e.target.value) }) })} />
          </div>
          <div className="sm:col-span-3">
            <Input value={stage.key} placeholder="key" aria-label="Stage key" className="font-mono text-xs" onChange={(e) => onChange({ key: slugKey(e.target.value), keyTouched: true })} />
          </div>
          <div className="flex items-center gap-1 sm:col-span-2">
            <input type="color" value={stage.color} aria-label="Colour" className="h-9 w-10 cursor-pointer rounded border border-neutral-300 bg-white p-0.5" onChange={(e) => onChange({ color: e.target.value })} />
            <div className="flex flex-wrap gap-0.5">{PALETTE.slice(0, 5).map((c) => <button key={c} type="button" aria-label={c} className="h-3.5 w-3.5 rounded-full ring-1 ring-neutral-200" style={{ backgroundColor: c }} onClick={() => onChange({ color: c })} />)}</div>
          </div>
          <div className="flex items-center sm:col-span-2">
            <Checkbox label="Final" checked={stage.isTerminal} onChange={(e) => onChange({ isTerminal: e.target.checked })} />
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-1">
            {jobs > 0 && <Badge tone="blue">{jobs}</Badge>}
            <button type="button" aria-label="Remove stage" className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" onClick={onRemove}><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="sm:col-span-12">
            <Input value={stage.description} placeholder="What happens in this stage (optional)" aria-label="Description" onChange={(e) => onChange({ description: e.target.value })} />
          </div>
          {err && <p className="text-xs text-red-600 sm:col-span-12">{err}</p>}
        </div>
      </div>
    </div>
  );
}
