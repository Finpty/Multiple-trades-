import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { customerName } from "@/lib/operations/customers";
import { listQuotes, quoteStats } from "@/lib/operations/quotes";
import { formatCents } from "@/lib/money";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Stat, Table, TBody, Td, Th, THead, cn, formatDate, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";
const FILTERS = [["", "Active"], ["open", "Awaiting reply"], ["DRAFT", "Drafts"], ["ACCEPTED", "Accepted"], ["DECLINED", "Declined"], ["EXPIRED", "Expired"], ["ARCHIVED", "Archived"]] as const;

export default async function QuotesPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ status?: string; q?: string; customerId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "quotes.manage");
  const sp = await searchParams;
  const status = sp.status ?? "";
  const [rows, stats] = await Promise.all([listQuotes(ctx.db, businessId, { status, q: sp.q, customerId: isUuid(sp.customerId) ? sp.customerId : undefined }), quoteStats(ctx.db, businessId)]);
  const base = `/admin/${businessId}/quotes`;
  const cur = ctx.business.currency;
  return (
    <div>
      <PageHeader title="Quotes" description="Build itemised quotes by hand, from your price list or with the calculator. Send them for online acceptance." actions={<ButtonLink href={`${base}/new`}>New quote</ButtonLink>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Awaiting reply" value={stats.open} hint={formatCents(stats.openCents, cur)} />
        <Stat label="Accepted (30 days)" value={formatCents(stats.acceptedCents30d, cur)} tone="green" />
        <Stat label="Acceptance rate" value={`${stats.acceptRate}%`} hint="Accepted vs declined, all time" />
        <Stat label="Showing" value={rows.length} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {FILTERS.map(([k, l]) => <Link key={k} href={k ? `${base}?status=${k}` : base} className={cn("rounded-full px-3 py-1 text-sm", k === status ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>{l}</Link>)}
        <form className="ml-auto flex gap-2" action={base}>{status && <input type="hidden" name="status" value={status} />}<Input name="q" defaultValue={sp.q ?? ""} placeholder="Search number, title, customer" className="w-64" aria-label="Search quotes" /></form>
      </div>
      {rows.length === 0 ? <EmptyState title="No quotes here" description={sp.q ? "Try another search." : "Create a quote from a lead, a customer, or from scratch."} action={<ButtonLink href={`${base}/new`}>New quote</ButtonLink>} /> : (
        <Card><Table>
          <THead><tr><Th>Quote</Th><Th>Customer</Th><Th>Status</Th><Th>Total</Th><Th>Valid until</Th><Th>Updated</Th></tr></THead>
          <TBody>
            {rows.map((q) => (
              <tr key={q.id}>
                <Td><Link href={`${base}/${q.id}`} className="font-medium hover:underline">{q.number}</Link><span className="block max-w-72 truncate text-xs text-neutral-500">{q.title}</span></Td>
                <Td>{q.customer ? <Link href={`/admin/${businessId}/customers/${q.customer.id}`} className="hover:underline">{customerName(q.customer)}</Link> : <span className="text-neutral-400">—</span>}</Td>
                <Td><Badge tone={statusTone(q.status)}>{q.status}</Badge>{q.jobs.length > 0 && <Badge tone="neutral" className="ml-1">job</Badge>}{q.invoices.length > 0 && <Badge tone="neutral" className="ml-1">invoiced</Badge>}</Td>
                <Td className="tabular-nums">{formatCents(q.totalCents, q.currency)}</Td>
                <Td className={cn("text-xs", q.validUntil && q.validUntil < new Date() && ["SENT", "VIEWED"].includes(q.status) ? "text-red-600" : "text-neutral-500")}>{q.validUntil ? formatDate(q.validUntil) : "—"}</Td>
                <Td className="text-xs text-neutral-500">{formatDate(q.updatedAt)}</Td>
              </tr>
            ))}
          </TBody>
        </Table></Card>
      )}
    </div>
  );
}
