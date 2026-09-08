"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConditionsEditor } from "@/components/admin/conditions-editor";
import type { ConditionGroup } from "@/lib/rules/conditions";
import type { ActionResult } from "@/lib/actions";
import { EVENT_GROUP_ORDER, eventCatalog, eventFieldOptions, eventPlaceholders } from "@/lib/automation/catalog";
import type { AutomationAction } from "@/lib/automation/actions";

export interface AutomationEditorValues { ruleId: string | null; name: string; description: string; triggerEvent: string; conditions: ConditionGroup; actions: AutomationAction[]; isActive: boolean }

const catalog = eventCatalog();
const uid = () => Math.random().toString(36).slice(2, 9);

function defaultAction(type: AutomationAction["type"]): AutomationAction {
  switch (type) {
    case "create_task": return { type, title: "Follow up {{name}}", dueInDays: 1 };
    case "notify_user": return { type, title: "New activity", useAssignedUser: true };
    case "send_email": return { type, to: "{{email}}", subject: "", body: "" };
    case "update_lead_status": return { type, status: "CONTACTED" };
    case "request_review": return { type, delayDays: 2 };
    case "log_message": return { type, body: "" };
    case "assign_lead": return { type, userId: "" };
    case "send_sms": return { type, to: "{{phone}}", body: "" };
    default: return { type: "create_project_from_quote" };
  }
}

/**
 * WHEN <event> IF <conditions> THEN <actions>. Actions serialise as `actions:json`,
 * conditions as `conditions:json` (via ConditionsEditor's hidden input).
 */
export function AutomationEditor({ businessId, values, actionTypes, members, leadStatuses, cancelHref, save }: {
  businessId: string;
  values: AutomationEditorValues;
  actionTypes: Array<{ type: AutomationAction["type"]; label: string; description: string }>;
  members: Array<{ id: string; name: string }>;
  leadStatuses: Array<{ value: string; label: string }>;
  cancelHref: string;
  save: (prev: ActionResult<{ id: string }> | undefined, fd: FormData) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [trigger, setTrigger] = React.useState(values.triggerEvent);
  const [actions, setActions] = React.useState<Array<AutomationAction & { _k: string }>>(values.actions.map((a) => ({ ...a, _k: uid() })));
  const [adding, setAdding] = React.useState<AutomationAction["type"]>("create_task");
  const fieldOptions = React.useMemo(() => eventFieldOptions(trigger), [trigger]);
  const placeholders = React.useMemo(() => eventPlaceholders(trigger), [trigger]);
  const update = (k: string, patch: Partial<AutomationAction>) => setActions((l) => l.map((a) => (a._k === k ? ({ ...a, ...patch } as AutomationAction & { _k: string }) : a)));
  const onSuccess = React.useCallback((d: { id: string }) => { if (!values.ruleId) router.push(`/admin/${businessId}/automations/${d.id}`); }, [router, businessId, values.ruleId]);
  const current = catalog.find((c) => c.type === trigger);

  return (
    <ActionForm action={save} onSuccess={onSuccess}>
      {({ fieldErrors }) => (
        <div className="space-y-4">
          <input type="hidden" name="businessId" value={businessId} />
          {values.ruleId && <input type="hidden" name="ruleId" value={values.ruleId} />}
          <input type="hidden" name="actions:json" value={JSON.stringify(actions.map(({ _k, ...a }) => { void _k; return a; }))} />
          <Card><CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Name" required error={fieldErrors.name}><Input name="name" defaultValue={values.name} placeholder="Follow up new enquiries" /></Field>
            <Field label="Description" error={fieldErrors.description}><Input name="description" defaultValue={values.description} placeholder="What this automation does, for your team" /></Field>
            <div className="md:col-span-2"><Checkbox name="isActive" defaultChecked={values.isActive} label="Active — runs automatically when the trigger happens" /></div>
          </CardBody></Card>

          <Card><CardHeader title="WHEN" description="The event that starts this automation." /><CardBody>
            <Field label="Trigger" error={fieldErrors.triggerEvent}>
              <Select name="triggerEvent" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {EVENT_GROUP_ORDER.map((g) => { const items = catalog.filter((c) => c.group === g); return items.length ? <optgroup key={g} label={g}>{items.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}</optgroup> : null; })}
              </Select>
            </Field>
            {current && <p className="mt-1 text-xs text-neutral-500">{current.description}{placeholders.length ? ` Available placeholders: ${placeholders.join(", ")}` : ""}</p>}
          </CardBody></Card>

          <Card><CardHeader title="IF" description="Optional conditions on the event data. Leave empty to run every time." /><CardBody>
            <ConditionsEditor key={trigger} name="conditions:json" value={values.conditions} fieldOptions={fieldOptions} />
          </CardBody></Card>

          <Card><CardHeader title="THEN" description="Actions run in order. Use {{placeholders}} from the event in any text." /><CardBody className="space-y-3">
            {fieldErrors.actions && <Alert tone="danger">{fieldErrors.actions}</Alert>}
            {actions.length === 0 && <p className="text-sm text-neutral-500">No actions yet. Add one below.</p>}
            {actions.map((a, i) => {
              const meta = actionTypes.find((t) => t.type === a.type);
              const err = (k: string) => fieldErrors[`actions.${i}.${k}`];
              return (
                <div key={a._k} className={cn("rounded-md border p-3", err("type") && "border-red-300")}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div><span className="text-xs text-neutral-400">{i + 1}.</span> <span className="font-medium">{meta?.label ?? a.type}</span><span className="ml-2 text-xs text-neutral-500">{meta?.description}</span></div>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => setActions((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>↑</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={i === actions.length - 1} onClick={() => setActions((l) => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}>↓</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setActions((l) => l.filter((x) => x._k !== a._k))}>✕</Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {a.type === "create_task" && (<>
                      <Field label="Task title" required error={err("title")}><Input value={a.title} onChange={(e) => update(a._k, { title: e.target.value })} /></Field>
                      <Field label="Due in (days)"><Input type="number" min={0} value={a.dueInDays ?? ""} onChange={(e) => update(a._k, { dueInDays: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
                      <Field label="Assign to"><Select value={a.assignToUserId ?? ""} onChange={(e) => update(a._k, { assignToUserId: e.target.value || null })}><option value="">Whoever the record is assigned to</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
                      <Field label="Details" className="md:col-span-2"><Textarea rows={2} value={a.description ?? ""} onChange={(e) => update(a._k, { description: e.target.value })} /></Field>
                    </>)}
                    {a.type === "notify_user" && (<>
                      <Field label="Title" required error={err("title")}><Input value={a.title} onChange={(e) => update(a._k, { title: e.target.value })} /></Field>
                      <Field label="Send to"><Select value={a.useAssignedUser ? "__assigned" : (a.userId ?? "")} onChange={(e) => update(a._k, e.target.value === "__assigned" ? { useAssignedUser: true, userId: null } : { useAssignedUser: false, userId: e.target.value || null })}><option value="__assigned">Assigned team member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
                      <Field label="Message" className="md:col-span-2"><Textarea rows={2} value={a.body ?? ""} onChange={(e) => update(a._k, { body: e.target.value })} /></Field>
                    </>)}
                    {a.type === "send_email" && (<>
                      <Field label="To" required hint="An address or a placeholder like {{email}}" error={err("to")}><Input value={a.to} onChange={(e) => update(a._k, { to: e.target.value })} /></Field>
                      <Field label="Subject" required error={err("subject")}><Input value={a.subject} onChange={(e) => update(a._k, { subject: e.target.value })} /></Field>
                      <Field label="Body" required className="md:col-span-2" error={err("body")}><Textarea rows={5} value={a.body} onChange={(e) => update(a._k, { body: e.target.value })} /></Field>
                    </>)}
                    {a.type === "update_lead_status" && <Field label="New status"><Select value={a.status} onChange={(e) => update(a._k, { status: e.target.value })}>{leadStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>}
                    {a.type === "request_review" && <Field label="Delay (days)" hint="Wait before emailing the customer"><Input type="number" min={0} value={a.delayDays ?? ""} onChange={(e) => update(a._k, { delayDays: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>}
                    {a.type === "log_message" && <Field label="Note" required className="md:col-span-2" error={err("body")}><Textarea rows={2} value={a.body} onChange={(e) => update(a._k, { body: e.target.value })} /></Field>}
                    {a.type === "assign_lead" && <Field label="Assign to" required error={err("userId")}><Select value={a.userId} onChange={(e) => update(a._k, { userId: e.target.value })}><option value="">Choose…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>}
                    {a.type === "send_sms" && (<>
                      <Field label="To" required error={err("to")}><Input value={a.to} onChange={(e) => update(a._k, { to: e.target.value })} /></Field>
                      <Field label="Message" required className="md:col-span-2" error={err("body")}><Textarea rows={2} value={a.body} onChange={(e) => update(a._k, { body: e.target.value })} /></Field>
                    </>)}
                    {a.type === "create_project_from_quote" && <p className="text-sm text-neutral-500 md:col-span-2">Opens a job (and project shell) for the accepted quote. Only meaningful on “Quote accepted”.</p>}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Select value={adding} onChange={(e) => setAdding(e.target.value as AutomationAction["type"])} className="w-auto" aria-label="Action type">{actionTypes.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</Select>
              <Button type="button" size="sm" variant="secondary" onClick={() => setActions((l) => [...l, { ...defaultAction(adding), _k: uid() }])}>+ Add action</Button>
              <span className="text-xs text-neutral-500">{actionTypes.find((t) => t.type === adding)?.description}</span>
            </div>
          </CardBody></Card>
          <div className="flex gap-2"><SubmitButton>{values.ruleId ? "Save automation" : "Create automation"}</SubmitButton><ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink></div>
        </div>
      )}
    </ActionForm>
  );
}
