import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { platformDb } from "@/lib/db";
import { mediaUrls } from "@/lib/media/service";
import { asObject } from "@/lib/json";
import { formatCents } from "@/lib/money";
import { balanceCents, lineItemsOf, loadPublicInvoice } from "@/lib/operations/invoices";
import { addressText } from "@/lib/operations/jobs";
import { DEFAULT_THEME_TOKENS, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";
import { fontStylesheetUrl, tokensToStyleString } from "@/lib/theme/css";
import { Alert, formatDate } from "@/components/ui";
import { InvoiceDocument } from "@/components/admin/operations/invoices/invoice-document";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Customer-facing invoice page on the platform host. The token is the credential. */
export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await loadPublicInvoice(token);
  if (!inv || inv.status === "DRAFT") notFound();
  const b = inv.business;
  const tokens = mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>(b.theme?.published ?? b.theme?.draft ?? null));
  const logo = b.logoMediaId ? await platformDb.media.findFirst({ where: { id: b.logoMediaId, businessId: b.id, deletedAt: null } }) : null;
  const logoUrl = logo ? (await mediaUrls(logo)).medium : null;
  const fonts = fontStylesheetUrl(tokens);
  const balance = balanceCents(inv);
  const location = b.locations[0];
  const settings = asObject<{ paymentInstructions?: string }>(b.settings);
  const customer = inv.customer ? { name: [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(" "), company: inv.customer.company, email: inv.customer.email, address: addressText(inv.customer.address) || null } : null;
  return (
    <div className="min-h-screen bg-neutral-100 py-8" style={{ cssText: tokensToStyleString(tokens) } as React.CSSProperties}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <div className="flex items-center justify-between text-sm text-neutral-600"><span>Invoice from <strong>{b.name}</strong></span><span>{inv.status === "PAID" ? "Paid — thank you" : inv.status === "VOID" ? "Void" : `Balance due ${formatCents(balance, inv.currency)}`}</span></div>
        {inv.status === "OVERDUE" && <Alert tone="warning">This invoice is past its due date{inv.dueAt ? ` (${formatDate(inv.dueAt)})` : ""}.</Alert>}
        {inv.status === "PAID" && <Alert tone="success">Paid in full. Thank you for your business.</Alert>}
        <InvoiceDocument
          number={inv.number} status={inv.status} currency={inv.currency}
          lineItems={lineItemsOf(inv)} subtotalCents={inv.subtotalCents} taxCents={inv.taxCents} totalCents={inv.totalCents} paidCents={inv.paidCents}
          taxName={b.taxName} taxInclusive={b.taxInclusive} notes={inv.notes ?? settings.paymentInstructions ?? null}
          dueOn={inv.dueAt ? formatDate(inv.dueAt) : null} issuedOn={formatDate(inv.sentAt ?? inv.createdAt)}
          business={{ name: b.name, phone: b.phone, email: b.email, website: b.website, logoUrl, businessNumber: b.businessNumber, taxNumber: b.taxNumber, address: location ? [location.addressLine1, location.city, location.state, location.postcode].filter(Boolean).join(", ") : null }}
          customer={customer}
          reference={[inv.job?.number, inv.quote?.number].filter(Boolean).join(" / ") || null}
          payments={inv.payments.map((p) => ({ id: p.id, amountCents: p.amountCents, method: p.method, receivedAt: formatDate(p.receivedAt ?? p.createdAt), reference: (p.metadata as { reference?: string } | null)?.reference ?? null }))}
        />
        {balance > 0 && inv.status !== "VOID" && (
          <div className="rounded-lg border bg-white p-5 text-sm shadow-sm">
            <div className="font-medium">How to pay</div>
            <p className="mt-1 whitespace-pre-wrap text-neutral-700">{settings.paymentInstructions?.trim() || `Please pay ${formatCents(balance, inv.currency)} by bank transfer using ${inv.number} as the reference, or contact ${b.name}${b.phone ? ` on ${b.phone}` : ""} to arrange payment.`}</p>
          </div>
        )}
        <p className="text-center text-xs text-neutral-400">Powered by TRADE ONE</p>
      </div>
    </div>
  );
}
