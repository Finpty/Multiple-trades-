import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { platformDb } from "@/lib/db";
import { mediaUrls } from "@/lib/media/service";
import { asObject } from "@/lib/json";
import { formatCents } from "@/lib/money";
import { lineItemsOf, loadPublicQuote, markQuoteViewed } from "@/lib/operations/quotes";
import { DEFAULT_THEME_TOKENS, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";
import { fontStylesheetUrl, tokensToStyleString } from "@/lib/theme/css";
import { formatDate, formatDateTime } from "@/components/ui";
import { QuoteDocument } from "@/components/admin/operations/quotes/quote-document";
import { PublicQuoteResponse } from "./respond";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Customer-facing quote page on the platform host. The token is the credential; nothing else is required. */
export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await loadPublicQuote(token);
  if (!quote) notFound();
  if (quote.status === "SENT" || (quote.status === "VIEWED" && !quote.viewedAt)) await markQuoteViewed(quote.id, quote.businessId);
  const b = quote.business;
  const tokens = mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>(b.theme?.published ?? b.theme?.draft ?? null));
  const logo = b.logoMediaId ? await platformDb.media.findFirst({ where: { id: b.logoMediaId, businessId: b.id, deletedAt: null } }) : null;
  const logoUrl = logo ? (await mediaUrls(logo)).medium : null;
  const fonts = fontStylesheetUrl(tokens);
  const expired = quote.status === "EXPIRED" || (!!quote.validUntil && quote.validUntil < new Date() && ["SENT", "VIEWED"].includes(quote.status));
  const customer = quote.customer ? { name: [quote.customer.firstName, quote.customer.lastName].filter(Boolean).join(" "), company: quote.customer.company, email: quote.customer.email } : null;
  return (
    <div className="min-h-screen bg-neutral-100 py-8" style={{ cssText: tokensToStyleString(tokens) } as React.CSSProperties}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <div className="flex items-center justify-between text-sm text-neutral-600">
          <span>Quote from <strong>{b.name}</strong></span>
          <span>{quote.status === "ACCEPTED" ? "Accepted" : quote.status === "DECLINED" ? "Declined" : expired ? "Expired" : `Total ${formatCents(quote.totalCents, quote.currency)}`}</span>
        </div>
        <QuoteDocument
          number={quote.number} title={quote.title} status={quote.status} currency={quote.currency}
          lineItems={lineItemsOf(quote)} subtotalCents={quote.subtotalCents} taxCents={quote.taxCents} totalCents={quote.totalCents} depositCents={quote.depositCents}
          taxName={b.taxName} taxInclusive={b.taxInclusive} notes={quote.notes} terms={quote.terms}
          validUntil={quote.validUntil ? formatDate(quote.validUntil) : null} issuedOn={formatDate(quote.sentAt ?? quote.createdAt)}
          business={{ name: b.name, phone: b.phone, email: b.email, website: b.website, logoUrl }}
          customer={customer}
          acceptedByName={quote.acceptedByName} acceptedAt={quote.acceptedAt ? formatDateTime(quote.acceptedAt) : null}
        />
        <PublicQuoteResponse token={token} status={quote.status} expired={expired} businessName={b.name} businessPhone={b.phone} businessEmail={b.email} totalLabel={formatCents(quote.totalCents, quote.currency)} depositLabel={quote.depositCents > 0 ? formatCents(quote.depositCents, quote.currency) : null} />
        <p className="text-center text-xs text-neutral-400">Powered by TRADE ONE</p>
      </div>
    </div>
  );
}
