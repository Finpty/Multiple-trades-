"use client";

import * as React from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Card, CardBody, CardHeader, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { MediaPicker } from "@/components/admin/media-picker";
import type { ActionResult } from "@/lib/actions";
import type { SeoDefaults } from "@/lib/website/seo";

export function SeoDefaultsForm({ businessId, action, initial }: { businessId: string; action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>; initial: SeoDefaults }) {
  const [social, setSocial] = React.useState<string | null>(initial.socialImageMediaId ?? null);
  const org = (initial.organization ?? {}) as Record<string, string | undefined>;
  return (
    <ActionForm action={action} successMessage="SEO defaults saved">
      <Card>
        <CardHeader title="Site defaults" description="Applied to every page unless the page overrides it." actions={<SubmitButton>Save defaults</SubmitButton>} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Title suffix" hint='Appended to page titles, e.g. " | Kabura Tiling"'><Input name="titleSuffix" defaultValue={initial.titleSuffix ?? ""} /></Field>
          <Field label="Google site verification" hint="Meta tag content value"><Input name="googleSiteVerification" defaultValue={initial.googleSiteVerification ?? ""} /></Field>
          <Field label="Default description" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={initial.description ?? ""} /></Field>
          <Field label="Default social image"><MediaPicker businessId={businessId} value={social} onChange={(m) => setSocial(m?.id ?? null)} name="socialImageMediaId" /></Field>
          <div className="flex items-end pb-2"><Checkbox name="noindex" defaultChecked={!!initial.noindex} label="Hide the whole site from search engines" /></div>
          <Field label="Head snippets" hint="Only <meta> and <link> tags are kept (e.g. verification tags)." className="sm:col-span-2"><Textarea name="headSnippets" rows={3} className="font-mono text-xs" defaultValue={initial.headSnippets ?? ""} /></Field>
          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3 rounded-md border p-3">
            <div className="sm:col-span-3 text-sm font-medium">Organisation structured data (overrides business details)</div>
            {["name", "legalName", "telephone", "email", "priceRange", "areaServed"].map((k) => <Field key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^\w/, (c) => c.toUpperCase())}><Input name={`organization.${k}`} defaultValue={org[k] ?? ""} /></Field>)}
          </div>
        </CardBody>
      </Card>
    </ActionForm>
  );
}
