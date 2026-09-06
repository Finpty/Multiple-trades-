import { requirePlatformAdmin } from "@/lib/authz";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { IndustryGeneralForm } from "@/components/super-admin/catalog/industry-general-form";
import { createIndustryAction } from "../actions";

export const metadata = { title: "New industry" };

export default async function NewIndustryPage() {
  await requirePlatformAdmin("ADMIN");
  return (
    <>
      <PageHeader title="New industry" description="Give the trade a name and icon. You will configure services, fields, pricing and stages next." breadcrumbs={[{ label: "Industries", href: "/super-admin/industries" }, { label: "New" }]} />
      <Card className="max-w-2xl"><CardBody><IndustryGeneralForm action={createIndustryAction} submitLabel="Create industry" /></CardBody></Card>
    </>
  );
}
