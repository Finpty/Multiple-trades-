"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import type { ActionResult } from "@/lib/actions";

interface Row { id: string; fromPath: string; toPath: string; statusCode: number; isActive: boolean }

export function RedirectsManager({ businessId, redirects, save, state }: { businessId: string; redirects: Row[]; save: (b: string, id: string | null, prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>; state: (b: string, id: string, a: "enable" | "disable" | "delete") => Promise<ActionResult> }) {
  const [editing, setEditing] = React.useState<string | null | "new">(null);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const current = redirects.find((r) => r.id === editing) ?? null;
  return (
    <Card>
      <CardHeader title="Redirects" description="Send old URLs to new ones (e.g. after renaming a page or migrating from a previous website)." actions={<Button size="sm" onClick={() => setEditing("new")}>Add redirect</Button>} />
      <CardBody className="space-y-3">
        {(editing === "new" || current) && (
          <ActionForm action={save.bind(null, businessId, current?.id ?? null)} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_120px_auto_auto] items-end" successMessage="Saved" onSuccess={() => setEditing(null)}>
            {({ fieldErrors }) => (<>
              <Field label="From path" error={fieldErrors.fromPath}><Input name="fromPath" defaultValue={current?.fromPath ?? "/"} placeholder="/old-page" required /></Field>
              <Field label="To" error={fieldErrors.toPath}><Input name="toPath" defaultValue={current?.toPath ?? "/"} placeholder="/new-page or https://" required /></Field>
              <Field label="Type"><Select name="statusCode" defaultValue={String(current?.statusCode ?? 301)}><option value="301">301 permanent</option><option value="302">302 temporary</option></Select></Field>
              <Checkbox name="isActive" defaultChecked={current?.isActive ?? true} label="Active" />
              <div className="flex gap-2"><SubmitButton>Save</SubmitButton><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
            </>)}
          </ActionForm>
        )}
        {redirects.length === 0 ? <p className="text-sm text-neutral-500">No redirects.</p> : (
          <ul className="divide-y divide-neutral-100">{redirects.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="font-mono text-xs">{r.fromPath} → {r.toPath} <Badge className="ml-1">{r.statusCode}</Badge>{!r.isActive && <Badge className="ml-1">inactive</Badge>}</span><span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>Edit</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await state(businessId, r.id, r.isActive ? "disable" : "enable"); router.refresh(); })}>{r.isActive ? "Disable" : "Enable"}</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Delete this redirect?")) start(async () => { await state(businessId, r.id, "delete"); router.refresh(); }); }}>Delete</Button></span></li>)}</ul>
        )}
      </CardBody>
    </Card>
  );
}
