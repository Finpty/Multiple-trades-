"use client";

import * as React from "react";
import Link from "next/link";
import type { ServiceAreaType } from "@prisma/client";
import { Alert, Card, CardBody, CardHeader, Field, Select, Switch, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { AREA_TYPES, parseBulkLines, type BulkAddResult } from "@/lib/content/areas";
import { CheckboxTree } from "@/components/admin/content/services/checkbox-tree";
import { bulkAddAreasAction } from "@/app/admin/[businessId]/areas/actions";

export function BulkAddForm({ businessId, parents, services }: { businessId: string; parents: Array<{ id: string; name: string; type: ServiceAreaType; depth: number }>; services: Array<{ id: string; name: string; depth: number }> }) {
  const [lines, setLines] = React.useState("");
  const [serviceIds, setServiceIds] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<BulkAddResult | null>(null);
  const parsed = React.useMemo(() => parseBulkLines(lines), [lines]);

  return (
    <ActionForm action={bulkAddAreasAction} onSuccess={(r) => { setResult(r); setLines(""); }}>
      {({ fieldErrors }) => (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <input type="hidden" name="businessId" value={businessId} />
          <div className="space-y-4">
            {result && (
              <Alert tone={result.created.length ? "success" : "warning"} title={`${result.created.length} created · ${result.skipped.length} skipped`}>
                {result.created.length > 0 && (
                  <p className="mt-1">Created: {result.created.map((c, i) => (
                    <React.Fragment key={c.id}>{i > 0 && ", "}<Link href={`/admin/${businessId}/areas/${c.id}`} className="underline-offset-2 hover:underline">{c.name}</Link></React.Fragment>
                  ))}</p>
                )}
                {result.skipped.length > 0 && <p className="mt-1">Skipped: {result.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}</p>}
                <p className="mt-2"><Link href={`/admin/${businessId}/areas`} className="underline-offset-2 hover:underline">Back to the list</Link> to reorder or open an area and add local content.</p>
              </Alert>
            )}
            <Card>
              <CardHeader title="Paste your list" description="One area per line: Name[, postcode][, STATE]. Areas that already exist (same URL slug) are skipped, never duplicated." />
              <CardBody className="space-y-4">
                <Field label="Areas" required error={fieldErrors.lines} hint={parsed.length ? `${parsed.length} line${parsed.length === 1 ? "" : "s"} recognised` : "e.g. “Northbridge, 6003, WA”"}>
                  <Textarea name="lines" value={lines} onChange={(e) => setLines(e.target.value)} rows={12} placeholder={"Suburb One, 6000, WA\nSuburb Two, 6001\nSuburb Three"} className="font-mono text-xs" />
                </Field>
                {parsed.length > 0 && (
                  <div className="max-h-48 overflow-auto rounded-md border border-neutral-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-neutral-50 text-left text-neutral-500"><tr><th className="px-3 py-1.5">Name</th><th className="px-3 py-1.5">Postcode</th><th className="px-3 py-1.5">State</th></tr></thead>
                      <tbody>
                        {parsed.map((l, i) => (
                          <tr key={i} className="border-t border-neutral-100"><td className="px-3 py-1">{l.name}</td><td className="px-3 py-1">{l.postcode ?? "—"}</td><td className="px-3 py-1">{l.state ?? "—"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Services offered in all of them" description="Optional. You can refine per area later in the service matrix." />
              <CardBody>
                <CheckboxTree name="serviceIds" items={services.map((s) => ({ id: s.id, label: s.name, depth: s.depth }))} selected={serviceIds} onChange={setServiceIds} emptyText="No services yet." />
              </CardBody>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardBody className="space-y-4">
                <Field label="Type for every line" required error={fieldErrors.type}>
                  <Select name="type" defaultValue="SUBURB">
                    {AREA_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Parent area" error={fieldErrors.parentId}>
                  <Select name="parentId" defaultValue="">
                    <option value="">— None (top level) —</option>
                    {parents.map((o) => (
                      <option key={o.id} value={o.id}>{`${"  ".repeat(o.depth)}${o.name}`}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Country code" error={fieldErrors.country}>
                  <Select name="country" defaultValue="AU">
                    <option value="AU">AU</option>
                    <option value="NZ">NZ</option>
                    <option value="GB">GB</option>
                    <option value="US">US</option>
                    <option value="CA">CA</option>
                    <option value="IE">IE</option>
                  </Select>
                </Field>
                <Switch name="isEnabled" checked label="Enabled" />
                <Switch name="generatePage" checked label="Generate pages" description="Each area gets a local landing page. Pages stay noindex until they have unique content." />
                <SubmitButton className="w-full" pendingText="Adding…">Add areas</SubmitButton>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
