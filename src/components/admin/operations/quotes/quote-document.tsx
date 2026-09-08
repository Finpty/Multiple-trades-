import { formatCents } from "@/lib/money";

export interface QuoteDocumentProps {
  number: string;
  title: string;
  status: string;
  currency: string;
  lineItems: Array<{ id?: string; description: string; quantity: number; unit?: string; unitCents: number; totalCents: number }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  taxName: string;
  taxInclusive: boolean;
  notes: string | null;
  terms: string | null;
  validUntil: string | null;
  issuedOn: string;
  business: { name: string; phone: string | null; email: string | null; website: string | null; logoUrl: string | null };
  customer: { name: string; company: string | null; email: string | null } | null;
  acceptedByName?: string | null;
  acceptedAt?: string | null;
}

/** Server-renderable quote document shared by the admin preview and the public /q page. */
export function QuoteDocument(d: QuoteDocumentProps) {
  return (
    <article className="rounded-lg border bg-white p-6 text-sm text-neutral-900 shadow-sm sm:p-8" style={{ fontFamily: "var(--font-body, inherit)" }}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          {d.business.logoUrl ? <img src={d.business.logoUrl} alt="" className="h-12 w-auto max-w-40 object-contain" /> : <div className="text-xl font-semibold" style={{ color: "var(--color-primary, inherit)" }}>{d.business.name}</div>}
          <div className="text-xs text-neutral-500">{d.business.logoUrl && <div className="font-medium text-neutral-800">{d.business.name}</div>}{d.business.phone && <div>{d.business.phone}</div>}{d.business.email && <div>{d.business.email}</div>}{d.business.website && <div>{d.business.website}</div>}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Quote</div>
          <div className="text-2xl font-semibold">{d.number}</div>
          <div className="text-xs text-neutral-500">Issued {d.issuedOn}{d.validUntil ? ` · valid until ${d.validUntil}` : ""}</div>
        </div>
      </header>
      <div className="grid gap-6 py-5 sm:grid-cols-2">
        <div><div className="text-xs uppercase tracking-wide text-neutral-500">Prepared for</div>{d.customer ? <div className="mt-1 font-medium">{d.customer.name}{d.customer.company ? <span className="block text-neutral-600">{d.customer.company}</span> : null}{d.customer.email ? <span className="block text-neutral-500">{d.customer.email}</span> : null}</div> : <div className="mt-1 text-neutral-500">—</div>}</div>
        <div><div className="text-xs uppercase tracking-wide text-neutral-500">Project</div><div className="mt-1 font-medium">{d.title}</div></div>
      </div>
      <table className="w-full">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-500"><th className="py-2 pr-2">Description</th><th className="w-16 py-2 pr-2 text-right">Qty</th><th className="w-32 py-2 pr-2 text-right">Unit</th><th className="w-32 py-2 text-right">Amount</th></tr></thead>
        <tbody>{d.lineItems.map((l, i) => <tr key={l.id ?? i} className="border-b border-neutral-100"><td className="py-2 pr-2">{l.description}</td><td className="py-2 pr-2 text-right tabular-nums">{l.quantity}{l.unit ? ` ${l.unit}` : ""}</td><td className="py-2 pr-2 text-right tabular-nums">{formatCents(l.unitCents, d.currency)}</td><td className="py-2 text-right tabular-nums">{formatCents(l.totalCents, d.currency)}</td></tr>)}</tbody>
      </table>
      <div className="ml-auto mt-4 w-full max-w-xs space-y-1">
        <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span className="tabular-nums">{formatCents(d.subtotalCents, d.currency)}</span></div>
        <div className="flex justify-between text-neutral-600"><span>{d.taxName}{d.taxInclusive ? " (included)" : ""}</span><span className="tabular-nums">{formatCents(d.taxCents, d.currency)}</span></div>
        <div className="flex justify-between border-t pt-1 text-lg font-semibold"><span>Total</span><span className="tabular-nums" style={{ color: "var(--color-primary, inherit)" }}>{formatCents(d.totalCents, d.currency)}</span></div>
        {d.depositCents > 0 && <div className="flex justify-between text-xs text-neutral-600"><span>Deposit to start</span><span className="tabular-nums">{formatCents(d.depositCents, d.currency)}</span></div>}
      </div>
      {d.notes && <section className="mt-6"><div className="text-xs uppercase tracking-wide text-neutral-500">Notes</div><p className="mt-1 whitespace-pre-wrap">{d.notes}</p></section>}
      {d.terms && <section className="mt-6"><div className="text-xs uppercase tracking-wide text-neutral-500">Terms</div><p className="mt-1 whitespace-pre-wrap text-xs text-neutral-600">{d.terms}</p></section>}
      {d.acceptedByName && <section className="mt-6 rounded-md bg-emerald-50 p-3 text-emerald-800">Accepted by {d.acceptedByName}{d.acceptedAt ? ` on ${d.acceptedAt}` : ""}.</section>}
    </article>
  );
}
