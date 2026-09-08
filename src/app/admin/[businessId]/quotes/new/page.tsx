import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { QuoteEditor } from "@/components/admin/operations/quotes/quote-editor";
import { loadQuoteEditorData } from "../editor-data";
import { quoteCalculateAction, saveQuoteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ customerId?: string; leadId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "quotes.manage");
  const sp = await searchParams;
  const [data, lead] = await Promise.all([
    loadQuoteEditorData(ctx),
    isUuid(sp.leadId) ? ctx.db.lead.findFirst({ where: { id: sp.leadId, businessId }, select: { id: true, name: true, customerId: true, message: true, service: { select: { name: true } }, locationText: true } }) : null,
  ]);
  const settings = ctx.business.settings as { quoteTerms?: string; quoteValidityDays?: number } | null;
  const validityDays = Number(settings?.quoteValidityDays ?? 30);
  const base = `/admin/${businessId}/quotes`;
  return (
    <div>
      <PageHeader title="New quote" description={lead ? `From lead: ${lead.name}${lead.service?.name ? ` · ${lead.service.name}` : ""}` : undefined} breadcrumbs={[{ label: "Quotes", href: base }, { label: "New" }]} />
      <QuoteEditor
        businessId={businessId}
        values={{ quoteId: null, customerId: lead?.customerId ?? (isUuid(sp.customerId) ? sp.customerId! : null), leadId: lead?.id ?? null, title: lead ? [lead.service?.name, lead.locationText].filter(Boolean).join(" — ") || `Quote for ${lead.name}` : "", lines: [], notes: lead?.message ? "" : "", terms: settings?.quoteTerms ?? "", validUntil: new Date(Date.now() + validityDays * 86_400_000).toISOString().slice(0, 10), depositPercent: 0, inputs: {} }}
        {...data}
        cancelHref={base}
        calculate={quoteCalculateAction}
        save={saveQuoteAction}
      />
    </div>
  );
}
