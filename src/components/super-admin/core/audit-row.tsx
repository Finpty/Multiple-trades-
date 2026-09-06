"use client";

import * as React from "react";
import { Badge, Td, cn } from "@/components/ui";
import { JsonView } from "./json-view";
import { severityTone } from "./severity";

export interface AuditRowData {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  severity: string;
  actorType: string;
  actorName: string | null;
  actorEmail: string | null;
  businessName: string | null;
  businessId: string | null;
  ip: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
}

/** Table row that expands in place to show before/after/metadata. */
export function AuditRow({ row, columns }: { row: AuditRowData; columns: number }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <tr className={cn("cursor-pointer hover:bg-neutral-50", open && "bg-neutral-50")} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Td className="whitespace-nowrap text-xs text-neutral-500">{row.createdAt}</Td>
        <Td>
          <div className="font-medium text-neutral-900">{row.action}</div>
          <div className="text-xs text-neutral-500">
            {row.entityType}
            {row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ""}
          </div>
        </Td>
        <Td>
          {row.actorName ? (
            <>
              <div>{row.actorName}</div>
              <div className="text-xs text-neutral-500">{row.actorEmail}</div>
            </>
          ) : (
            <span className="text-xs text-neutral-500">{row.actorType}</span>
          )}
        </Td>
        <Td>{row.businessName ?? <span className="text-neutral-400">—</span>}</Td>
        <Td>
          <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>
        </Td>
        <Td className="text-right text-xs text-neutral-500">{open ? "Hide" : "Details"}</Td>
      </tr>
      {open && (
        <tr>
          <Td colSpan={columns} className="bg-neutral-50">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Before</div>
                <JsonView value={row.before} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">After</div>
                <JsonView value={row.after} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Metadata</div>
                <JsonView value={row.metadata} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500">
              <span>Log id: {row.id}</span>
              {row.entityId && <span>Entity id: {row.entityId}</span>}
              {row.businessId && <span>Business id: {row.businessId}</span>}
              {row.ip && <span>IP: {row.ip}</span>}
              {row.userAgent && <span className="truncate">UA: {row.userAgent}</span>}
            </div>
          </Td>
        </tr>
      )}
    </>
  );
}
