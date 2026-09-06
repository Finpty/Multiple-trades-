"use client";

import * as React from "react";
import { CONDITION_OPERATORS, type ConditionGroup, type ConditionRule } from "@/lib/rules/conditions";
import { Button, Input, Select, cn } from "@/components/ui";

export interface FieldOption {
  value: string;
  label: string;
  group?: string;
}

/**
 * Visual IF-builder shared by pricing rules and automations. Emits a
 * ConditionGroup; the surrounding form serialises it via a hidden input.
 */
export function ConditionsEditor({ value, onChange, fieldOptions, name, className }: { value: ConditionGroup; onChange?: (v: ConditionGroup) => void; fieldOptions: FieldOption[]; name?: string; className?: string }) {
  const [group, setGroup] = React.useState<ConditionGroup>({ match: value.match ?? "all", rules: value.rules ?? [] });
  const update = (next: ConditionGroup) => {
    setGroup(next);
    onChange?.(next);
  };
  const rules = (group.rules ?? []) as ConditionRule[];
  const setRule = (i: number, patch: Partial<ConditionRule>) => update({ ...group, rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const groups = [...new Set(fieldOptions.map((f) => f.group ?? ""))];
  return (
    <div className={cn("space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3", className)}>
      {name && <input type="hidden" name={name} value={JSON.stringify(group)} />}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">IF</span>
        <Select className="w-auto" value={group.match ?? "all"} onChange={(e) => update({ ...group, match: e.target.value as "all" | "any" })}>
          <option value="all">all conditions match</option>
          <option value="any">any condition matches</option>
        </Select>
        {rules.length === 0 && <span className="text-neutral-500">(no conditions — always applies)</span>}
      </div>
      {rules.map((r, i) => {
        const op = CONDITION_OPERATORS.find((o) => o.value === r.operator);
        const custom = !fieldOptions.some((f) => f.value === r.field);
        return (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="flex gap-1">
              <Select value={custom ? "__custom" : r.field} onChange={(e) => setRule(i, { field: e.target.value === "__custom" ? "" : e.target.value })}>
                {groups.map((g) => (
                  <optgroup key={g || "fields"} label={g || "Fields"}>
                    {fieldOptions.filter((f) => (f.group ?? "") === g).map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="__custom">Custom path…</option>
              </Select>
              {custom && <Input value={r.field} placeholder="inputs.my_field" onChange={(e) => setRule(i, { field: e.target.value })} />}
            </div>
            <Select value={r.operator} onChange={(e) => setRule(i, { operator: e.target.value as ConditionRule["operator"] })}>
              {CONDITION_OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Input value={op?.needsValue === false ? "" : String(r.value ?? "")} disabled={op?.needsValue === false} placeholder={r.operator === "in" || r.operator === "not_in" ? "a, b, c" : "value"} onChange={(e) => setRule(i, { value: e.target.value })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => update({ ...group, rules: rules.filter((_, j) => j !== i) })} aria-label="Remove condition">✕</Button>
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" onClick={() => update({ ...group, rules: [...rules, { field: fieldOptions[0]?.value ?? "", operator: "eq", value: "" }] })}>
        + Add condition
      </Button>
    </div>
  );
}
