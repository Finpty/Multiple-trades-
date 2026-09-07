"use client";

import * as React from "react";
import { Button, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { addTimelineNote, createTimelineTask, sendTimelineEmail } from "@/app/admin/[businessId]/leads/actions";

/** Note / email / task composer attached to a lead or a customer. */
export function TimelineComposer({ businessId, leadId, customerId, defaultEmail, members }: { businessId: string; leadId?: string | null; customerId?: string | null; defaultEmail: string | null; members: Array<{ id: string; name: string }> }) {
  const [tab, setTab] = React.useState<"note" | "email" | "task">("note");
  const hidden = (
    <>
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      {customerId && <input type="hidden" name="customerId" value={customerId} />}
    </>
  );
  return (
    <div>
      <div className="mb-3 flex gap-1">
        {(["note", "email", "task"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 text-sm", tab === t ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>
            {t === "note" ? "Add note" : t === "email" ? "Send email" : "Create task"}
          </button>
        ))}
      </div>
      {tab === "note" && (
        <ActionForm key="note" action={addTimelineNote.bind(null, businessId)} resetOnSuccess successMessage="Note added">
          {({ fieldErrors }) => (
            <div className="space-y-2">
              {hidden}
              <Field label="Note" error={fieldErrors.body}>
                <Textarea name="body" rows={3} placeholder="Called and left a message…" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton size="sm" pendingText="Saving…">
                  Add note
                </SubmitButton>
              </div>
            </div>
          )}
        </ActionForm>
      )}
      {tab === "email" && (
        <ActionForm key="email" action={sendTimelineEmail.bind(null, businessId)} resetOnSuccess successMessage="Email sent">
          {({ fieldErrors }) => (
            <div className="space-y-2">
              {hidden}
              <Field label="To" error={fieldErrors.to}>
                <Input name="to" type="email" defaultValue={defaultEmail ?? ""} />
              </Field>
              <Field label="Subject" error={fieldErrors.subject}>
                <Input name="subject" />
              </Field>
              <Field label="Message" error={fieldErrors.body}>
                <Textarea name="body" rows={5} />
              </Field>
              <div className="flex justify-end">
                <SubmitButton size="sm" pendingText="Sending…">
                  Send email
                </SubmitButton>
              </div>
            </div>
          )}
        </ActionForm>
      )}
      {tab === "task" && (
        <ActionForm key="task" action={createTimelineTask.bind(null, businessId)} resetOnSuccess successMessage="Task created">
          {({ fieldErrors }) => (
            <div className="space-y-2">
              {hidden}
              <Field label="Title" error={fieldErrors.title}>
                <Input name="title" placeholder="Follow up by phone" />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Due" error={fieldErrors.dueAt}>
                  <Input name="dueAt" type="datetime-local" />
                </Field>
                <Field label="Assign to">
                  <Select name="assignedToUserId" defaultValue="">
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Details">
                <Textarea name="description" rows={2} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setTab("note")}>
                  Cancel
                </Button>
                <SubmitButton size="sm" pendingText="Creating…">
                  Create task
                </SubmitButton>
              </div>
            </div>
          )}
        </ActionForm>
      )}
    </div>
  );
}
