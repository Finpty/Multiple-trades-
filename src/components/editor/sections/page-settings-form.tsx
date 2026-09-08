"use client";

import * as React from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { MediaPicker } from "@/components/admin/media-picker";
import type { ActionResult } from "@/lib/actions";
import type { PageSeo } from "@/lib/website/pages";

export function PageSettingsForm({ businessId, action, parents, templates, audiences, initial }: { businessId: string; action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>; parents: Array<{ id: string; title: string }>; templates: Array<{ key: string; label: string }>; audiences: string[]; initial: { title: string; slug: string; isSystem: boolean; isHome: boolean; templateKey: string; audience: string; showInNav: boolean; sortOrder: number; parentId: string | null; seo: PageSeo; settingsJson: string } }) {
  const [social, setSocial] = React.useState<string | null>(initial.seo.socialImageMediaId ?? null);
  return (
    <ActionForm action={action} className="space-y-6" successMessage="Page settings saved">
      {({ fieldErrors }) => (<>
        <Card><CardHeader title="Page" /><CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={fieldErrors.title}><Input name="title" defaultValue={initial.title} required /></Field>
          <Field label="URL slug" hint={initial.isHome ? "The home page has no slug" : initial.isSystem ? "System page slugs can be changed; links update automatically" : undefined} error={fieldErrors.slug}><Input name="slug" defaultValue={initial.slug} disabled={initial.isHome} /></Field>
          <Field label="Template"><Select name="templateKey" defaultValue={initial.templateKey}>{templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select></Field>
          <Field label="Audience"><Select name="audience" defaultValue={initial.audience}>{audiences.map((a) => <option key={a} value={a}>{a.toLowerCase()}</option>)}</Select></Field>
          <Field label="Parent page"><Select name="parentId" defaultValue={initial.parentId ?? ""}><option value="">None</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
          <Field label="Sort order"><Input name="sortOrder" type="number" defaultValue={initial.sortOrder} /></Field>
          <div className="sm:col-span-2"><Checkbox name="showInNav" defaultChecked={initial.showInNav} label="Show in navigation" /></div>
        </CardBody></Card>
        <Card><CardHeader title="SEO" /><CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO title" hint="Shown in search results and the browser tab"><Input name="seoTitle" defaultValue={initial.seo.title ?? ""} /></Field>
          <Field label="Canonical URL" hint="Optional; overrides the default canonical"><Input name="seoCanonical" defaultValue={initial.seo.canonical ?? ""} /></Field>
          <Field label="Meta description" className="sm:col-span-2"><Textarea name="seoDescription" rows={2} defaultValue={initial.seo.description ?? ""} /></Field>
          <Field label="Social image"><MediaPicker businessId={businessId} value={social} onChange={(m) => setSocial(m?.id ?? null)} name="seoSocialImageMediaId" /></Field>
          <div className="flex items-end pb-2"><Checkbox name="seoNoindex" defaultChecked={!!initial.seo.noindex} label="Hide from search engines (noindex)" /></div>
          <Field label="Extra JSON-LD" hint="Advanced: additional structured data (JSON)" className="sm:col-span-2"><Textarea name="seoJsonLd" rows={4} className="font-mono text-xs" defaultValue={typeof initial.seo.jsonLd === "string" ? initial.seo.jsonLd : initial.seo.jsonLd ? JSON.stringify(initial.seo.jsonLd, null, 2) : ""} /></Field>
        </CardBody></Card>
        <Card><CardHeader title="Advanced" /><CardBody><Field label="Page settings (JSON)" hint="Template-specific options"><Textarea name="settingsJson" rows={4} className="font-mono text-xs" defaultValue={initial.settingsJson} /></Field></CardBody></Card>
        <SubmitButton>Save settings</SubmitButton>
      </>)}
    </ActionForm>
  );
}
