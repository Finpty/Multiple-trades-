import { z } from "zod";
import type { Customer } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { optStr, str } from "@/lib/actions";

export interface CustomerOption {
  id: string;
  label: string;
  email: string | null;
  phone: string | null;
}

export function customerName(c: Pick<Customer, "firstName" | "lastName" | "company"> | null | undefined): string {
  if (!c) return "—";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return c.company ? (name ? `${name} (${c.company})` : c.company) : name || "—";
}

export async function listCustomerOptions(db: TenantDb, businessId: string): Promise<CustomerOption[]> {
  const rows = await db.customer.findMany({
    where: { businessId, deletedAt: null, status: "ACTIVE" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true },
  });
  return rows.map((c) => ({ id: c.id, label: customerName(c), email: c.email, phone: c.phone }));
}

export const NewCustomerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email("Enter a valid email").max(200).optional(),
  phone: z.string().max(40).optional(),
});

/**
 * Resolves the customer chosen in a form: either an existing id (`customerId`)
 * or a brand-new record described by `newCustomer.*` fields when the select is
 * set to "__new". Returns null when no customer was chosen.
 */
export async function resolveCustomerFromForm(db: TenantDb, businessId: string, obj: Record<string, unknown>, actorUserId: string | null): Promise<string | null> {
  const chosen = str(obj.customerId);
  if (chosen === "__new") {
    const input = NewCustomerSchema.parse({
      firstName: str(obj["newCustomer.firstName"]),
      lastName: optStr(obj["newCustomer.lastName"]),
      email: optStr(obj["newCustomer.email"]),
      phone: optStr(obj["newCustomer.phone"]),
    });
    const created = await db.customer.create({
      data: { businessId, firstName: input.firstName, lastName: input.lastName ?? null, email: input.email ?? null, phone: input.phone ?? null, source: "admin" },
    });
    await recordAudit({ actorUserId, businessId, action: "customer.created", entityType: "customer", entityId: created.id, after: input });
    await emitEvent({ type: "customer.created", businessId, payload: { businessId, customerId: created.id }, actorUserId });
    return created.id;
  }
  if (!chosen) return null;
  if (!isUuid(chosen)) throw new Error("Invalid customer.");
  const exists = await db.customer.findFirst({ where: { id: chosen, businessId, deletedAt: null }, select: { id: true } });
  if (!exists) throw new Error("Customer not found.");
  return exists.id;
}
