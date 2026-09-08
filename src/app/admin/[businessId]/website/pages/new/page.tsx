import { requireBusinessAccess } from "@/lib/authz";
import { PAGE_AUDIENCES, PAGE_TEMPLATES } from "@/lib/website/pages";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { NewPageForm } from "@/components/editor/pages/new-page-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create page" };

export default async function NewPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const parents = await ctx.db.page.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const b = `/admin/${businessId}/website`;
  return (
    <>
      <PageHeader title="Create page" breadcrumbs={[{ label: "Website", href: b }, { label: "Pages", href: `${b}/pages` }, { label: "New" }]} />
      <Card className="max-w-2xl"><CardBody>
        <NewPageForm
          businessId={businessId}
          parents={parents}
          templates={PAGE_TEMPLATES.map((t) => ({ key: t.key, label: t.label }))}
          audiences={PAGE_AUDIENCES}
        />
      </CardBody></Card>
    </>
  );
}
