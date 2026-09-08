"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Field, Input, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import type { ActionResult } from "@/lib/actions";

type State = "send" | "void" | "archive" | "duplicate";

export function InvoiceActions({ businessId, invoice, publicUrl, methods, state, recordPayment }: {
  businessId: string;
  invoice: { id: string; status: string; hasCustomerEmail: boolean; balanceDollars: string; balanceCents: number };
  publicUrl: string;
  methods: readonly string[];
  state: (businessId: string, invoiceId: string, state: State) => Promise<ActionResult<{ id?: string; note?: string }>>;
  recordPayment: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [showPay, setShowPay] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const run = (s: State) => start(async () => {
    const r = await state(businessId, invoice.id, s);
    if (!r.ok) { setMsg({ tone: "danger", text: r.error }); return; }
    if (s === "duplicate" && r.data.id) { router.push(`/admin/${businessId}/invoices/${r.data.id}`); return; }
    if (s === "archive") { router.push(`/admin/${businessId}/invoices`); return; }
    setMsg({ tone: "success", text: r.data.note ?? r.message ?? "Done" });
    router.refresh();
  });
  const st = invoice.status;
  const open = st === "DRAFT" || st === "SENT" || st === "OVERDUE";
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-2">
        {open && <Button size="sm" disabled={pending} onClick={() => { if (!invoice.hasCustomerEmail && !window.confirm("The customer has no email. Mark as sent and share the link manually?")) return; run("send"); }}>{st === "DRAFT" ? "Send invoice" : "Resend"}</Button>}
        {st === "DRAFT" && <ButtonLink size="sm" variant="secondary" href={`/admin/${businessId}/invoices/${invoice.id}?edit=1`}>Edit</ButtonLink>}
        {st !== "VOID" && invoice.balanceCents > 0 && <Button size="sm" variant="secondary" onClick={() => setShowPay((v) => !v)}>Record payment</Button>}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("duplicate")}>Duplicate</Button>
        {st !== "PAID" && st !== "VOID" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Void this invoice? It can no longer be paid.")) run("void"); }}>Void</Button>}
        {(st === "DRAFT" || st === "VOID") && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Archive this invoice?")) run("archive"); }}>Archive</Button>}
      </div>
      {showPay && (
        <ActionForm action={recordPayment} onSuccess={() => setShowPay(false)} className="space-y-2 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount"><Input name="amount" type="number" step="0.01" min="0.01" defaultValue={invoice.balanceDollars} required /></Field>
            <Field label="Method"><Select name="method" defaultValue="bank_transfer">{methods.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</Select></Field>
            <Field label="Received on"><Input name="receivedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Reference"><Input name="reference" placeholder="Bank ref, receipt no." /></Field>
          </div>
          <div className="flex gap-2"><SubmitButton size="sm">Save payment</SubmitButton><Button type="button" size="sm" variant="ghost" onClick={() => setShowPay(false)}>Cancel</Button></div>
        </ActionForm>
      )}
      <div className="border-t pt-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Customer link</div>
        <div className="flex items-center gap-2"><Input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} className="text-xs" /><Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }}>{copied ? "Copied" : "Copy"}</Button></div>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">Open customer view ↗</a>
      </div>
    </div>
  );
}
