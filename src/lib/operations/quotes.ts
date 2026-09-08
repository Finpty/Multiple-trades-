import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma, Quote, QuoteStatus } from "@prisma/client";
import { platformDb, tenantDb, withTenantTransaction, type TenantDb } from "@/lib/db";
import { emitEvent, flushEvents } from "@/lib/events";
import { asArray, asObject, toJson } from "@/lib/json";
import { recordAudit } from "@/lib/audit";
import { nextNumber } from "./jobs";
import { computeTotals, createInvoice, normalizeLineItems, type InvoiceLineItem } from "./invoices";

/**
 * Quotes: itemised offers built by hand, from the price list, or from the
 * pricing engine calculator. Sent quotes get a public token page (/q/<token>)
 * where the customer can accept (typed signature) or decline. Accepting emits
 * quote.accepted so automations can open a job/project, and the UI can create
 * the job or invoice directly.
 */

export const QUOTE_STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED", "ARCHIVED"];
export const EDITABLE_STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "VIEWED"];
export type QuoteLineItem = InvoiceLineItem;

export const QuoteInputSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Give the quote a title").max(200),
  lineItems: z.unknown(),
  notes: z.string().max(5000).optional(),
  terms: z.string().max(10_000).optional(),
  validUntil: z.coerce.date().nullable().optional(),
  depositPercent: z.coerce.number().min(0).max(100).default(0),
  inputs: z.record(z.unknown()).optional(),
  calculation: z.record(z.unknown()).optional(),
});
export type QuoteInput = z.infer<typeof QuoteInputSchema>;

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export const quoteInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, address: true } },
  lead: { select: { id: true, name: true, status: true } },
  jobs: { select: { id: true, number: true, title: true, status: true } },
  invoices: { where: { deletedAt: null }, select: { id: true, number: true, status: true, totalCents: true, paidCents: true } },
} satisfies Prisma.QuoteInclude;
export type QuoteRow = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

export interface QuoteListFilter {
  status?: string;
  customerId?: string;
  q?: string;
}

export async function listQuotes(db: TenantDb, businessId: string, f: QuoteListFilter = {}): Promise<QuoteRow[]> {
  const where: Prisma.QuoteWhereInput = { businessId, deletedAt: null };
  if (f.status === "open") where.status = { in: ["SENT", "VIEWED"] };
  else if (f.status && QUOTE_STATUSES.includes(f.status as QuoteStatus)) where.status = f.status as QuoteStatus;
  else if (!f.status) where.status = { not: "ARCHIVED" };
  if (f.customerId) where.customerId = f.customerId;
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] } },
    ];
  }
  return db.quote.findMany({ where, include: quoteInclude, orderBy: { createdAt: "desc" }, take: 500 });
}

export async function quoteStats(db: TenantDb, businessId: string): Promise<{ open: number; openCents: number; acceptedCents30d: number; acceptRate: number }> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [open, accepted, decided] = await Promise.all([
    db.quote.aggregate({ where: { businessId, deletedAt: null, status: { in: ["SENT", "VIEWED"] } }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.quote.aggregate({ where: { businessId, deletedAt: null, status: "ACCEPTED", acceptedAt: { gte: since } }, _sum: { totalCents: true } }),
    db.quote.groupBy({ by: ["status"], where: { businessId, deletedAt: null, status: { in: ["ACCEPTED", "DECLINED"] } }, _count: { _all: true } }),
  ]);
  const acc = decided.find((d) => d.status === "ACCEPTED")?._count._all ?? 0;
  const dec = decided.find((d) => d.status === "DECLINED")?._count._all ?? 0;
  return { open: open._count._all, openCents: open._sum.totalCents ?? 0, acceptedCents30d: accepted._sum.totalCents ?? 0, acceptRate: acc + dec ? Math.round((acc / (acc + dec)) * 100) : 0 };
}

export function lineItemsOf(row: Pick<Quote, "lineItems">): QuoteLineItem[] {
  return asArray<Partial<QuoteLineItem>>(row.lineItems).map((it, i) => ({
    id: it.id ?? `li_${i + 1}`,
    description: String(it.description ?? ""),
    quantity: Number(it.quantity ?? 1),
    unit: it.unit,
    unitCents: Number(it.unitCents ?? 0),
    pricingItemKey: it.pricingItemKey,
    totalCents: Number(it.totalCents ?? Math.round(Number(it.quantity ?? 1) * Number(it.unitCents ?? 0))),
  }));
}

async function businessTax(businessId: string) {
  const b = await platformDb.business.findUniqueOrThrow({ where: { id: businessId }, select: { taxRate: true, taxInclusive: true, currency: true, taxName: true } });
  return { taxRate: Number(b.taxRate), taxInclusive: b.taxInclusive, currency: b.currency, taxName: b.taxName };
}

async function assertRefs(db: TenantDb, businessId: string, input: Pick<QuoteInput, "customerId" | "leadId">) {
  if (input.customerId && !(await db.customer.findFirst({ where: { id: input.customerId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Customer not found.");
  if (input.leadId && !(await db.lead.findFirst({ where: { id: input.leadId, businessId }, select: { id: true } }))) throw new Error("Lead not found.");
}

function quoteData(input: QuoteInput, lineItems: QuoteLineItem[], totals: ReturnType<typeof computeTotals>) {
  return {
    customerId: input.customerId ?? null,
    leadId: input.leadId ?? null,
    title: input.title,
    lineItems: toJson(lineItems),
    inputs: toJson(input.inputs ?? {}),
    calculation: toJson({ ...(input.calculation ?? {}), depositPercent: input.depositPercent }),
    ...totals,
    depositCents: Math.round((totals.totalCents * input.depositPercent) / 100),
    notes: input.notes || null,
    terms: input.terms || null,
    validUntil: input.validUntil ?? null,
  };
}

export async function createQuote(businessId: string, input: QuoteInput, ctx: { actorUserId: string | null }): Promise<Quote> {
  const db = tenantDb(businessId);
  await assertRefs(db, businessId, input);
  const lineItems = normalizeLineItems(input.lineItems);
  const tax = await businessTax(businessId);
  const totals = computeTotals(lineItems, tax.taxRate, tax.taxInclusive);
  const count = await db.quote.count({ where: { businessId } });
  const eventIds: string[] = [];
  const quote = await withTenantTransaction(businessId, async (tx) => {
    const created = await tx.quote.create({ data: { businessId, number: await nextNumber(businessId, "QUO", count), currency: tax.currency, publicToken: newToken(), createdByUserId: ctx.actorUserId, ...quoteData(input, lineItems, totals) } });
    if (input.leadId) await tx.lead.updateMany({ where: { id: input.leadId, businessId }, data: { convertedQuoteId: created.id, status: "QUOTED", ...(created.customerId ? { customerId: created.customerId } : {}) } });
    eventIds.push(await emitEvent({ type: "quote.created", businessId, payload: { businessId, quoteId: created.id, customerId: created.customerId, totalCents: created.totalCents }, actorUserId: ctx.actorUserId }, tx));
    return created;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "quote.created", entityType: "quote", entityId: quote.id, after: { number: quote.number, title: quote.title, totalCents: quote.totalCents } });
  await flushEvents(eventIds);
  return quote;
}

export async function updateQuote(businessId: string, quoteId: string, input: QuoteInput, ctx: { actorUserId: string | null }): Promise<Quote> {
  const db = tenantDb(businessId);
  const existing = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Quote not found.");
  if (!EDITABLE_STATUSES.includes(existing.status)) throw new Error(`A ${existing.status.toLowerCase()} quote cannot be edited. Duplicate it instead.`);
  await assertRefs(db, businessId, input);
  const lineItems = normalizeLineItems(input.lineItems);
  const tax = await businessTax(businessId);
  const totals = computeTotals(lineItems, tax.taxRate, tax.taxInclusive);
  const quote = await db.quote.update({ where: { id: quoteId }, data: quoteData(input, lineItems, totals) });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "quote.updated", entityType: "quote", entityId: quoteId, before: { totalCents: existing.totalCents, title: existing.title }, after: { totalCents: quote.totalCents, title: quote.title } });
  return quote;
}

export async function sendQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null; publicUrl: string; message?: string }): Promise<{ quote: Quote; emailed: boolean; to: string | null }> {
  const db = tenantDb(businessId);
  const existing = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null }, include: { customer: true } });
  if (!existing) throw new Error("Quote not found.");
  if (!["DRAFT", "SENT", "VIEWED", "EXPIRED"].includes(existing.status)) throw new Error(`A ${existing.status.toLowerCase()} quote cannot be sent.`);
  if (lineItemsOf(existing).length === 0) throw new Error("Add at least one line item before sending.");
  const business = await platformDb.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, email: true, phone: true } });
  const to = existing.customer?.email ?? null;
  let emailed = false;
  if (to) {
    try {
      const { sendMail } = await import("@/lib/mail");
      const intro = ctx.message?.trim() ? `${ctx.message.trim()}\n\n` : "";
      await sendMail({
        to,
        subject: `Quote ${existing.number} from ${business.name}: ${existing.title}`,
        text: `Hi ${existing.customer?.firstName ?? ""},\n\n${intro}Your quote ${existing.number} for ${(existing.totalCents / 100).toFixed(2)} ${existing.currency} is ready.\nView and accept online: ${ctx.publicUrl}\n\n${business.name}${business.phone ? ` · ${business.phone}` : ""}${business.email ? ` · ${business.email}` : ""}`,
      });
      emailed = true;
    } catch (e) {
      console.error("[quotes] email failed", e);
    }
    await db.message.create({ data: { businessId, customerId: existing.customerId, leadId: existing.leadId, channel: "EMAIL", direction: "OUTBOUND", subject: `Quote ${existing.number}`, body: `Quote ${existing.number} sent to ${to}. ${ctx.publicUrl}`, metadata: { quoteId, emailed } } });
  }
  const eventIds: string[] = [];
  const quote = await withTenantTransaction(businessId, async (tx) => {
    const u = await tx.quote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: new Date() } });
    if (existing.leadId) await tx.lead.updateMany({ where: { id: existing.leadId, businessId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } }, data: { status: "QUOTED" } });
    eventIds.push(await emitEvent({ type: "quote.sent", businessId, payload: { businessId, quoteId }, actorUserId: ctx.actorUserId }, tx));
    return u;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "quote.sent", entityType: "quote", entityId: quoteId, metadata: { to, emailed } });
  await flushEvents(eventIds);
  return { quote, emailed, to };
}

export async function acceptQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null; acceptedByName: string; signature?: Record<string, unknown>; source: "public" | "admin" }): Promise<Quote> {
  const db = tenantDb(businessId);
  const existing = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Quote not found.");
  if (existing.status === "ACCEPTED") return existing;
  if (!["DRAFT", "SENT", "VIEWED", "EXPIRED"].includes(existing.status)) throw new Error(`A ${existing.status.toLowerCase()} quote cannot be accepted.`);
  const eventIds: string[] = [];
  const quote = await withTenantTransaction(businessId, async (tx) => {
    const u = await tx.quote.update({ where: { id: quoteId }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByName: ctx.acceptedByName, acceptedSignature: toJson({ ...(ctx.signature ?? {}), source: ctx.source, at: new Date().toISOString() }) } });
    if (existing.leadId) await tx.lead.updateMany({ where: { id: existing.leadId, businessId }, data: { status: "WON" } });
    await tx.message.create({ data: { businessId, customerId: existing.customerId, leadId: existing.leadId, channel: "SYSTEM", direction: "INTERNAL", subject: `Quote ${existing.number} accepted`, body: `Accepted by ${ctx.acceptedByName} (${ctx.source}).`, metadata: { quoteId } } });
    eventIds.push(await emitEvent({ type: "quote.accepted", businessId, payload: { businessId, quoteId, customerId: existing.customerId, totalCents: existing.totalCents }, actorUserId: ctx.actorUserId }, tx));
    return u;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "quote.accepted", entityType: "quote", entityId: quoteId, metadata: { acceptedByName: ctx.acceptedByName, source: ctx.source } });
  await flushEvents(eventIds);
  return quote;
}

export async function declineQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null; reason?: string; source: "public" | "admin" }): Promise<Quote> {
  const db = tenantDb(businessId);
  const existing = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Quote not found.");
  if (existing.status === "DECLINED") return existing;
  if (existing.status === "ACCEPTED" && ctx.source === "public") throw new Error("This quote has already been accepted.");
  const eventIds: string[] = [];
  const quote = await withTenantTransaction(businessId, async (tx) => {
    const u = await tx.quote.update({ where: { id: quoteId }, data: { status: "DECLINED", declinedAt: new Date() } });
    if (existing.leadId) await tx.lead.updateMany({ where: { id: existing.leadId, businessId, status: { not: "WON" } }, data: { status: "LOST" } });
    await tx.message.create({ data: { businessId, customerId: existing.customerId, leadId: existing.leadId, channel: "SYSTEM", direction: "INTERNAL", subject: `Quote ${existing.number} declined`, body: ctx.reason?.trim() ? `Declined (${ctx.source}): ${ctx.reason.trim()}` : `Declined (${ctx.source}).`, metadata: { quoteId } } });
    eventIds.push(await emitEvent({ type: "quote.declined", businessId, payload: { businessId, quoteId }, actorUserId: ctx.actorUserId }, tx));
    return u;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "quote.declined", entityType: "quote", entityId: quoteId, metadata: { reason: ctx.reason ?? null, source: ctx.source } });
  await flushEvents(eventIds);
  return quote;
}

export async function reopenQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null }): Promise<Quote> {
  const db = tenantDb(businessId);
  const existing = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Quote not found.");
  if (existing.status === "ACCEPTED") throw new Error("An accepted quote cannot be reopened. Duplicate it instead.");
  const quote = await db.quote.update({ where: { id: quoteId }, data: { status: existing.sentAt ? "SENT" : "DRAFT", declinedAt: null } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "quote.reopened", entityType: "quote", entityId: quoteId, before: { status: existing.status } });
  return quote;
}

export async function duplicateQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null }): Promise<Quote> {
  const db = tenantDb(businessId);
  const source = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } });
  if (!source) throw new Error("Quote not found.");
  const calc = asObject<{ depositPercent?: number }>(source.calculation);
  return createQuote(businessId, { customerId: source.customerId, leadId: null, title: source.title, lineItems: lineItemsOf(source), notes: source.notes ?? undefined, terms: source.terms ?? undefined, validUntil: null, depositPercent: Number(calc.depositPercent ?? 0), inputs: asObject<Record<string, unknown>>(source.inputs) }, ctx);
}

export async function archiveQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null }): Promise<void> {
  const db = tenantDb(businessId);
  const existing = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Quote not found.");
  await db.quote.update({ where: { id: quoteId }, data: { status: "ARCHIVED", deletedAt: new Date() } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "quote.archived", entityType: "quote", entityId: quoteId, before: { status: existing.status } });
}

/** Creates a DRAFT invoice carrying the quote's line items (deposit-only when requested). */
export async function createInvoiceFromQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null; depositOnly?: boolean; dueInDays?: number }) {
  const db = tenantDb(businessId);
  const quote = await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } });
  if (!quote) throw new Error("Quote not found.");
  const items = lineItemsOf(quote);
  const lineItems = ctx.depositOnly && quote.depositCents > 0
    ? [{ id: "deposit", description: `Deposit for quote ${quote.number} — ${quote.title}`, quantity: 1, unit: "deposit", unitCents: quote.depositCents }]
    : items.map((it) => ({ id: it.id, description: it.description, quantity: it.quantity, unit: it.unit, unitCents: it.unitCents, pricingItemKey: it.pricingItemKey }));
  const job = await db.job.findFirst({ where: { quoteId, businessId, deletedAt: null }, select: { id: true } });
  const dueAt = new Date(Date.now() + (ctx.dueInDays ?? 14) * 86_400_000);
  return createInvoice(businessId, { customerId: quote.customerId, quoteId: quote.id, jobId: job?.id ?? null, dueAt, notes: quote.notes ?? undefined, lineItems }, { actorUserId: ctx.actorUserId });
}

/** Marks SENT/VIEWED quotes past validUntil as EXPIRED. Idempotent; called by cron. */
export async function expireQuotes(): Promise<number> {
  const today = new Date();
  const rows = await platformDb.quote.findMany({ where: { status: { in: ["SENT", "VIEWED"] }, validUntil: { lt: today }, deletedAt: null }, select: { id: true, businessId: true } });
  for (const q of rows) await tenantDb(q.businessId).quote.update({ where: { id: q.id }, data: { status: "EXPIRED" } });
  return rows.length;
}

/** Public quote lookup by token. Bypasses RLS on purpose — the token is the credential. */
export async function loadPublicQuote(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return platformDb.quote.findFirst({
    where: { publicToken: token, deletedAt: null, status: { not: "ARCHIVED" } },
    include: { customer: { select: { firstName: true, lastName: true, company: true, email: true } }, business: { select: { id: true, name: true, slug: true, phone: true, email: true, website: true, taxName: true, taxInclusive: true, logoMediaId: true, theme: { select: { published: true, draft: true } }, settings: true } } },
  });
}

/** Records the first customer view of a sent quote (SENT → VIEWED). */
export async function markQuoteViewed(quoteId: string, businessId: string): Promise<void> {
  const db = tenantDb(businessId);
  const q = await db.quote.findFirst({ where: { id: quoteId, businessId }, select: { status: true, viewedAt: true } });
  if (!q) return;
  await db.quote.update({ where: { id: quoteId }, data: { viewedAt: q.viewedAt ?? new Date(), ...(q.status === "SENT" ? { status: "VIEWED" } : {}) } });
}

export function quoteDepositPercent(q: Pick<Quote, "calculation">): number {
  return Number(asObject<{ depositPercent?: number }>(q.calculation).depositPercent ?? 0);
}
