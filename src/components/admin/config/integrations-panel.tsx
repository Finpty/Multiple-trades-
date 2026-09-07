"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea, statusTone } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import type { ActionResult } from "@/lib/actions";

type FormAct = (businessId: string, id: string | null, prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
interface Props {
  businessId: string;
  ai: { enabled: boolean; allowKeys: boolean; available: boolean; providers: Array<{ id: string; provider: string; providerLabel: string; name: string; model: string; baseUrl: string | null; keyMasked: string; isEnabled: boolean; monthlyTokenLimit: number | null }>; usage: { requests: number; tokens: number }; adapters: Array<{ id: string; label: string; defaultBaseUrl: string | null; defaultModels: string[]; requiresApiKey: boolean }> };
  webhooks: Array<{ id: string; url: string; events: string[]; isActive: boolean; lastStatus: number | null; lastCalledAt: string | null; hasSecret: boolean }>;
  integrations: Array<{ id: string; provider: string; name: string; config: string; secretKeys: string[]; isEnabled: boolean; status: string }>;
  eventTypes: string[];
  actions: { saveAi: FormAct; deleteAi: (b: string, id: string) => Promise<ActionResult>; testAi: (b: string) => Promise<ActionResult<{ text: string; provider: string; model: string; latencyMs: number }>>; saveWebhook: FormAct; deleteWebhook: (b: string, id: string) => Promise<ActionResult>; testWebhook: (b: string, id: string) => Promise<ActionResult<{ status: number | null }>>; saveIntegration: FormAct; deleteIntegration: (b: string, id: string) => Promise<ActionResult> };
}

export function IntegrationsPanel({ businessId, ai, webhooks, integrations, eventTypes, actions }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [aiEdit, setAiEdit] = React.useState<string | null | "new">(null);
  const [whEdit, setWhEdit] = React.useState<string | null | "new">(null);
  const [intEdit, setIntEdit] = React.useState<string | null | "new">(null);
  const run = (fn: () => Promise<ActionResult<unknown>>) => start(async () => { const r = await fn(); setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error }); router.refresh(); });
  const aiCurrent = ai.providers.find((p) => p.id === aiEdit) ?? null;
  const whCurrent = webhooks.find((w) => w.id === whEdit) ?? null;
  const intCurrent = integrations.find((i) => i.id === intEdit) ?? null;
  return (
    <div className="space-y-8">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="AI provider (bring your own key)" description={ai.allowKeys ? `Optional. This month: ${ai.usage.requests} requests, ${ai.usage.tokens.toLocaleString()} tokens.` : "The platform does not allow business-provided keys; platform AI settings apply."} actions={<><Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => actions.testAi(businessId))}>Test AI</Button>{ai.allowKeys && <Button size="sm" onClick={() => setAiEdit("new")}>Add provider</Button>}</>} />
        <CardBody className="space-y-4">
          {(aiEdit === "new" || aiCurrent) && (
            <ActionForm action={actions.saveAi.bind(null, businessId, aiCurrent?.id ?? null)} className="grid gap-3 rounded-lg border border-neutral-200 p-4 sm:grid-cols-3" successMessage="Saved" onSuccess={() => setAiEdit(null)}>
              {({ fieldErrors }) => (<>
                <Field label="Provider"><Select name="provider" defaultValue={aiCurrent?.provider ?? ai.adapters[0]?.id}>{ai.adapters.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Field>
                <Field label="Name" error={fieldErrors.name}><Input name="name" defaultValue={aiCurrent?.name ?? "My AI"} required /></Field>
                <Field label="Model" error={fieldErrors.model}><Input name="model" list="ai-models" defaultValue={aiCurrent?.model ?? ""} required /><datalist id="ai-models">{ai.adapters.flatMap((a) => a.defaultModels).map((m) => <option key={m} value={m} />)}</datalist></Field>
                <Field label="Base URL" hint="Leave blank for the provider default"><Input name="baseUrl" defaultValue={aiCurrent?.baseUrl ?? ""} /></Field>
                <Field label="API key" hint={aiCurrent?.keyMasked ? `Current: ${aiCurrent.keyMasked} (blank keeps it)` : "Stored encrypted"}><Input name="apiKey" type="password" autoComplete="off" /></Field>
                <Field label="Monthly token limit"><Input name="monthlyTokenLimit" type="number" defaultValue={aiCurrent?.monthlyTokenLimit ?? ""} /></Field>
                <div className="flex items-center gap-4 sm:col-span-3"><Checkbox name="isEnabled" defaultChecked={aiCurrent?.isEnabled ?? true} label="Enabled" /><SubmitButton>Save provider</SubmitButton><Button type="button" variant="ghost" onClick={() => setAiEdit(null)}>Cancel</Button></div>
              </>)}
            </ActionForm>
          )}
          {ai.providers.length === 0 ? <p className="text-sm text-neutral-500">No business-level provider. {ai.enabled ? "Platform AI (if configured) is used." : "AI is off."}</p> : (
            <ul className="divide-y divide-neutral-100">{ai.providers.map((p) => <li key={p.id} className="flex items-center justify-between py-2 text-sm"><span><span className="font-medium">{p.name}</span> · {p.providerLabel} · {p.model} {p.keyMasked && <code className="text-xs text-neutral-500">{p.keyMasked}</code>} {!p.isEnabled && <Badge>disabled</Badge>}</span><span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setAiEdit(p.id)}>Edit</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Remove this provider?")) run(() => actions.deleteAi(businessId, p.id)); }}>Remove</Button></span></li>)}</ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Webhooks" description="Send domain events (leads, quotes, jobs…) to your own systems as signed JSON." actions={<Button size="sm" onClick={() => setWhEdit("new")}>Add webhook</Button>} />
        <CardBody className="space-y-4">
          {(whEdit === "new" || whCurrent) && (
            <ActionForm action={actions.saveWebhook.bind(null, businessId, whCurrent?.id ?? null)} className="space-y-3 rounded-lg border border-neutral-200 p-4" successMessage="Saved" onSuccess={() => setWhEdit(null)}>
              {({ fieldErrors }) => (<>
                <div className="grid gap-3 sm:grid-cols-2"><Field label="URL" error={fieldErrors.url}><Input name="url" defaultValue={whCurrent?.url ?? ""} placeholder="https://" required /></Field><Field label="Signing secret" hint={whCurrent?.hasSecret ? "Set (blank keeps it)" : "Optional; HMAC-SHA256 in x-tradeone-signature"}><Input name="secret" type="password" autoComplete="off" /></Field></div>
                <div><div className="mb-1 text-sm font-medium">Events</div><div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded border p-2 text-xs sm:grid-cols-3"><Checkbox name="events[]" value="*" defaultChecked={!whCurrent || whCurrent.events.includes("*")} label="All events" />{eventTypes.map((e) => <Checkbox key={e} name="events[]" value={e} defaultChecked={whCurrent?.events.includes(e) ?? false} label={e} />)}</div></div>
                <div className="flex items-center gap-4"><Checkbox name="isActive" defaultChecked={whCurrent?.isActive ?? true} label="Active" /><SubmitButton>Save webhook</SubmitButton><Button type="button" variant="ghost" onClick={() => setWhEdit(null)}>Cancel</Button></div>
              </>)}
            </ActionForm>
          )}
          {webhooks.length === 0 ? <p className="text-sm text-neutral-500">No webhooks.</p> : <ul className="divide-y divide-neutral-100">{webhooks.map((w) => <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><span className="font-mono text-xs">{w.url}</span><span className="block text-xs text-neutral-500">{w.events.join(", ")} · {w.lastStatus !== null ? `last HTTP ${w.lastStatus}` : "never called"}{!w.isActive && " · inactive"}</span></span><span className="flex gap-1"><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.testWebhook(businessId, w.id))}>Send test</Button><Button size="sm" variant="ghost" onClick={() => setWhEdit(w.id)}>Edit</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Delete this webhook?")) run(() => actions.deleteWebhook(businessId, w.id)); }}>Delete</Button></span></li>)}</ul>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Integrations" description="Connections to accounting, payments, calendars and other services. Configuration is stored per business; secrets are encrypted." actions={<Button size="sm" onClick={() => setIntEdit("new")}>Add integration</Button>} />
        <CardBody className="space-y-4">
          {(intEdit === "new" || intCurrent) && (
            <ActionForm action={actions.saveIntegration.bind(null, businessId, intCurrent?.id ?? null)} className="space-y-3 rounded-lg border border-neutral-200 p-4" successMessage="Saved" onSuccess={() => setIntEdit(null)}>
              {({ fieldErrors }) => (<>
                <div className="grid gap-3 sm:grid-cols-2"><Field label="Provider key" hint="e.g. stripe, xero, google_calendar" error={fieldErrors.provider}><Input name="provider" defaultValue={intCurrent?.provider ?? ""} required /></Field><Field label="Name" error={fieldErrors.name}><Input name="name" defaultValue={intCurrent?.name ?? ""} required /></Field></div>
                <Field label="Config (JSON)"><Textarea name="config" className="font-mono text-xs" rows={4} defaultValue={intCurrent?.config ?? "{}"} /></Field>
                <SecretsEditor existing={intCurrent?.secretKeys ?? []} />
                <div className="flex items-center gap-4"><Checkbox name="isEnabled" defaultChecked={intCurrent?.isEnabled ?? false} label="Enabled" /><SubmitButton>Save integration</SubmitButton><Button type="button" variant="ghost" onClick={() => setIntEdit(null)}>Cancel</Button></div>
              </>)}
            </ActionForm>
          )}
          {integrations.length === 0 ? <p className="text-sm text-neutral-500">No integrations configured.</p> : <ul className="divide-y divide-neutral-100">{integrations.map((i) => <li key={i.id} className="flex items-center justify-between py-2 text-sm"><span><span className="font-medium">{i.name}</span> <code className="text-xs text-neutral-500">{i.provider}</code> <Badge tone={statusTone(i.isEnabled ? "ACTIVE" : "ARCHIVED")}>{i.status}</Badge>{i.secretKeys.length > 0 && <span className="ml-2 text-xs text-neutral-500">secrets: {i.secretKeys.join(", ")}</span>}</span><span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setIntEdit(i.id)}>Edit</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Remove this integration?")) run(() => actions.deleteIntegration(businessId, i.id)); }}>Remove</Button></span></li>)}</ul>}
        </CardBody>
      </Card>
    </div>
  );
}

function SecretsEditor({ existing }: { existing: string[] }) {
  const [rows, setRows] = React.useState<Array<{ key: string; value: string }>>(existing.map((k) => ({ key: k, value: "" })));
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Secrets <span className="text-xs font-normal text-neutral-500">(write-only; blank keeps the existing value)</span></div>
      {rows.map((r, i) => (
        <div key={i} className="mb-1 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input type="hidden" name="secrets[]:json" value={JSON.stringify(r)} />
          <Input value={r.key} placeholder="api_key" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
          <Input type="password" value={r.value} placeholder={existing.includes(r.key) ? "•••••• (set)" : "value"} autoComplete="off" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => setRows([...rows, { key: "", value: "" }])}>+ Secret</Button>
    </div>
  );
}
