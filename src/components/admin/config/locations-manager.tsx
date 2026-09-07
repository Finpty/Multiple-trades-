"use client";

import * as React from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import { LocationForm } from "./settings-forms";

type Loc = Record<string, unknown> & { id: string; name: string; isPrimary: boolean; isActive: boolean; addressLine1: string | null; city: string | null; state: string | null; postcode: string | null; phone: string | null };

export function LocationsManager({ locations, save, remove }: { locations: Loc[]; save: (locationId: string | null, prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>; remove: (locationId: string) => Promise<ActionResult> }) {
  const [editing, setEditing] = React.useState<string | null | "new">(null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEditing("new")}>Add location</Button></div>
      {editing === "new" && (
        <Card><CardHeader title="New location" /><CardBody><LocationForm action={save.bind(null, null)} onCancel={() => setEditing(null)} /></CardBody></Card>
      )}
      {locations.length === 0 && editing !== "new" && <EmptyState title="No locations yet" description="Add your head office or depot. The primary location appears on the website contact page and in local SEO data." action={<Button onClick={() => setEditing("new")}>Add location</Button>} />}
      {locations.map((l) => (
        <Card key={l.id}>
          <CardHeader title={<span className="flex items-center gap-2">{l.name}{l.isPrimary && <Badge tone="green">Primary</Badge>}{!l.isActive && <Badge>Inactive</Badge>}</span>} description={[l.addressLine1, l.city, l.state, l.postcode].filter(Boolean).join(", ") || "No address"} actions={<Button variant="secondary" size="sm" onClick={() => setEditing(editing === l.id ? null : l.id)}>{editing === l.id ? "Close" : "Edit"}</Button>} />
          {editing === l.id && <CardBody><LocationForm action={save.bind(null, l.id)} initial={l} onCancel={() => setEditing(null)} deleteAction={() => remove(l.id)} /></CardBody>}
        </Card>
      ))}
    </div>
  );
}
