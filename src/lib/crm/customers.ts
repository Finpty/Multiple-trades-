import { z } from "zod";
import type { Customer, Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { asArray, asObject, toJson } from "@/lib/json";

/** Customer helpers: schemas, search, upsert by contact details and merge. */

export const CUSTOMER_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

export const AddressSchema = z.object({
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  suburb: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  postcode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(60).optional(),
});
export type Address = z.infer<typeof AddressSchema>;

export const CustomerInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(200).optional(),
  address: AddressSchema.default({}),
  notes: z.string().trim().max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  source: z.string().trim().max(120).optional(),
  status: z.enum(CUSTOMER_STATUSES).default("ACTIVE"),
});
export type CustomerInput = z.infer<typeof CustomerInputSchema>;

export function customerName(c: Pick<Customer, "firstName" | "lastName">): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

export function customerTags(c: Pick<Customer, "tags">): string[] {
  return asArray<string>(c.tags).filter((t) => typeof t === "string");
}

export function customerAddress(c: Pick<Customer, "address">): Address {
  return asObject<Address>(c.address);
}

export function addressLine(a: Address | null | undefined): string {
  if (!a) return "";
  return [a.line1, a.line2, a.suburb, a.state, a.postcode].filter(Boolean).join(", ");
}

export function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "Customer", lastName: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

export function toCustomerData(businessId: string, input: CustomerInput): Prisma.CustomerUncheckedCreateInput {
  return {
    businessId,
    firstName: input.firstName,
    lastName: input.lastName || null,
    email: input.email || null,
    phone: input.phone || null,
    company: input.company || null,
    address: toJson(input.address),
    notes: input.notes || null,
    tags: toJson(Array.from(new Set(input.tags))),
    source: input.source || null,
    status: input.status,
  };
}

export interface CustomerListFilter {
  q?: string;
  status?: string;
  tag?: string;
}

export async function listCustomers(db: TenantDb, businessId: string, filter: CustomerListFilter) {
  const where: Prisma.CustomerWhereInput = { businessId, deletedAt: null };
  where.status = filter.status === "ARCHIVED" ? "ARCHIVED" : filter.status === "all" ? undefined : "ACTIVE";
  if (filter.q) {
    const q = filter.q.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { company: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter.tag) where.tags = { array_contains: [filter.tag] };
  return db.customer.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: { _count: { select: { leads: true, quotes: true, jobs: true, invoices: true } } },
  });
}

/** Structural client type so both transaction clients and RLS-scoped clients are accepted. */
type CustomerWriter = {
  customer: {
    findFirst: (args: { where: Prisma.CustomerWhereInput; select: { id: true } }) => Promise<{ id: string } | null>;
    create: (args: { data: Prisma.CustomerUncheckedCreateInput; select: { id: true } }) => Promise<{ id: string }>;
  };
};

/** Finds a customer by email or phone, or creates one. Returns whether it was created. */
export async function upsertCustomerByContact(
  tx: CustomerWriter,
  businessId: string,
  input: { name: string; email?: string | null; phone?: string | null; source?: string | null; address?: Address | null },
): Promise<{ id: string; created: boolean }> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (email || phone) {
    const existing = await tx.customer.findFirst({ where: { businessId, deletedAt: null, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] }, select: { id: true } });
    if (existing) return { id: existing.id, created: false };
  }
  const { firstName, lastName } = splitName(input.name || "Customer");
  const created = await tx.customer.create({ data: { businessId, firstName, lastName, email, phone, source: input.source ?? null, address: toJson(input.address ?? {}) }, select: { id: true } });
  return { id: created.id, created: true };
}

/** Relinks every record from `mergeId` onto `keepId`, merges empty profile fields and archives the duplicate. */
export async function mergeCustomers(tx: Prisma.TransactionClient, businessId: string, keepId: string, mergeId: string): Promise<{ before: Customer; keep: Customer }> {
  const [keep, dup] = await Promise.all([tx.customer.findFirstOrThrow({ where: { id: keepId, businessId } }), tx.customer.findFirstOrThrow({ where: { id: mergeId, businessId } })]);
  const w = { where: { businessId, customerId: mergeId }, data: { customerId: keepId } };
  await Promise.all([tx.lead.updateMany(w), tx.quote.updateMany(w), tx.job.updateMany(w), tx.invoice.updateMany(w), tx.payment.updateMany(w), tx.booking.updateMany(w), tx.message.updateMany(w), tx.task.updateMany(w)]);
  const tags = Array.from(new Set([...customerTags(keep), ...customerTags(dup)]));
  const address = Object.keys(customerAddress(keep)).length ? keep.address : dup.address;
  const merged = await tx.customer.update({
    where: { id: keepId },
    data: {
      lastName: keep.lastName ?? dup.lastName,
      email: keep.email ?? dup.email,
      phone: keep.phone ?? dup.phone,
      company: keep.company ?? dup.company,
      address: toJson(asObject(address)),
      notes: [keep.notes, dup.notes].filter(Boolean).join("\n\n") || null,
      tags: toJson(tags),
      source: keep.source ?? dup.source,
    },
  });
  await tx.customer.update({ where: { id: mergeId }, data: { status: "ARCHIVED", deletedAt: new Date(), email: dup.email ? `merged+${dup.id}:${dup.email}` : null, phone: dup.phone ? `merged:${dup.phone}` : null } });
  return { before: dup, keep: merged };
}
