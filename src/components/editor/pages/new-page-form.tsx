"use client";

import { useRouter } from "next/navigation";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { createPageAction } from "@/app/admin/[businessId]/website/actions";

export function NewPageForm({ businessId, parents, templates, audiences }: {
  businessId: string;
  parents: { id: string; title: string }[];
  templates: { key: string; label: string }[];
  audiences: readonly string[];
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={createPageAction.bind(null, businessId)}
      className="space-y-4"
      refreshOnSuccess={false}
      onSuccess={(data: { id: string }) => router.push(`/admin/${businessId}/website/pages/${data.id}`)}
    >
      {({ fieldErrors }) => (<>
        <Field label="Title" required error={fieldErrors.title}><Input name="title" required autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="URL slug" hint="Leave blank to generate from the title" error={fieldErrors.slug}><Input name="slug" placeholder="about-our-process" /></Field>
          <Field label="Type"><Select name="kind" defaultValue="CUSTOM"><option value="CUSTOM">Standard page</option><option value="LANDING">Landing page (no header nav link)</option></Select></Field>
          <Field label="Template"><Select name="templateKey" defaultValue="default">{templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select></Field>
          <Field label="Audience"><Select name="audience" defaultValue="PUBLIC">{audiences.map((a) => <option key={a} value={a}>{a.toLowerCase()}</option>)}</Select></Field>
          <Field label="Parent page"><Select name="parentId" defaultValue=""><option value="">None</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
        </div>
        <Field label="SEO title"><Input name="seoTitle" /></Field>
        <Field label="SEO description"><Textarea name="seoDescription" rows={2} /></Field>
        <div className="flex gap-6"><Checkbox name="showInNav" defaultChecked label="Show in navigation" /><Checkbox name="starterSections" defaultChecked label="Start with a header and text section" /></div>
        <SubmitButton>Create page</SubmitButton>
      </>)}
    </ActionForm>
  );
}
