"use client";

import * as React from "react";

export function AuditRowDetails({ before, after, metadata }: { before: unknown; after: unknown; metadata: unknown }) {
  const [open, setOpen] = React.useState(false);
  const has = (v: unknown): boolean => !!v && typeof v === "object" && Object.keys(v as object).length > 0;
  if (!has(before) && !has(after) && !has(metadata)) return null;
  return (
    <>
      <button type="button" className="text-xs underline" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Details"}</button>
      {open && (
        <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-3">
          {has(before) && <pre className="max-h-48 overflow-auto rounded bg-red-50 p-2"><b>before</b>{"\n"}{JSON.stringify(before, null, 2)}</pre>}
          {has(after) && <pre className="max-h-48 overflow-auto rounded bg-emerald-50 p-2"><b>after</b>{"\n"}{JSON.stringify(after, null, 2)}</pre>}
          {has(metadata) && <pre className="max-h-48 overflow-auto rounded bg-neutral-50 p-2"><b>metadata</b>{"\n"}{JSON.stringify(metadata, null, 2)}</pre>}
        </div>
      )}
    </>
  );
}
