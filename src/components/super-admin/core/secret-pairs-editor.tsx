"use client";

import * as React from "react";
import { Button, Input } from "@/components/ui";

export interface SecretPairRow {
  key: string;
  masked?: string;
}

/**
 * Key/value editor for encrypted secrets. Existing secrets show masked; leave
 * the value blank to keep it, type a new value to replace it, remove the row
 * to delete it. Submits as secretKey[] / secretValue[] arrays.
 */
export function SecretPairsEditor({ initial }: { initial: SecretPairRow[] }) {
  const [rows, setRows] = React.useState<Array<{ id: number; key: string; masked?: string }>>(() => initial.map((r, i) => ({ id: i, key: r.key, masked: r.masked })));
  const nextId = React.useRef(initial.length);
  const add = () => setRows((r) => [...r, { id: nextId.current++, key: "" }]);
  const remove = (id: number) => setRows((r) => r.filter((x) => x.id !== id));
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-neutral-500">No secrets stored. Add API keys or tokens here; they are encrypted at rest and never shown again in full.</p>}
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
          <Input name="secretKey[]" placeholder="e.g. apiKey" defaultValue={row.key} aria-label="Secret key" autoComplete="off" />
          <Input name="secretValue[]" type="password" placeholder={row.masked ? `Stored: ${row.masked} (leave blank to keep)` : "Value"} aria-label="Secret value" autoComplete="new-password" />
          <Button type="button" variant="ghost" size="md" onClick={() => remove(row.id)} aria-label="Remove secret">
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        Add secret
      </Button>
    </div>
  );
}
