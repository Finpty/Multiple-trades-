import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { FORM_ACTIONS, embeddedPageCounts, formFields } from "@/lib/forms/builder";
import { Badge, Card, EmptyState, PageHeader, Table, TBody, Td, Th, THead, cn, formatDate } from "@/components/ui";
import { CreateFormDialog } from "@/components/admin/operations/forms/create-form-dialog";
import { FormRowActions } from "@/components/admin/operations/forms/form-row-actions";
import { createForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function FormsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "forms.manage");
  const { filter } = await searchParams;
  const archived = filter === "archived";
  const [forms, embedded] = await Promise.all([
    ctx.db.form.findMany({ where: { businessId, deletedAt: archived ? { not: null } : null }, orderBy: { createdAt: "asc" }, include: { _count: { select: { submissions: true } } } }),
    embeddedPageCounts(ctx.db, businessId),
  ]);
  const base = `/admin/${businessId}/forms`;
  const createAction = createForm.bind(null, businessId);

  return (
    <div>
      <PageHeader
        title="Forms"
        description="Enquiry, quote and booking forms for your website. Build the fields here, then add the form to any page with a form block."
        actions={<CreateFormDialog action={createAction} />}
      />
      <div className="mb-4 flex items-center gap-1">
        {[{ key: "active", label: "Active" }, { key: "archived", label: "Archived" }].map((f) => (
          <Link key={f.key} href={f.key === "active" ? base : `${base}?filter=archived`} className={cn("rounded-full px-3 py-1 text-sm", (f.key === "archived") === archived ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>
            {f.label}
          </Link>
        ))}
      </div>
      {forms.length === 0 ? (
        <EmptyState title={archived ? "No archived forms" : "No forms yet"} description={archived ? "Archived forms show here and can be restored." : "Create your first form to start collecting enquiries from your website."} action={archived ? undefined : <CreateFormDialog action={createAction} />} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <Th>Name</Th>
                  <Th>Action</Th>
                  <Th>Fields</Th>
                  <Th>Submissions</Th>
                  <Th>On pages</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </THead>
              <TBody>
                {forms.map((f) => (
                  <tr key={f.id} className="hover:bg-neutral-50">
                    <Td>
                      <Link href={`${base}/${f.id}`} className="font-medium text-neutral-900 hover:underline">
                        {f.name}
                      </Link>
                      <div className="text-xs text-neutral-500">/{f.slug}</div>
                    </Td>
                    <Td>{FORM_ACTIONS.find((a) => a.value === f.action)?.label ?? f.action}</Td>
                    <Td>{formFields(f).length}</Td>
                    <Td>
                      <Link href={`${base}/${f.id}/submissions`} className="hover:underline">
                        {f._count.submissions}
                      </Link>
                    </Td>
                    <Td>{embedded[f.slug] ?? 0}</Td>
                    <Td>{f.deletedAt ? <Badge tone="neutral">Archived</Badge> : f.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Inactive</Badge>}</Td>
                    <Td className="text-neutral-500">{formatDate(f.updatedAt)}</Td>
                    <Td className="text-right">
                      <FormRowActions businessId={businessId} formId={f.id} isActive={f.isActive} archived={!!f.deletedAt} />
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
