import { requireBusinessAccess } from "@/lib/authz";
import { SettingsTabs } from "@/components/admin/config/settings-tabs";
import { DangerZone } from "@/components/admin/config/settings-forms";
import { unpublishBusinessAction } from "../../setup/actions";
import { archiveBusinessAction, requestDeletionAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Danger zone" };

export default async function DangerPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  return (
    <>
      <SettingsTabs businessId={businessId} current="danger" />
      <DangerZone businessName={ctx.business.name} status={ctx.business.status} archiveAction={archiveBusinessAction.bind(null, businessId)} deletionAction={requestDeletionAction.bind(null, businessId)} unpublish={unpublishBusinessAction.bind(null, businessId)} />
    </>
  );
}
