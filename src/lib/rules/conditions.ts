/**
 * Generic condition evaluator shared by the pricing engine and the automation
 * engine. Conditions are data, edited through the UI, never code.
 *
 *   { match: "all" | "any", rules: [{ field: "tile_size", operator: "gt", value: 1200 }] }
 */
export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false";

export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  match?: "all" | "any";
  rules?: Array<ConditionRule | ConditionGroup>;
}

export const CONDITION_OPERATORS: Array<{ value: ConditionOperator; label: string; needsValue: boolean }> = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "does not equal", needsValue: true },
  { value: "gt", label: "greater than", needsValue: true },
  { value: "gte", label: "greater than or equal", needsValue: true },
  { value: "lt", label: "less than", needsValue: true },
  { value: "lte", label: "less than or equal", needsValue: true },
  { value: "in", label: "is one of", needsValue: true },
  { value: "not_in", label: "is not one of", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is not empty", needsValue: false },
  { value: "is_true", label: "is true", needsValue: false },
  { value: "is_false", label: "is false", needsValue: false },
];

export function getPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, source);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return v === undefined || v === null ? [] : [v];
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na === nb;
  return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
}

export function evaluateRule(rule: ConditionRule, context: Record<string, unknown>): boolean {
  const actual = getPath(context, rule.field);
  switch (rule.operator) {
    case "eq":
      return looseEqual(actual, rule.value);
    case "neq":
      return !looseEqual(actual, rule.value);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = toNumber(actual);
      const b = toNumber(rule.value);
      if (a === null || b === null) return false;
      return rule.operator === "gt" ? a > b : rule.operator === "gte" ? a >= b : rule.operator === "lt" ? a < b : a <= b;
    }
    case "in":
      return toList(rule.value).some((v) => looseEqual(actual, v));
    case "not_in":
      return !toList(rule.value).some((v) => looseEqual(actual, v));
    case "contains":
      return Array.isArray(actual)
        ? actual.some((v) => looseEqual(v, rule.value))
        : String(actual ?? "").toLowerCase().includes(String(rule.value ?? "").toLowerCase());
    case "not_contains":
      return !evaluateRule({ ...rule, operator: "contains" }, context);
    case "is_empty":
      return actual === undefined || actual === null || actual === "" || (Array.isArray(actual) && actual.length === 0);
    case "is_not_empty":
      return !evaluateRule({ ...rule, operator: "is_empty" }, context);
    case "is_true":
      return actual === true || actual === "true" || actual === 1 || actual === "1";
    case "is_false":
      return !(actual === true || actual === "true" || actual === 1 || actual === "1");
    default:
      return false;
  }
}

/** An empty/missing condition group always matches. */
export function evaluateConditions(group: ConditionGroup | null | undefined, context: Record<string, unknown>): boolean {
  if (!group || !group.rules || group.rules.length === 0) return true;
  const results = group.rules.map((r) => ("rules" in r || "match" in r ? evaluateConditions(r as ConditionGroup, context) : evaluateRule(r as ConditionRule, context)));
  return (group.match ?? "all") === "any" ? results.some(Boolean) : results.every(Boolean);
}
