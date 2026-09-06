import type { Business } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { coerceFieldValues, listFieldDefinitions } from "@/lib/custom-fields";
import { calculatePrice, implicitRulesFromItems } from "@/lib/pricing/engine";
import type { PricingRule } from "@prisma/client";
import { asObject } from "@/lib/json";
import type { SiteEstimateResponse } from "@/lib/site/public-api";

const DEFAULT_DISCLAIMER = "This instant estimate is a guide only. A formal quote follows a site visit and may differ.";

/** Runs the business pricing engine for the public calculator (no persistence). */
export async function estimateForBusiness(business: Business, serviceId: string | null, rawInputs: Record<string, unknown>): Promise<SiteEstimateResponse> {
  const db = tenantDb(business.id);
  const [items, rules, defs, service] = await Promise.all([
    db.pricingItem.findMany({ where: { businessId: business.id, isActive: true } }),
    db.pricingRule.findMany({ where: { businessId: business.id, isActive: true } }),
    listFieldDefinitions(db, business.id, "ESTIMATE"),
    serviceId ? db.service.findFirst({ where: { businessId: business.id, id: serviceId }, select: { id: true, slug: true } }) : Promise.resolve(null),
  ]);
  const { values } = coerceFieldValues(defs, rawInputs);
  // Pass through any extra numeric/boolean inputs the calculator sent (e.g. area_sqm when no ESTIMATE definition exists).
  for (const [k, v] of Object.entries(rawInputs)) if (!(k in values) && (typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length < 100))) values[k] = v;
  const effectiveRules = rules.length ? rules : (implicitRulesFromItems(items) as unknown as PricingRule[]);
  const result = calculatePrice(items, effectiveRules, { inputs: values, serviceId: service?.id ?? null, serviceSlug: service?.slug ?? null, taxRate: Number(business.taxRate), taxInclusive: business.taxInclusive });
  const settings = asObject<{ estimateDisclaimer?: string }>(business.settings);
  return {
    ok: true,
    currency: business.currency,
    lineItems: result.lineItems.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, unitCents: l.unitCents, totalCents: l.totalCents })),
    subtotalCents: result.subtotalCents,
    taxCents: result.taxCents,
    totalCents: result.totalCents,
    taxInclusive: business.taxInclusive,
    disclaimer: settings.estimateDisclaimer ?? DEFAULT_DISCLAIMER,
  };
}
