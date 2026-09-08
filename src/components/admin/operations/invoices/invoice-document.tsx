import { formatCents } from "@/lib/money";

export interface InvoiceDocumentProps {
  number: string;
  status: string;
  currency: string;
  lineItems: Array<{ id?: string; description: string; quantity: number; unit?: string; unitCents: number; totalCents: number }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  taxName: string;
  taxInclusive: boolean;
  notes: string | null;
  dueOn: string | null;
  issuedOn: string;
  business: { name: string; phone: string | null; email: string | null; website: string | null; logoUrl: string | null; businessNumber: string | null; taxNumber: string | null; address: string | null };
  customer: { name: string; company: string | null; email: string | null; address: string | null } | null;
  reference: string | null;
  payments: Array<{ id: string; amountCents: number; method: string | null; receivedAt: string; reference: string | null }>;
}

/** Server-renderable invoice document shared by the admin view and the public /i page. */
export function InvoiceDocument(d: InvoiceDocumentProps) {
  const balance = Math.max(0, d.totalCents - d.paidCents);
  return (
    <article className="rounded-lg border bg-white p-6 text-sm text-neutral-900 shadow-sm sm:p-8" style={{ fontFamily: "var(--font-body, inherit)" }}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          {d.business.logoUrl ? <img src={d.business.logoUrl} alt="" className="h-12 w-auto max-w-40 object-contain" /> : <div className="text-xl font-semibold" style={{ color: "var(--color-primary, inherit)" }}>{d.business.name}</div>}
          <div className="text-xs text-neutral-500">{d.business.logoUrl && <div className="font-medium text-neutral-800">{d.business.name}</div>}{d.business.address && <div>{d.business.address}</div>}{d.business.phone && <div>{d.business.phone}</div>}{d.business.email && <div>{d.business.email}</div>}{d.business.businessNumber && <div>ABN {d.business.businessNumber}</div>}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{d.status === "VOID" ? "Void invoice" : d.business.taxNumber ? "Tax invoice" : "Invoice"}</div>
          <div className="text-2xl font-semibold">{d.number}</div>
          <div className="text-xs text-neutral-500">Issued {d.issuedOn}{d.dueOn ? ` · due ${d.dueOn}` : ""}</div>
          {d.reference && <div className="text-xs text-neutral-500">Ref {d.reference}</div>}
        </div>
      </header>
      <div className="grid gap-6 py-5 sm:grid-cols-2">
        <div><div className="text-xs uppercase tracking-wide text-neutral-500">Bill to</div>{d.customer ? <div className="mt-1 font-medium">{d.customer.name}{d.customer.company ? <span className="block text-neutral-600">{d.customer.company}</span> : null}{d.customer.address ? <span className="block font-normal text-neutral-500">{d.customer.address}</span> : null}{d.customer.email ? <span className="block font-normal text-neutral-500">{d.customer.email}</span> : null}</div> : <div className="mt-1 text-neutral-500">—</div>}</div>
        <div className="sm:text-right"><div className="text-xs uppercase tracking-wide text-neutral-500">Amount due</div><div className="mt-1 text-2xl font-semibold" style={{ color: balance > 0 ? "var(--color-primary, inherit)" : "inherit" }}>{formatCents(balance, d.currency)}</div>{d.paidCents > 0 && <div className="text-xs text-neutral-500">{formatCents(d.paidCents, d.currency)} paid of {formatCents(d.totalCents, d.currency)}</div>}</div>
      </div>
      <table className="w-full">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-500"><th className="py-2 pr-2">Description</th><th className="w-16 py-2 pr-2 text-right">Qty</th><th className="w-32 py-2 pr-2 text-right">Unit</th><th className="w-32 py-2 text-right">Amount</th></tr></thead>
        <tbody>{d.lineItems.map((l, i) => <tr key={l.id ?? i} className="border-b border-neutral-100"><td className="py-2 pr-2">{l.description}</td><td className="py-2 pr-2 text-right tabular-nums">{l.quantity}{l.unit ? ` ${l.unit}` : ""}</td><td className="py-2 pr-2 text-right tabular-nums">{formatCents(l.unitCents, d.currency)}</td><td className="py-2 text-right tabular-nums">{formatCents(l.totalCents, d.currency)}</td></tr>)}</tbody>
      </table>
      <div className="ml-auto mt-4 w-full max-w-xs space-y-1">
        <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span className="tabular-nums">{formatCents(d.subtotalCents, d.currency)}</span></div>
        <div className="flex justify-between text-neutral-600"><span>{d.taxName}{d.taxInclusive ? " (included)" : ""}</span><span className="tabular-nums">{formatCents(d.taxCents, d.currency)}</span></div>
        <div className="flex justify-between border-t pt-1 text-lg font-semibold"><span>Total</span><span className="tabular-nums">{formatCents(d.totalCents, d.currency)}</span></div>
        {d.paidCents > 0 && <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="tabular-nums">−{formatCents(d.paidCents, d.currency)}</span></div>}
        {d.paidCents > 0 && <div className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular-nums">{formatCents(balance, d.currency)}</span></div>}
      </div>
      {d.notes && <section className="mt-6"><div className="text-xs uppercase tracking-wide text-neutral-500">Payment details & notes</div><p className="mt-1 whitespace-pre-wrap">{d.notes}</p></section>}
      {d.payments.length > 0 && <section className="mt-6"><div className="text-xs uppercase tracking-wide text-neutral-500">Payments received</div><ul className="mt-1 divide-y text-xs">{d.payments.map((p) => <li key={p.id} className="flex justify-between py-1"><span>{p.receivedAt}{p.method ? ` · ${p.method.replace("_", " ")}` : ""}{p.reference ? ` · ${p.reference}` : ""}</span><span className="tabular-nums">{formatCents(p.amountCents, d.currency)}</span></li>)}</ul></section>}
    </article>
  );
}
