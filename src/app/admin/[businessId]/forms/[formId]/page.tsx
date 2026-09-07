import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { embeddedPageCounts, formFields, formSettings } from "@/lib/forms/builder";
import { ButtonLink, PageHeader } from "@/components/ui";
import { FormBuilder } from "@/components/admin/operations/forms/form-builder";
import { saveForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function FormBuilderPage({ params }: { params: Promise<{ businessId: string; formId: string }> }) {
  const { businessId, formId } = await params;
  if (!isUuid(businessId) || !isUuid(formId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "forms.manage");
  const form = await ctx.db.form.findFirst({ where: { id: formId, businessId }, include: { _count: { select: { submissions: true } } } });
  if (!form) notFound();
  const [services, embedded] = await Promise.all([
    ctx.db.service.findMany({ where: { businessId, deletedAt: null, isEnabled: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    embeddedPageCounts(ctx.db, businessId),
  ]);
  const base = `/admin/${businessId}/forms`;

  return (
    <div>
      <PageHeader
        title={form.name}
        description="Build the fields, preview the form and control what happens after someone submits it."
        breadcrumbs={[{ label: "Forms", href: base }, { label: form.name }]}
        actions={
          <ButtonLink href={`${base}/${form.id}/submissions`} variant="secondary">
            Submissions ({form._count.submissions})
          </ButtonLink>
        }
      />
      <FormBuilder
        businessId={businessId}
        form={{ id: form.id, name: form.name, slug: form.slug, description: form.description, action: form.action, isActive: form.isActive, archived: !!form.deletedAt }}
        fields={formFields(form)}
        settings={formSettings(form)}
        services={services}
        embeddedOnPages={embedded[form.slug] ?? 0}
        action={saveForm.bind(null, businessId, form.id)}
      />
    </div>
  );
}
