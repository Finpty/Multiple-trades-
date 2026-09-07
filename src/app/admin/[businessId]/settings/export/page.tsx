import { requireBusinessAccess } from "@/lib/authz";
import { SettingsTabs } from "@/components/admin/config/settings-tabs";
import { ExportPanel } from "@/components/admin/config/export-panel";
import { exportBusinessAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export" };

export default async function ExportPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireBusinessAccess(businessId, "export.manage");
  return (
    <>
      <SettingsTabs businessId={businessId} current="export" />
      <ExportPanel run={exportBusinessAction.bind(null, businessId)} />
    </>
  );
}
