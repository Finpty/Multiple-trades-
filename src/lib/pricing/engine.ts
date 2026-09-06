import type { PricingItem, PricingRule } from "@prisma/client";
import { evaluateConditions, type ConditionGroup } from "@/lib/rules/conditions";
import { asArray, asObject } from "@/lib/json";

/**
 * Generic pricing engine.
 *
 * Inputs: pricing items (rates/fees/multipliers/percents keyed per business),
 * ordered rules (conditions → actions), and a set of calculator inputs.
 *
 * The engine builds a variable bag, applies rules in priority order, then
 * assembles line items. Everything is data; the same engine prices a tiler,
 * a plumber or a trade that does not exist yet.
 *
 * Action types (edited in the admin UI):
 *   set_variable        { variable, value }                          variable = value
 *   set_from_item       { variable, pricingItemKey }                 variable = item.amount
 *   multiply_variable   { variable, factor? | pricingItemKey }       variable *= factor
 *   add_to_variable     { variable, amount? | pricingItemKey }       variable += amount
 *   add_line_item       { description, quantity? | inputKey?, pricingItemKey? | unitCents?, unit? }
 *   add_fee             { description, pricingItemKey? | amountCents? }
 *   add_percent         { description, percent? | pricingItemKey?, of?: "subtotal"|"labour"|"materials" }
 *   set_minimum         { pricingItemKey? | amountCents? }
 */
export type PricingAction =
  | { type: "set_variable"; variable: string; value: number }
  | { type: "set_from_item"; variable: string; pricingItemKey: string }
  | { type: "multiply_variable"; variable: string; factor?: number; pricingItemKey?: string }
  | { type: "add_to_variable"; variable: string; amount?: number; pricingItemKey?: string }
  | { type: "add_line_item"; description: string; quantity?: number; inputKey?: string; pricingItemKey?: string; unitCents?: number; unit?: string; category?: string }
  | { type: "add_fee"; description: string; pricingItemKey?: string; amountCents?: number }
  | { type: "add_percent"; description: string; percent?: number; pricingItemKey?: string; of?: "subtotal" | "labour" | "materials" }
  | { type: "set_minimum"; pricingItemKey?: string; amountCents?: number };

export const PRICING_ACTION_TYPES: Array<{ type: PricingAction["type"]; label: string; description: string }> = [
  { type: "add_line_item", label: "Add line item", description: "Quantity (from an input) × rate (from a pricing item)." },
  { type: "add_fee", label: "Add fee", description: "Fixed fee from a pricing item or amount." },
  { type: "add_percent", label: "Add percentage", description: "Percentage of the subtotal, labour or materials." },
  { type: "multiply_variable", label: "Multiply variable", description: "Scale a variable (e.g. labour) by a multiplier item." },
  { type: "add_to_variable", label: "Add to variable", description: "Increase a variable by an amount." },
  { type: "set_variable", label: "Set variable", description: "Set a variable to a fixed value." },
  { type: "set_from_item", label: "Set variable from item", description: "Copy a pricing item amount into a variable." },
  { type: "set_minimum", label: "Set minimum charge", description: "Raise the subtotal to a minimum." },
];

export interface PricingLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitCents: number;
  totalCents: number;
  category?: string;
  pricingItemKey?: string;
}

export interface PricingResult {
  lineItems: PricingLineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  variables: Record<string, number>;
  appliedRules: Array<{ id: string; name: string }>;
  trace: string[];
}

export interface PricingContext {
  inputs: Record<string, unknown>;
  serviceId?: string | null;
  serviceSlug?: string | null;
  taxRate: number; // percent
  taxInclusive: boolean;
}

function itemAmount(items: Map<string, PricingItem>, key: string | undefined): number | null {
  if (!key) return null;
  const item = items.get(key);
  return item ? Number(item.amount) : null;
}

function inputNumber(inputs: Record<string, unknown>, key: string | undefined): number {
  if (!key) return 1;
  const v = inputs[key];
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "") return Number(v) || 0;
  return 0;
}

export function calculatePrice(items: PricingItem[], rules: PricingRule[], ctx: PricingContext): PricingResult {
  const itemMap = new Map(items.filter((i) => i.isActive && !i.deletedAt).map((i) => [i.key, i]));
  const variables: Record<string, number> = { labour: 0, materials: 0, fees: 0 };
  const lineItems: PricingLineItem[] = [];
  const trace: string[] = [];
  const appliedRules: Array<{ id: string; name: string }> = [];
  let minimumCents = 0;

  const conditionContext = { inputs: ctx.inputs, service: { id: ctx.serviceId ?? null, slug: ctx.serviceSlug ?? null }, variables };
  const applicable = rules
    .filter((r) => r.isActive && !r.deletedAt && (!r.serviceId || r.serviceId === ctx.serviceId))
    .sort((a, b) => a.priority - b.priority);

  const subtotal = () => lineItems.reduce((s, l) => s + l.totalCents, 0);
  const categoryTotal = (cat: string) => lineItems.filter((l) => l.category === cat).reduce((s, l) => s + l.totalCents, 0);

  for (const rule of applicable) {
    if (!evaluateConditions(asObject<ConditionGroup>(rule.conditions), conditionContext as unknown as Record<string, unknown>)) continue;
    appliedRules.push({ id: rule.id, name: rule.name });
    for (const action of asArray<PricingAction>(rule.actions)) {
      switch (action.type) {
        case "set_variable":
          variables[action.variable] = action.value;
          trace.push(`${rule.name}: ${action.variable} = ${action.value}`);
          break;
        case "set_from_item": {
          const amt = itemAmount(itemMap, action.pricingItemKey);
          if (amt !== null) variables[action.variable] = amt;
          trace.push(`${rule.name}: ${action.variable} = item(${action.pricingItemKey}) = ${amt}`);
          break;
        }
        case "multiply_variable": {
          const factor = action.factor ?? itemAmount(itemMap, action.pricingItemKey) ?? 1;
          variables[action.variable] = (variables[action.variable] ?? 0) * factor;
          for (const l of lineItems) if (l.category === action.variable) { l.unitCents = Math.round(l.unitCents * factor); l.totalCents = Math.round(l.quantity * l.unitCents); }
          trace.push(`${rule.name}: ${action.variable} ×${factor}`);
          break;
        }
        case "add_to_variable": {
          const amt = action.amount ?? itemAmount(itemMap, action.pricingItemKey) ?? 0;
          variables[action.variable] = (variables[action.variable] ?? 0) + amt;
          trace.push(`${rule.name}: ${action.variable} += ${amt}`);
          break;
        }
        case "add_line_item": {
          const quantity = action.quantity ?? inputNumber(ctx.inputs, action.inputKey);
          if (quantity <= 0) break;
          const rate = action.unitCents ?? Math.round((itemAmount(itemMap, action.pricingItemKey) ?? 0) * 100);
          const item = action.pricingItemKey ? itemMap.get(action.pricingItemKey) : undefined;
          const category = action.category ?? item?.category ?? "labour";
          const line: PricingLineItem = { description: action.description, quantity, unit: action.unit ?? item?.unit ?? undefined, unitCents: rate, totalCents: Math.round(quantity * rate), category, pricingItemKey: action.pricingItemKey };
          lineItems.push(line);
          variables[category] = (variables[category] ?? 0) + line.totalCents / 100;
          trace.push(`${rule.name}: + ${quantity} × ${rate / 100} (${action.description})`);
          break;
        }
        case "add_fee": {
          const cents = action.amountCents ?? Math.round((itemAmount(itemMap, action.pricingItemKey) ?? 0) * 100);
          if (cents <= 0) break;
          lineItems.push({ description: action.description, quantity: 1, unitCents: cents, totalCents: cents, category: "fees", pricingItemKey: action.pricingItemKey });
          variables.fees = (variables.fees ?? 0) + cents / 100;
          trace.push(`${rule.name}: fee ${cents / 100} (${action.description})`);
          break;
        }
        case "add_percent": {
          const percent = action.percent ?? itemAmount(itemMap, action.pricingItemKey) ?? 0;
          const base = action.of === "labour" ? categoryTotal("labour") : action.of === "materials" ? categoryTotal("materials") : subtotal();
          const cents = Math.round((base * percent) / 100);
          if (cents === 0) break;
          lineItems.push({ description: action.description, quantity: 1, unitCents: cents, totalCents: cents, category: "adjustments", pricingItemKey: action.pricingItemKey });
          trace.push(`${rule.name}: ${percent}% of ${action.of ?? "subtotal"} = ${cents / 100}`);
          break;
        }
        case "set_minimum": {
          const cents = action.amountCents ?? Math.round((itemAmount(itemMap, action.pricingItemKey) ?? 0) * 100);
          minimumCents = Math.max(minimumCents, cents);
          trace.push(`${rule.name}: minimum ${cents / 100}`);
          break;
        }
      }
    }
  }

  let subtotalCents = subtotal();
  if (minimumCents > subtotalCents && subtotalCents > 0) {
    lineItems.push({ description: "Minimum charge adjustment", quantity: 1, unitCents: minimumCents - subtotalCents, totalCents: minimumCents - subtotalCents, category: "fees" });
    subtotalCents = minimumCents;
  }
  const taxCents = ctx.taxInclusive ? Math.round(subtotalCents - subtotalCents / (1 + ctx.taxRate / 100)) : Math.round((subtotalCents * ctx.taxRate) / 100);
  const totalCents = ctx.taxInclusive ? subtotalCents : subtotalCents + taxCents;
  return { lineItems, subtotalCents, taxCents, totalCents, variables, appliedRules, trace };
}

/**
 * Default rules derived from a business's pricing items when no explicit
 * rules exist yet: one line item per RATE keyed to an input of the same name
 * pattern (`<key>` or `area_sqm` for per-m² rates). Lets the calculator work
 * immediately after business creation; the admin can replace them any time.
 */
export function implicitRulesFromItems(items: PricingItem[]): Array<Pick<PricingRule, "id" | "name" | "priority" | "conditions" | "actions" | "isActive" | "deletedAt" | "serviceId">> {
  const rules: Array<Pick<PricingRule, "id" | "name" | "priority" | "conditions" | "actions" | "isActive" | "deletedAt" | "serviceId">> = [];
  for (const item of items) {
    if (!item.isActive || item.deletedAt) continue;
    if (item.type === "RATE" && item.unit) {
      const inputKey = item.unit === "m²" || item.unit === "sqm" ? "area_sqm" : item.unit === "hour" ? "hours" : item.unit === "day" ? "days" : item.unit === "lm" ? "length_lm" : item.unit === "point" ? "points" : item.key;
      const conditions = item.key.includes("demolition") ? { match: "all", rules: [{ field: "inputs.demolition", operator: "is_true" }] } : item.key.includes("waterproof") ? { match: "all", rules: [{ field: "inputs.waterproofing", operator: "is_true" }] } : item.key.includes("preparation") ? { match: "all", rules: [{ field: "inputs.preparation", operator: "is_true" }] } : {};
      rules.push({ id: `implicit:${item.key}`, name: item.label, priority: 100 + item.sortOrder, conditions, actions: [{ type: "add_line_item", description: item.label, inputKey, pricingItemKey: item.key, unit: item.unit, category: item.category ?? "labour" }], isActive: true, deletedAt: null, serviceId: null });
    }
    if (item.type === "FEE" && item.key === "minimum_charge") {
      rules.push({ id: `implicit:${item.key}`, name: item.label, priority: 900, conditions: {}, actions: [{ type: "set_minimum", pricingItemKey: item.key }], isActive: true, deletedAt: null, serviceId: null });
    }
  }
  return rules;
}
