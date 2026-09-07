"use client";

import * as React from "react";
import { Alert, Button, Card, CardBody, CardHeader, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export function ExportPanel({ run }: { run: () => Promise<ActionResult<{ filename: string; json: string }>> }) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<{ filename: string; json: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const download = () => {
    if (!result) return;
    const blob = new Blob([result.json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card>
      <CardHeader title="Export configuration & content" description="A JSON backup of this business: settings, theme, features, services, areas, materials, pages, navigation, forms, workflows, custom fields, pricing, automations, team, reviews, projects and media references. Customer and financial records are never included." />
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex gap-2">
          <Button disabled={pending} onClick={() => start(async () => { setError(null); const r = await run(); if (r.ok) setResult(r.data); else setError(r.error); })}>{pending ? "Preparing…" : "Generate export"}</Button>
          {result && <Button variant="secondary" onClick={download}>Download {result.filename}</Button>}
        </div>
        {result && <Textarea readOnly value={result.json} rows={16} className="font-mono text-xs" />}
        <p className="text-xs text-neutral-500">Platform staff can import this file to create a copy of the business, or save it as a template.</p>
      </CardBody>
    </Card>
  );
}
