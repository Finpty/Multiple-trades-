import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { customerName } from "@/lib/operations/customers";
import { PAYMENT_METHODS, balanceCents, invoiceInclude, lineItemsOf } from "@/lib/operations/invoices";
import { addressText } from "@/lib/operations/jobs";
import { platformUrl } from "@/lib/site/context";
import { mediaUrls } from "@/lib/media/service";
import { Badge, Card, CardBody, CardHeader, Description, PageHeader, formatDate, formatDateTime, statusTone } from "@/components/ui";
import { InvoiceDocument } from "@/components/admin/operations/invoices/invoice-document";
import { InvoiceActions } from "@/components/admin/operations/invoices/invoice-actions";
import { InvoiceEditor } from "@/components/admin/operations/invoices/invoice-editor";
import { invoiceToEditorValues, loadInvoiceEditorData } from "../editor-data";
import { invoiceStateAction, recordPaymentAction, saveInvoiceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ businessId: string; invoiceId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { businessId, invoiceId } = await params;
  const { edit } = await searchParams;
  if (!isUuid(businessId) || !isUuid(invoiceId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "invoices.manage");
  const inv = await ctx.db.invoice.findFirst({ where: { id: invoiceId, businessId, deletedAt: undefined }, include: invoiceInclude });
  if (!inv) notFound();
  const base = `/admin/${businessId}`;
  if (edit === "1" && inv.status === "DRAFT") {
    const data = await loadInvoiceEditorData(ctx);
    return (
      <div>
        <PageHeader title={`Edit ${inv.number}`} breadcrumbs={[{ label: "Invoices", href: `${base}/invoices` }, { label: inv.number, href: `${base}/invoices/${inv.id}` }, { label: "Edit" }]} />
        <InvoiceEditor businessId={businessId} values={invoiceToEditorValues(inv)} {...data} cancelHref={`${base}/invoices/${inv.id}`} save={saveInvoiceAction} />
      </div>
    );
  }
  const [logo, location] = await Promise.all([
    ctx.business.logoMediaId ? ctx.db.media.findFirst({ where: { id: ctx.business.logoMediaId, businessId } }) : null,
    ctx.db.businessLocation.findFirst({ where: { businessId, isPrimary: true } }),
  ]);
  const logoUrl = logo ? (await mediaUrls(logo)).medium : null;
  const balance = balanceCents(inv);
  const publicUrl = platformUrl(`/i/${inv.publicToken}`);
  return (
    <div>
      <PageHeader
        title={inv.number}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(inv.status)}>{inv.status}</Badge>{inv.customer && <Link href={`${base}/customers/${inv.customer.id}`} className="text-sm underline">{customerName(inv.customer)}</Link>}{inv.job && <Link href={`${base}/jobs/${inv.job.id}`} className="text-sm underline">{inv.job.number}</Link>}{inv.quote && <Link href={`${base}/quotes/${inv.quote.id}`} className="text-sm underline">{inv.quote.number}</Link>}</span>}
        breadcrumbs={[{ label: "Invoices", href: `${base}/invoices` }, { label: inv.number }]}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <InvoiceDocument
          number={inv.number} status={inv.status} currency={inv.currency}
          lineItems={lineItemsOf(inv)} subtotalCents={inv.subtotalCents} taxCents={inv.taxCents} totalCents={inv.totalCents} paidCents={inv.paidCents}
          taxName={ctx.business.taxName} taxInclusive={ctx.business.taxInclusive} notes={inv.notes}
          dueOn={inv.dueAt ? formatDate(inv.dueAt) : null} issuedOn={formatDate(inv.sentAt ?? inv.createdAt)}
          business={{ name: ctx.business.name, phone: ctx.business.phone, email: ctx.business.email, website: ctx.business.website, logoUrl, businessNumber: ctx.business.businessNumber, taxNumber: ctx.business.taxNumber, address: location ? [location.addressLine1, location.city, location.state, location.postcode].filter(Boolean).join(", ") : null }}
          customer={inv.customer ? { name: customerName(inv.customer), company: inv.customer.company, email: inv.customer.email, address: addressText(inv.customer.address) || null } : null}
          reference={[inv.job?.number, inv.quote?.number].filter(Boolean).join(" / ") || null}
          payments={inv.payments.filter((p) => p.status === "SUCCEEDED").map((p) => ({ id: p.id, amountCents: p.amountCents, method: p.method, receivedAt: formatDate(p.receivedAt ?? p.createdAt), reference: (p.metadata as { reference?: string } | null)?.reference ?? null }))}
        />
        <div className="space-y-4">
          <Card><CardHeader title="Actions" /><CardBody>
            <InvoiceActions businessId={businessId} invoice={{ id: inv.id, status: inv.deletedAt ? "ARCHIVED" : inv.status, hasCustomerEmail: !!inv.customer?.email, balanceDollars: (balance / 100).toFixed(2), balanceCents: balance }} publicUrl={publicUrl} methods={PAYMENT_METHODS} state={invoiceStateAction} recordPayment={recordPaymentAction.bind(null, businessId, inv.id)} />
          </CardBody></Card>
          <Card><CardHeader title="Activity" /><CardBody>
            <Description items={[
              { label: "Created", value: formatDateTime(inv.createdAt) },
              { label: "Sent", value: inv.sentAt ? formatDateTime(inv.sentAt) : null },
              { label: "Due", value: inv.dueAt ? formatDate(inv.dueAt) : null },
              { label: "Paid", value: inv.paidAt ? formatDateTime(inv.paidAt) : null },
              { label: "Payments", value: inv.payments.length ? `${inv.payments.length} recorded` : null },
            ]} />
          </CardBody></Card>
        </div>
      </div>
    </div>
  );
}
