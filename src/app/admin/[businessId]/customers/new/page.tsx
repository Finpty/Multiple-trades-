import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/admin/operations/crm/customer-form";
import { createCustomer } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "crm.manage");
  const [definitions, sources] = await Promise.all([listFieldDefinitions(ctx.db, businessId, "CUSTOMER"), ctx.db.customer.findMany({ where: { businessId, source: { not: null } }, select: { source: true }, distinct: ["source"] })]);
  const base = `/admin/${businessId}/customers`;
  return (
    <div>
      <PageHeader title="New customer" breadcrumbs={[{ label: "Customers", href: base }, { label: "New" }]} />
      <CustomerForm businessId={businessId} action={createCustomer.bind(null, businessId)} values={{ firstName: "", lastName: "", email: "", phone: "", company: "", address: {}, notes: "", tags: [], source: "manual", status: "ACTIVE" }} definitions={definitions} customValues={{}} cancelHref={base} submitLabel="Create customer" sources={sources.map((s) => s.source!).filter(Boolean)} />
    </div>
  );
}
