"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, statusTone } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import type { ActionResult } from "@/lib/actions";
import type { DnsInstruction } from "@/lib/domains/service";

export interface DomainRow { id: string; hostname: string; kind: string; isPrimary: boolean; verificationStatus: string; verificationError: string | null; verifiedAt: string | null; lastCheckedAt: string | null; sslStatus: string; sslProvider: string | null; redirectToDomainId: string | null; redirectType: number; instructions: DnsInstruction[] }

export function DomainsManager({ businessId, domains, provider, add, verify, setPrimary, setRedirect, remove }: {
  businessId: string; domains: DomainRow[]; provider: string;
  add: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  verify: (b: string, id: string) => Promise<ActionResult<{ verified: boolean; error: string | null }>>;
  setPrimary: (b: string, id: string) => Promise<ActionResult>;
  setRedirect: (b: string, id: string, to: string, type: number) => Promise<ActionResult>;
  remove: (b: string, id: string) => Promise<ActionResult>;
}) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult<unknown>>) => start(async () => { const r = await fn(); setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error }); router.refresh(); });
  const copy = (v: string) => navigator.clipboard?.writeText(v).catch(() => undefined);
  return (
    <div className="space-y-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="Add a custom domain" description="Enter the domain you own (e.g. example.com.au). We'll show the DNS records to add at your registrar." />
        <CardBody>
          <ActionForm action={add} className="flex flex-wrap items-end gap-3" successMessage="Domain added" resetOnSuccess>
            {({ fieldErrors }) => (<><Field label="Domain" error={fieldErrors.hostname} className="min-w-72"><Input name="hostname" placeholder="example.com.au" required /></Field><SubmitButton>Add domain</SubmitButton></>)}
          </ActionForm>
        </CardBody>
      </Card>
      {domains.length === 0 ? <EmptyState title="No custom domains" description="Your site is available at the platform address. Add a domain to use your own." /> : domains.map((d) => (
        <Card key={d.id}>
          <CardHeader title={<span className="flex items-center gap-2">{d.hostname}{d.isPrimary && <Badge tone="green">Primary</Badge>}<Badge tone={statusTone(d.verificationStatus)}>{d.verificationStatus}</Badge><Badge tone={statusTone(d.sslStatus)}>SSL {d.sslStatus.toLowerCase()}</Badge></span>} description={d.verifiedAt ? `Verified ${new Date(d.verifiedAt).toLocaleString()}` : d.lastCheckedAt ? `Last checked ${new Date(d.lastCheckedAt).toLocaleString()}` : "Not checked yet"} actions={<>
            {d.verificationStatus !== "VERIFIED" && <Button size="sm" disabled={pending} onClick={() => run(() => verify(businessId, d.id))}>Verify now</Button>}
            {d.verificationStatus === "VERIFIED" && !d.isPrimary && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setPrimary(businessId, d.id))}>Make primary</Button>}
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Remove ${d.hostname}?`)) run(() => remove(businessId, d.id)); }}>Remove</Button>
          </>} />
          <CardBody className="space-y-4">
            {d.verificationError && <Alert tone="warning">{d.verificationError} DNS changes can take up to an hour to propagate.</Alert>}
            {d.instructions.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium">DNS records to add at your registrar</div>
                <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-neutral-500"><tr><th className="py-1">Type</th><th className="py-1">Name / host</th><th className="py-1">Value</th><th className="py-1"></th></tr></thead>
                  <tbody>{d.instructions.map((i, k) => <tr key={k} className="border-t border-neutral-100"><td className="py-2 font-mono">{i.type}</td><td className="py-2 font-mono text-xs">{i.name}</td><td className="py-2 font-mono text-xs break-all">{i.value}</td><td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => copy(i.value)}>Copy</Button></td></tr>)}</tbody></table>
                <p className="mt-2 text-xs text-neutral-500">{d.instructions.map((i) => i.purpose).join(" ")}</p>
              </div>
            )}
            {d.verificationStatus === "VERIFIED" && (
              <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] items-end">
                <Field label="Redirect this domain to"><Select defaultValue={d.redirectToDomainId ?? ""} id={`redir-${d.id}`}><option value="">No redirect (serve site)</option>{domains.filter((o) => o.id !== d.id && o.verificationStatus === "VERIFIED").map((o) => <option key={o.id} value={o.id}>{o.hostname}</option>)}</Select></Field>
                <Field label="Type"><Select defaultValue={String(d.redirectType)} id={`redirtype-${d.id}`}><option value="301">301 permanent</option><option value="302">302 temporary</option></Select></Field>
                <Button variant="secondary" disabled={pending} onClick={() => { const to = (document.getElementById(`redir-${d.id}`) as HTMLSelectElement).value; const type = Number((document.getElementById(`redirtype-${d.id}`) as HTMLSelectElement).value); run(() => setRedirect(businessId, d.id, to, type)); }}>Save redirect</Button>
              </div>
            )}
            <p className="text-xs text-neutral-500">SSL: {provider === "manual" ? "provisioned by the platform team after verification (manual provider)." : `managed automatically by ${provider}.`}{d.sslProvider ? ` Provider: ${d.sslProvider}.` : ""}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
