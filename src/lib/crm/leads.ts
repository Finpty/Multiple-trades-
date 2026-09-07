import { z } from "zod";
import type { LeadStatus, Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { toJson } from "@/lib/json";

/** Lead helpers: statuses, input schema, list filters and contact extraction from submission data. */

export const LEAD_STATUSES: Array<{ value: LeadStatus; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "QUOTED", label: "Quoted" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "ARCHIVED", label: "Archived" },
];

export const BOARD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"];

export const LEAD_SOURCES = ["manual", "phone", "email", "referral", "website", "social", "walk_in", "other"] as const;

export function leadStatusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export const LeadInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(5000).optional(),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  source: z.string().trim().max(120).optional(),
  locationText: z.string().trim().max(300).optional(),
  valueDollars: z.number().min(0).max(100_000_000).optional(),
  assignedToUserId: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST", "ARCHIVED"]).default("NEW"),
});
export type LeadInput = z.infer<typeof LeadInputSchema>;

export function toLeadData(businessId: string, input: LeadInput): Prisma.LeadUncheckedCreateInput {
  return {
    businessId,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    message: input.message || null,
    serviceId: input.serviceId || null,
    source: input.source || "manual",
    locationText: input.locationText || null,
    valueCents: input.valueDollars !== undefined ? Math.round(input.valueDollars * 100) : null,
    assignedToUserId: input.assignedToUserId || null,
    status: input.status,
    data: toJson({}),
  };
}

export const LEAD_CONTACT_KEYS = { name: ["name", "full_name", "fullName", "first_name"], email: ["email"], phone: ["phone", "mobile"], message: ["message", "description", "details", "notes"] };

function pick(values: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = values[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Contact details from raw submission data using the same conventions as the public pipeline. */
export function pickContact(values: Record<string, unknown>): { name: string; email: string | null; phone: string | null; message: string | null; locationText: string | null } {
  const address = values.address;
  const locationText =
    typeof address === "string" ? address : address && typeof address === "object" ? Object.values(address as Record<string, string>).filter(Boolean).join(", ") || null : pick(values, ["suburb", "location"]);
  return { name: pick(values, LEAD_CONTACT_KEYS.name) ?? "Website enquiry", email: pick(values, LEAD_CONTACT_KEYS.email)?.toLowerCase() ?? null, phone: pick(values, LEAD_CONTACT_KEYS.phone), message: pick(values, LEAD_CONTACT_KEYS.message), locationText };
}

export interface LeadListFilter {
  q?: string;
  status?: string;
  assigned?: string;
  source?: string;
  serviceId?: string;
  from?: string;
  to?: string;
}

export function leadWhere(businessId: string, f: LeadListFilter): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { businessId, deletedAt: null };
  if (f.status && f.status !== "all") where.status = f.status as LeadStatus;
  else if (!f.status) where.status = { not: "ARCHIVED" };
  if (f.assigned === "unassigned") where.assignedToUserId = null;
  else if (f.assigned) where.assignedToUserId = f.assigned;
  if (f.source) where.source = f.source.startsWith("website") ? { startsWith: "website" } : f.source;
  if (f.serviceId) where.serviceId = f.serviceId;
  if (f.from || f.to) where.createdAt = { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59`) } : {}) };
  if (f.q) {
    const q = f.q.trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }];
  }
  return where;
}

export async function listLeads(db: TenantDb, businessId: string, filter: LeadListFilter) {
  return db.lead.findMany({
    where: leadWhere(businessId, filter),
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    include: { service: { select: { id: true, name: true } }, customer: { select: { id: true, firstName: true, lastName: true } } },
  });
}

/** Distinct sources used by this business's leads (for the filter dropdown). */
export async function leadSources(db: TenantDb, businessId: string): Promise<string[]> {
  const rows = await db.lead.findMany({ where: { businessId, deletedAt: null, source: { not: null } }, select: { source: true }, distinct: ["source"] });
  const set = new Set<string>();
  for (const r of rows) if (r.source) set.add(r.source.startsWith("website") ? "website" : r.source);
  return Array.from(set).sort();
}

export function formatMoney(cents: number | null | undefined, currency = "AUD", locale = "en-AU"): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
