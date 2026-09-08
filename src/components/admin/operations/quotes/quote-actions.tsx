"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Field, Input, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

type State = "send" | "accept" | "decline" | "reopen" | "archive" | "duplicate";

/** Side panel actions for a quote: send, mark accepted/declined, reopen, duplicate, archive, create job/invoice, copy link. */
export function QuoteActions({ businessId, quote, publicUrl, can, actions }: {
  businessId: string;
  quote: { id: string; status: string; hasCustomerEmail: boolean; hasJob: boolean; jobId: string | null; hasInvoice: boolean; depositCents: number };
  publicUrl: string;
  can: { jobs: boolean; invoices: boolean };
  actions: {
    state: (businessId: string, quoteId: string, state: State, extra?: { message?: string; reason?: string; acceptedByName?: string }) => Promise<ActionResult<{ id?: string; note?: string }>>;
    toJob: (businessId: string, quoteId: string) => Promise<ActionResult<{ jobId: string }>>;
    toInvoice: (businessId: string, quoteId: string, depositOnly: boolean) => Promise<ActionResult<{ invoiceId: string }>>;
  };
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const [panel, setPanel] = React.useState<"send" | "decline" | "accept" | null>(null);
  const [message, setMessage] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [acceptedBy, setAcceptedBy] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const run = (state: State, extra?: { message?: string; reason?: string; acceptedByName?: string }) => start(async () => {
    const r = await actions.state(businessId, quote.id, state, extra);
    if (!r.ok) { setMsg({ tone: "danger", text: r.error }); return; }
    setPanel(null);
    if (state === "duplicate" && r.data.id) { router.push(`/admin/${businessId}/quotes/${r.data.id}`); return; }
    if (state === "archive") { router.push(`/admin/${businessId}/quotes`); return; }
    setMsg({ tone: "success", text: r.data.note ?? r.message ?? "Done" });
    router.refresh();
  });
  const s = quote.status;
  const editable = ["DRAFT", "SENT", "VIEWED"].includes(s);
  const sendable = ["DRAFT", "SENT", "VIEWED", "EXPIRED"].includes(s);
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-2">
        {sendable && <Button size="sm" onClick={() => setPanel(panel === "send" ? null : "send")} disabled={pending}>{s === "DRAFT" ? "Send quote" : "Resend"}</Button>}
        {editable && <ButtonLink size="sm" variant="secondary" href={`/admin/${businessId}/quotes/${quote.id}?edit=1`}>Edit</ButtonLink>}
        {sendable && <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "accept" ? null : "accept")} disabled={pending}>Mark accepted</Button>}
        {["SENT", "VIEWED", "EXPIRED", "DRAFT"].includes(s) && <Button size="sm" variant="ghost" onClick={() => setPanel(panel === "decline" ? null : "decline")} disabled={pending}>Mark declined</Button>}
        {(s === "DECLINED" || s === "EXPIRED") && <Button size="sm" variant="secondary" onClick={() => run("reopen")} disabled={pending}>Reopen</Button>}
        <Button size="sm" variant="ghost" onClick={() => run("duplicate")} disabled={pending}>Duplicate</Button>
        {s !== "ACCEPTED" && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Archive this quote? It disappears from lists but stays on the customer record.")) run("archive"); }} disabled={pending}>Archive</Button>}
      </div>
      {panel === "send" && (
        <div className="space-y-2 rounded-md border p-3">
          {!quote.hasCustomerEmail && <Alert tone="warning">The customer has no email address. The quote will be marked as sent; share the link below manually.</Alert>}
          <Field label="Message (optional)"><Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi Sarah, here is the quote we discussed…" /></Field>
          <div className="flex gap-2"><Button size="sm" disabled={pending} onClick={() => run("send", { message })}>{pending ? "Sending…" : quote.hasCustomerEmail ? "Send email" : "Mark as sent"}</Button><Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button></div>
        </div>
      )}
      {panel === "accept" && (
        <div className="space-y-2 rounded-md border p-3">
          <Field label="Accepted by" hint="Who accepted (e.g. by phone or in person)"><Input value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} placeholder="Customer name" /></Field>
          <div className="flex gap-2"><Button size="sm" disabled={pending} onClick={() => run("accept", { acceptedByName: acceptedBy })}>Mark accepted</Button><Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button></div>
        </div>
      )}
      {panel === "decline" && (
        <div className="space-y-2 rounded-md border p-3">
          <Field label="Reason (optional)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Went with another quote" /></Field>
          <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={pending} onClick={() => run("decline", { reason })}>Mark declined</Button><Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button></div>
        </div>
      )}
      <div className="border-t pt-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Customer link</div>
        <div className="flex items-center gap-2"><Input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} className="text-xs" /><Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }}>{copied ? "Copied" : "Copy"}</Button></div>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">Open customer view ↗</a>
      </div>
      {(s === "ACCEPTED" || quote.hasJob || quote.hasInvoice) && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Next steps</div>
          <div className="flex flex-wrap gap-2">
            {quote.hasJob ? <ButtonLink size="sm" variant="secondary" href={`/admin/${businessId}/jobs/${quote.jobId}`}>Open job</ButtonLink> : can.jobs && <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await actions.toJob(businessId, quote.id); if (r.ok) router.push(`/admin/${businessId}/jobs/${r.data.jobId}`); else setMsg({ tone: "danger", text: r.error }); })}>Create job</Button>}
            {can.invoices && <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await actions.toInvoice(businessId, quote.id, false); if (r.ok) router.push(`/admin/${businessId}/invoices/${r.data.invoiceId}`); else setMsg({ tone: "danger", text: r.error }); })}>Create invoice</Button>}
            {can.invoices && quote.depositCents > 0 && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await actions.toInvoice(businessId, quote.id, true); if (r.ok) router.push(`/admin/${businessId}/invoices/${r.data.invoiceId}`); else setMsg({ tone: "danger", text: r.error }); })}>Deposit invoice</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
