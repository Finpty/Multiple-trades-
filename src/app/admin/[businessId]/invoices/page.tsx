import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { customerName } from "@/lib/operations/customers";
import { balanceCents, listInvoices } from "@/lib/operations/invoices";
import { formatCents } from "@/lib/money";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Stat, Table, TBody, Td, Th, THead, cn, formatDate, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";
const FILTERS = [["", "All"], ["DRAFT", "Drafts"], ["SENT", "Sent"], ["OVERDUE", "Overdue"], ["PAID", "Paid"], ["VOID", "Void"]] as const;

export default async function InvoicesPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ status?: string; q?: string; customerId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "invoices.manage");
  const sp = await searchParams;
  const status = sp.status ?? "";
  const [rows, all] = await Promise.all([listInvoices(ctx.db, businessId, { status, q: sp.q, customerId: isUuid(sp.customerId) ? sp.customerId : undefined }), listInvoices(ctx.db, businessId, {})]);
  const cur = ctx.business.currency;
  const outstanding = all.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + balanceCents(i), 0);
  const overdue = all.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + balanceCents(i), 0);
  const since = Date.now() - 30 * 86_400_000;
  const paid30 = all.flatMap((i) => i.payments).filter((p) => p.status === "SUCCEEDED" && (p.receivedAt ?? p.createdAt).getTime() >= since).reduce((s, p) => s + p.amountCents, 0);
  const base = `/admin/${businessId}/invoices`;
  return (
    <div>
      <PageHeader title="Invoices" description="Invoice from accepted quotes or jobs, send for online viewing, and record payments. Overdue reminders run automatically." actions={<ButtonLink href={`${base}/new`}>New invoice</ButtonLink>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatCents(outstanding, cur)} hint={`${all.filter((i) => i.status === "SENT" || i.status === "OVERDUE").length} unpaid`} />
        <Stat label="Overdue" value={formatCents(overdue, cur)} tone={overdue > 0 ? "red" : undefined} />
        <Stat label="Received (30 days)" value={formatCents(paid30, cur)} tone="green" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {FILTERS.map(([k, l]) => <Link key={k} href={k ? `${base}?status=${k}` : base} className={cn("rounded-full px-3 py-1 text-sm", k === status ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>{l}</Link>)}
        <form className="ml-auto" action={base}>{status && <input type="hidden" name="status" value={status} />}<Input name="q" defaultValue={sp.q ?? ""} placeholder="Search number or customer" className="w-64" aria-label="Search invoices" /></form>
      </div>
      {rows.length === 0 ? <EmptyState title="No invoices here" description="Create one from an accepted quote, a job, or from scratch." action={<ButtonLink href={`${base}/new`}>New invoice</ButtonLink>} /> : (
        <Card><Table>
          <THead><tr><Th>Invoice</Th><Th>Customer</Th><Th>Status</Th><Th>Total</Th><Th>Balance</Th><Th>Due</Th></tr></THead>
          <TBody>{rows.map((i) => (
            <tr key={i.id}>
              <Td><Link href={`${base}/${i.id}`} className="font-medium hover:underline">{i.number}</Link><span className="block text-xs text-neutral-500">{[i.job?.number, i.quote?.number].filter(Boolean).join(" · ")}</span></Td>
              <Td>{i.customer ? <Link href={`/admin/${businessId}/customers/${i.customer.id}`} className="hover:underline">{customerName(i.customer)}</Link> : "—"}</Td>
              <Td><Badge tone={statusTone(i.status)}>{i.status}</Badge></Td>
              <Td className="tabular-nums">{formatCents(i.totalCents, i.currency)}</Td>
              <Td className="tabular-nums">{i.status === "VOID" ? "—" : formatCents(balanceCents(i), i.currency)}</Td>
              <Td className={cn("text-xs", i.status === "OVERDUE" ? "text-red-600" : "text-neutral-500")}>{i.dueAt ? formatDate(i.dueAt) : "—"}</Td>
            </tr>
          ))}</TBody>
        </Table></Card>
      )}
    </div>
  );
}
