import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Invoice, InvoiceStatus, Payment, Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { platformDb, tenantDb, withTenantTransaction } from "@/lib/db";
import { emitEvent, flushEvents } from "@/lib/events";
import { asArray, toJson } from "@/lib/json";
import { recordAudit } from "@/lib/audit";
import { nextNumber } from "./jobs";

/**
 * Marks SENT invoices past their due date as OVERDUE and emits invoice.overdue
 * once per invoice per day (idempotent). Called by the cron runner.
 */
export async function markOverdueInvoices(): Promise<{ marked: number; reminded: number }> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = await platformDb.invoice.findMany({ where: { status: { in: ["SENT", "OVERDUE"] }, dueAt: { lt: today }, deletedAt: null }, select: { id: true, businessId: true, status: true, dueAt: true } });
  let marked = 0;
  let reminded = 0;
  for (const inv of due) {
    const daysOverdue = Math.max(1, Math.floor((today.getTime() - (inv.dueAt?.getTime() ?? today.getTime())) / 86_400_000));
    if (inv.status === "SENT") {
      await tenantDb(inv.businessId).invoice.update({ where: { id: inv.id }, data: { status: "OVERDUE" } });
      marked++;
    }
    // One reminder event per day: skip if an invoice.overdue event exists today for this invoice.
    const already = await platformDb.domainEvent.findFirst({ where: { businessId: inv.businessId, type: "invoice.overdue", createdAt: { gte: today }, payload: { path: ["invoiceId"], equals: inv.id } }, select: { id: true } });
    if (!already) {
      await emitEvent({ type: "invoice.overdue", businessId: inv.businessId, payload: { businessId: inv.businessId, invoiceId: inv.id, daysOverdue } });
      reminded++;
    }
  }
  return { marked, reminded };
}

// ── Line items & totals ──────────────────────────────────────────────────────

export const LineItemSchema = z.object({
  id: z.string().max(60).optional(),
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().max(30).optional(),
  unitCents: z.coerce.number().int().min(0).default(0),
  pricingItemKey: z.string().max(80).optional(),
});
export type InvoiceLineItem = z.infer<typeof LineItemSchema> & { totalCents: number };

export interface InvoiceTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

/** Computes totals the same way quotes do: tax-inclusive businesses back out tax from the line total. */
export function computeTotals(items: Array<{ quantity: number; unitCents: number }>, taxRate: number, taxInclusive: boolean): InvoiceTotals {
  const sum = items.reduce((acc, it) => acc + Math.round((Number(it.quantity) || 0) * (Number(it.unitCents) || 0)), 0);
  const rate = Number(taxRate) / 100;
  if (taxInclusive) {
    const tax = Math.round(sum - sum / (1 + rate));
    return { subtotalCents: sum - tax, taxCents: tax, totalCents: sum };
  }
  const tax = Math.round(sum * rate);
  return { subtotalCents: sum, taxCents: tax, totalCents: sum + tax };
}

export function normalizeLineItems(raw: unknown): InvoiceLineItem[] {
  const parsed = z.array(LineItemSchema).min(1, "Add at least one line item").parse(raw);
  return parsed.map((it, i) => ({ ...it, id: it.id || `li_${i + 1}`, unit: it.unit || undefined, totalCents: Math.round(it.quantity * it.unitCents) }));
}

export function lineItemsOf(row: Pick<Invoice, "lineItems">): InvoiceLineItem[] {
  return asArray<Partial<InvoiceLineItem>>(row.lineItems).map((it, i) => ({
    id: it.id ?? `li_${i + 1}`,
    description: String(it.description ?? ""),
    quantity: Number(it.quantity ?? 1),
    unit: it.unit,
    unitCents: Number(it.unitCents ?? 0),
    pricingItemKey: it.pricingItemKey,
    totalCents: Number(it.totalCents ?? Math.round(Number(it.quantity ?? 1) * Number(it.unitCents ?? 0))),
  }));
}

export const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"];
export const PAYMENT_METHODS = ["bank_transfer", "cash", "card", "cheque", "other"] as const;

export const InvoiceInputSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  jobId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  notes: z.string().max(5000).optional(),
  lineItems: z.unknown(),
});
export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;

export const PaymentInputSchema = z.object({
  amountCents: z.coerce.number().int().min(1, "Amount must be greater than zero"),
  method: z.enum(PAYMENT_METHODS).default("bank_transfer"),
  receivedAt: z.coerce.date(),
  reference: z.string().max(120).optional(),
});
export type PaymentInput = z.infer<typeof PaymentInputSchema>;

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export const invoiceInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, address: true } },
  job: { select: { id: true, number: true, title: true } },
  quote: { select: { id: true, number: true, title: true } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.InvoiceInclude;
export type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export interface InvoiceListFilter {
  status?: string;
  customerId?: string;
  jobId?: string;
  q?: string;
}

export async function listInvoices(db: TenantDb, businessId: string, f: InvoiceListFilter = {}): Promise<InvoiceRow[]> {
  const where: Prisma.InvoiceWhereInput = { businessId, deletedAt: null };
  if (f.status && INVOICE_STATUSES.includes(f.status as InvoiceStatus)) where.status = f.status as InvoiceStatus;
  if (f.customerId) where.customerId = f.customerId;
  if (f.jobId) where.jobId = f.jobId;
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] } },
    ];
  }
  return db.invoice.findMany({ where, include: invoiceInclude, orderBy: { createdAt: "desc" }, take: 500 });
}

/** Line items to pre-fill a new invoice: from the quote when given, else the job's quote, else the job value. */
export async function prefillLineItems(db: TenantDb, businessId: string, opts: { quoteId?: string | null; jobId?: string | null }): Promise<{ lineItems: InvoiceLineItem[]; customerId: string | null; quoteId: string | null; jobId: string | null; notes: string | null }> {
  const job = opts.jobId ? await db.job.findFirst({ where: { id: opts.jobId, businessId, deletedAt: null } }) : null;
  const quoteId = opts.quoteId ?? job?.quoteId ?? null;
  const quote = quoteId ? await db.quote.findFirst({ where: { id: quoteId, businessId, deletedAt: null } }) : null;
  if (quote) {
    return { lineItems: lineItemsOf({ lineItems: quote.lineItems }), customerId: quote.customerId ?? job?.customerId ?? null, quoteId: quote.id, jobId: job?.id ?? null, notes: quote.notes };
  }
  if (job) {
    const items: InvoiceLineItem[] = job.valueCents ? [{ id: "li_1", description: `${job.number} — ${job.title}`, quantity: 1, unit: "job", unitCents: job.valueCents, totalCents: job.valueCents }] : [];
    return { lineItems: items, customerId: job.customerId, quoteId: null, jobId: job.id, notes: null };
  }
  return { lineItems: [], customerId: null, quoteId: null, jobId: null, notes: null };
}

async function assertInvoiceRefs(db: TenantDb, businessId: string, input: InvoiceInput) {
  if (input.customerId && !(await db.customer.findFirst({ where: { id: input.customerId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Customer not found.");
  if (input.jobId && !(await db.job.findFirst({ where: { id: input.jobId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Job not found.");
  if (input.quoteId && !(await db.quote.findFirst({ where: { id: input.quoteId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Quote not found.");
}

async function businessTax(businessId: string) {
  const b = await platformDb.business.findUniqueOrThrow({ where: { id: businessId }, select: { taxRate: true, taxInclusive: true, currency: true } });
  return { taxRate: Number(b.taxRate), taxInclusive: b.taxInclusive, currency: b.currency };
}

export async function createInvoice(businessId: string, input: InvoiceInput, ctx: { actorUserId: string | null }): Promise<Invoice> {
  const db = tenantDb(businessId);
  await assertInvoiceRefs(db, businessId, input);
  const lineItems = normalizeLineItems(input.lineItems);
  const tax = await businessTax(businessId);
  const totals = computeTotals(lineItems, tax.taxRate, tax.taxInclusive);
  const count = await db.invoice.count({ where: { businessId } });
  const eventIds: string[] = [];
  const invoice = await withTenantTransaction(businessId, async (tx) => {
    const created = await tx.invoice.create({
      data: {
        businessId,
        number: await nextNumber(businessId, "INV", count),
        customerId: input.customerId ?? null,
        jobId: input.jobId ?? null,
        quoteId: input.quoteId ?? null,
        currency: tax.currency,
        lineItems: toJson(lineItems),
        ...totals,
        dueAt: input.dueAt ?? null,
        notes: input.notes || null,
        publicToken: newToken(),
      },
    });
    eventIds.push(await emitEvent({ type: "invoice.created", businessId, payload: { businessId, invoiceId: created.id, totalCents: created.totalCents }, actorUserId: ctx.actorUserId }, tx));
    return created;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "invoice.created", entityType: "invoice", entityId: invoice.id, after: { number: invoice.number, totalCents: invoice.totalCents } });
  await flushEvents(eventIds);
  return invoice;
}

export async function updateInvoice(businessId: string, invoiceId: string, input: InvoiceInput, ctx: { actorUserId: string | null }): Promise<Invoice> {
  const db = tenantDb(businessId);
  const existing = await db.invoice.findFirst({ where: { id: invoiceId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Invoice not found.");
  if (existing.status !== "DRAFT") throw new Error("Only draft invoices can be edited. Void it and duplicate instead.");
  await assertInvoiceRefs(db, businessId, input);
  const lineItems = normalizeLineItems(input.lineItems);
  const tax = await businessTax(businessId);
  const totals = computeTotals(lineItems, tax.taxRate, tax.taxInclusive);
  const invoice = await db.invoice.update({
    where: { id: invoiceId },
    data: { customerId: input.customerId ?? null, jobId: input.jobId ?? null, quoteId: input.quoteId ?? null, lineItems: toJson(lineItems), ...totals, dueAt: input.dueAt ?? null, notes: input.notes || null },
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "invoice.updated", entityType: "invoice", entityId: invoiceId, before: { totalCents: existing.totalCents }, after: { totalCents: invoice.totalCents } });
  return invoice;
}

export async function sendInvoice(businessId: string, invoiceId: string, ctx: { actorUserId: string | null; publicUrl: string }): Promise<{ invoice: Invoice; emailed: boolean; to: string | null }> {
  const db = tenantDb(businessId);
  const existing = await db.invoice.findFirst({ where: { id: invoiceId, businessId, deletedAt: null }, include: { customer: true } });
  if (!existing) throw new Error("Invoice not found.");
  if (existing.status === "VOID" || existing.status === "PAID") throw new Error(`A ${existing.status.toLowerCase()} invoice cannot be sent.`);
  if (lineItemsOf(existing).length === 0) throw new Error("Add at least one line item before sending.");
  const business = await platformDb.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, email: true, phone: true } });
  const to = existing.customer?.email ?? null;
  let emailed = false;
  if (to) {
    try {
      const { sendMail } = await import("@/lib/mail");
      await sendMail({
        to,
        subject: `Invoice ${existing.number} from ${business.name}`,
        text: `Hi ${existing.customer?.firstName ?? ""},\n\nYour invoice ${existing.number} for ${(existing.totalCents / 100).toFixed(2)} ${existing.currency} is ready.\nView and pay online: ${ctx.publicUrl}\n\n${business.name}${business.phone ? ` · ${business.phone}` : ""}`,
      });
      emailed = true;
    } catch (e) {
      console.error("[invoices] email failed", e);
    }
    await db.message.create({ data: { businessId, customerId: existing.customerId, channel: "EMAIL", direction: "OUTBOUND", subject: `Invoice ${existing.number}`, body: `Invoice ${existing.number} sent. ${ctx.publicUrl}`, toAddress: to, status: emailed ? "sent" : "failed", metadata: { invoiceId }, sentAt: new Date() } });
  }
  const eventIds: string[] = [];
  const invoice = await withTenantTransaction(businessId, async (tx) => {
    const u = await tx.invoice.update({ where: { id: invoiceId }, data: { status: existing.status === "OVERDUE" ? "OVERDUE" : "SENT", sentAt: new Date() } });
    eventIds.push(await emitEvent({ type: "invoice.sent", businessId, payload: { businessId, invoiceId }, actorUserId: ctx.actorUserId }, tx));
    return u;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "invoice.sent", entityType: "invoice", entityId: invoiceId, metadata: { to, emailed } });
  await flushEvents(eventIds);
  return { invoice, emailed, to };
}

export async function recordPayment(businessId: string, invoiceId: string, input: PaymentInput, ctx: { actorUserId: string | null }): Promise<{ invoice: Invoice; payment: Payment }> {
  const db = tenantDb(businessId);
  const existing = await db.invoice.findFirst({ where: { id: invoiceId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Invoice not found.");
  if (existing.status === "VOID") throw new Error("This invoice is void.");
  const eventIds: string[] = [];
  const result = await withTenantTransaction(businessId, async (tx) => {
    const payment = await tx.payment.create({
      data: { businessId, invoiceId, customerId: existing.customerId, amountCents: input.amountCents, currency: existing.currency, status: "SUCCEEDED", provider: "manual", method: input.method, receivedAt: input.receivedAt, metadata: toJson({ reference: input.reference ?? null, recordedByUserId: ctx.actorUserId }) },
    });
    const paidCents = existing.paidCents + input.amountCents;
    const paid = paidCents >= existing.totalCents;
    const invoice = await tx.invoice.update({ where: { id: invoiceId }, data: { paidCents, ...(paid ? { status: "PAID", paidAt: new Date() } : {}) } });
    eventIds.push(await emitEvent({ type: "payment.received", businessId, payload: { businessId, paymentId: payment.id, invoiceId, amountCents: input.amountCents }, actorUserId: ctx.actorUserId }, tx));
    return { invoice, payment };
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "payment.recorded", entityType: "invoice", entityId: invoiceId, after: { amountCents: input.amountCents, method: input.method, paidCents: result.invoice.paidCents, status: result.invoice.status } });
  await flushEvents(eventIds);
  return result;
}

export async function voidInvoice(businessId: string, invoiceId: string, ctx: { actorUserId: string | null }): Promise<Invoice> {
  const db = tenantDb(businessId);
  const existing = await db.invoice.findFirst({ where: { id: invoiceId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Invoice not found.");
  if (existing.status === "PAID") throw new Error("A paid invoice cannot be voided.");
  const invoice = await db.invoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "invoice.voided", entityType: "invoice", entityId: invoiceId, before: { status: existing.status } });
  return invoice;
}

export async function duplicateInvoice(businessId: string, invoiceId: string, ctx: { actorUserId: string | null }): Promise<Invoice> {
  const db = tenantDb(businessId);
  const source = await db.invoice.findFirst({ where: { id: invoiceId, businessId, deletedAt: null } });
  if (!source) throw new Error("Invoice not found.");
  return createInvoice(businessId, { customerId: source.customerId, jobId: source.jobId, quoteId: source.quoteId, dueAt: null, notes: source.notes ?? undefined, lineItems: lineItemsOf(source) }, ctx);
}

export async function archiveInvoice(businessId: string, invoiceId: string, ctx: { actorUserId: string | null }): Promise<void> {
  const db = tenantDb(businessId);
  const existing = await db.invoice.findFirst({ where: { id: invoiceId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Invoice not found.");
  if (existing.status !== "DRAFT" && existing.status !== "VOID") throw new Error("Only draft or void invoices can be archived.");
  await db.invoice.update({ where: { id: invoiceId }, data: { deletedAt: new Date() } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "invoice.archived", entityType: "invoice", entityId: invoiceId });
}

export function balanceCents(inv: Pick<Invoice, "totalCents" | "paidCents">): number {
  return Math.max(0, inv.totalCents - inv.paidCents);
}

/** Public invoice lookup by token (platform host page). Bypasses RLS on purpose — the token is the credential. */
export async function loadPublicInvoice(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const invoice = await platformDb.invoice.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: { ...invoiceInclude, payments: { where: { status: "SUCCEEDED" }, orderBy: { receivedAt: "desc" } }, business: { include: { theme: true, features: { where: { featureKey: "payments" } }, integrations: { where: { isEnabled: true } }, locations: { where: { isPrimary: true }, take: 1 } } } },
  });
  return invoice;
}
