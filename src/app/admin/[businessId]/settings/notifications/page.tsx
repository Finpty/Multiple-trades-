import { requireBusinessAccess } from "@/lib/authz";
import { asObject } from "@/lib/json";
import { SettingsTabs } from "@/components/admin/config/settings-tabs";
import { NotificationsForm } from "@/components/admin/config/settings-forms";
import { saveNotificationsAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications & payments" };

export default async function NotificationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const s = asObject<{ notifications?: { leadEmails?: string[]; quoteEmails?: string[] }; paymentInstructions?: string; estimateDisclaimer?: string; social?: Record<string, string> }>(ctx.business.settings);
  return (
    <>
      <SettingsTabs businessId={businessId} current="notifications" />
      <NotificationsForm action={saveNotificationsAction.bind(null, businessId)} initial={{ leadEmails: s.notifications?.leadEmails ?? [], quoteEmails: s.notifications?.quoteEmails ?? [], paymentInstructions: s.paymentInstructions ?? "", estimateDisclaimer: s.estimateDisclaimer ?? "", social: s.social ?? {} }} />
    </>
  );
}
