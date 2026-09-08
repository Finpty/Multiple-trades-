import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { prefillLineItems } from "@/lib/operations/invoices";
import { PageHeader } from "@/components/ui";
import { InvoiceEditor } from "@/components/admin/operations/invoices/invoice-editor";
import { loadInvoiceEditorData } from "../editor-data";
import { saveInvoiceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ customerId?: string; quoteId?: string; jobId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "invoices.manage");
  const sp = await searchParams;
  const [data, prefill] = await Promise.all([loadInvoiceEditorData(ctx), prefillLineItems(ctx.db, businessId, { quoteId: isUuid(sp.quoteId) ? sp.quoteId : null, jobId: isUuid(sp.jobId) ? sp.jobId : null })]);
  const terms = Number((ctx.business.settings as { invoiceTermsDays?: number } | null)?.invoiceTermsDays ?? 14);
  const base = `/admin/${businessId}/invoices`;
  return (
    <div>
      <PageHeader title="New invoice" breadcrumbs={[{ label: "Invoices", href: base }, { label: "New" }]} />
      <InvoiceEditor businessId={businessId} values={{ invoiceId: null, customerId: prefill.customerId ?? (isUuid(sp.customerId) ? sp.customerId! : null), jobId: prefill.jobId, quoteId: prefill.quoteId, lines: prefill.lineItems.map((l) => ({ id: l.id ?? "", description: l.description, quantity: l.quantity, unit: l.unit ?? "", unitCents: l.unitCents })), notes: prefill.notes ?? (ctx.business.settings as { paymentInstructions?: string } | null)?.paymentInstructions ?? "", dueAt: new Date(Date.now() + terms * 86_400_000).toISOString().slice(0, 10) }} {...data} cancelHref={base} save={saveInvoiceAction} />
    </div>
  );
}
