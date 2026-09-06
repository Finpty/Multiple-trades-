import type { BusinessLocation } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import type { SiteContext } from "@/lib/tenant/resolve";
import { formatAddress, normalizeOpeningHours, type OpeningHoursRow } from "./common";

export interface SiteLocation {
  id: string;
  name: string;
  addressLines: string[];
  addressQuery: string;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  hours: OpeningHoursRow[];
  isPrimary: boolean;
}

function toView(loc: BusinessLocation): SiteLocation {
  const lines = formatAddress(loc);
  return {
    id: loc.id,
    name: loc.name,
    addressLines: lines,
    addressQuery: [...lines, loc.country].filter(Boolean).join(", "),
    phone: loc.phone,
    email: loc.email,
    lat: loc.lat === null ? null : Number(loc.lat),
    lng: loc.lng === null ? null : Number(loc.lng),
    hours: normalizeOpeningHours(loc.openingHours),
    isPrimary: loc.isPrimary,
  };
}

/** Primary (else first active) location of the business. */
export async function loadPrimaryLocation(ctx: SiteContext): Promise<SiteLocation | null> {
  const db = tenantDb(ctx.business.id);
  const row = await db.businessLocation.findFirst({ where: { businessId: ctx.business.id, isActive: true }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] });
  return row ? toView(row) : null;
}

export async function loadLocations(ctx: SiteContext): Promise<SiteLocation[]> {
  const db = tenantDb(ctx.business.id);
  const rows = await db.businessLocation.findMany({ where: { businessId: ctx.business.id, isActive: true }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] });
  return rows.map(toView);
}
