import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { customerName } from "@/lib/operations/customers";
import { lineItemsOf, quoteInclude } from "@/lib/operations/quotes";
import { platformUrl } from "@/lib/site/context";
import { mediaUrls } from "@/lib/media/service";
import { formatCents } from "@/lib/money";
import { Badge, Card, CardBody, CardHeader, Description, PageHeader, formatDate, formatDateTime, statusTone } from "@/components/ui";
import { QuoteDocument } from "@/components/admin/operations/quotes/quote-document";
import { QuoteActions } from "@/components/admin/operations/quotes/quote-actions";
import { QuoteEditor } from "@/components/admin/operations/quotes/quote-editor";
import { loadQuoteEditorData, quoteToEditorValues } from "../editor-data";
import { quoteCalculateAction, quoteStateAction, quoteToInvoiceAction, quoteToJobAction, saveQuoteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params, searchParams }: { params: Promise<{ businessId: string; quoteId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { businessId, quoteId } = await params;
  const { edit } = await searchParams;
  if (!isUuid(businessId) || !isUuid(quoteId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "quotes.manage");
  const q = await ctx.db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: undefined }, include: quoteInclude });
  if (!q) notFound();
  const base = `/admin/${businessId}`;
  const editable = ["DRAFT", "SENT", "VIEWED"].includes(q.status) && !q.deletedAt;

  if (edit === "1" && editable) {
    const data = await loadQuoteEditorData(ctx);
    return (
      <div>
        <PageHeader title={`Edit ${q.number}`} breadcrumbs={[{ label: "Quotes", href: `${base}/quotes` }, { label: q.number, href: `${base}/quotes/${q.id}` }, { label: "Edit" }]} />
        <QuoteEditor businessId={businessId} values={quoteToEditorValues(q)} {...data} cancelHref={`${base}/quotes/${q.id}`} calculate={quoteCalculateAction} save={saveQuoteAction} />
      </div>
    );
  }

  const logo = ctx.business.logoMediaId ? await ctx.db.media.findFirst({ where: { id: ctx.business.logoMediaId, businessId } }) : null;
  const logoUrl = logo ? (await mediaUrls(logo)).medium : null;
  const publicUrl = platformUrl(`/q/${q.publicToken}`);
  return (
    <div>
      <PageHeader
        title={`${q.number} · ${q.title}`}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(q.status)}>{q.status}</Badge>{q.customer && <Link href={`${base}/customers/${q.customer.id}`} className="text-sm underline">{customerName(q.customer)}</Link>}{q.lead && <Link href={`${base}/leads/${q.lead.id}`} className="text-sm underline">lead: {q.lead.name}</Link>}</span>}
        breadcrumbs={[{ label: "Quotes", href: `${base}/quotes` }, { label: q.number }]}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <QuoteDocument
            number={q.number} title={q.title} status={q.status} currency={q.currency}
            lineItems={lineItemsOf(q)} subtotalCents={q.subtotalCents} taxCents={q.taxCents} totalCents={q.totalCents} depositCents={q.depositCents}
            taxName={ctx.business.taxName} taxInclusive={ctx.business.taxInclusive} notes={q.notes} terms={q.terms}
            validUntil={q.validUntil ? formatDate(q.validUntil) : null} issuedOn={formatDate(q.sentAt ?? q.createdAt)}
            business={{ name: ctx.business.name, phone: ctx.business.phone, email: ctx.business.email, website: ctx.business.website, logoUrl }}
            customer={q.customer ? { name: customerName(q.customer), company: q.customer.company, email: q.customer.email } : null}
            acceptedByName={q.acceptedByName} acceptedAt={q.acceptedAt ? formatDateTime(q.acceptedAt) : null}
          />
        </div>
        <div className="space-y-4">
          <Card><CardHeader title="Actions" /><CardBody>
            <QuoteActions businessId={businessId} quote={{ id: q.id, status: q.deletedAt ? "ARCHIVED" : q.status, hasCustomerEmail: !!q.customer?.email, hasJob: q.jobs.length > 0, jobId: q.jobs[0]?.id ?? null, hasInvoice: q.invoices.length > 0, depositCents: q.depositCents }} publicUrl={publicUrl} can={{ jobs: ctx.can("jobs.manage"), invoices: ctx.can("invoices.manage") }} actions={{ state: quoteStateAction, toJob: quoteToJobAction, toInvoice: quoteToInvoiceAction }} />
          </CardBody></Card>
          <Card><CardHeader title="Activity" /><CardBody>
            <Description items={[
              { label: "Created", value: formatDateTime(q.createdAt) },
              { label: "Sent", value: q.sentAt ? formatDateTime(q.sentAt) : null },
              { label: "Viewed by customer", value: q.viewedAt ? formatDateTime(q.viewedAt) : null },
              { label: "Accepted", value: q.acceptedAt ? `${formatDateTime(q.acceptedAt)}${q.acceptedByName ? ` by ${q.acceptedByName}` : ""}` : null },
              { label: "Declined", value: q.declinedAt ? formatDateTime(q.declinedAt) : null },
              { label: "Valid until", value: q.validUntil ? formatDate(q.validUntil) : null },
              { label: "Jobs", value: q.jobs.length ? <span className="space-x-2">{q.jobs.map((j) => <Link key={j.id} href={`${base}/jobs/${j.id}`} className="underline">{j.number}</Link>)}</span> : null },
              { label: "Invoices", value: q.invoices.length ? <span className="space-x-2">{q.invoices.map((i) => <Link key={i.id} href={`${base}/invoices/${i.id}`} className="underline">{i.number} ({i.status.toLowerCase()}, {formatCents(i.totalCents, q.currency)})</Link>)}</span> : null },
            ]} />
          </CardBody></Card>
        </div>
      </div>
    </div>
  );
}
