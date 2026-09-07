import { requireBusinessAccess } from "@/lib/authz";
import { asObject } from "@/lib/json";
import { TERMINOLOGY_KEYS } from "@/lib/platform/industries";
import { SettingsTabs } from "@/components/admin/config/settings-tabs";
import { TerminologyForm } from "@/components/admin/config/settings-forms";
import { Alert } from "@/components/ui";
import { saveTerminologyAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terminology" };

export default async function TerminologyPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const settings = asObject<{ terminology?: Record<string, string> }>(ctx.business.settings);
  return (
    <>
      <SettingsTabs businessId={businessId} current="terminology" />
      <Alert tone="neutral" className="mb-4">Words used across your admin and website (e.g. call a &quot;Job&quot; a &quot;Project&quot;). Pre-filled from your industry.</Alert>
      <TerminologyForm action={saveTerminologyAction.bind(null, businessId)} initial={settings.terminology ?? {}} keys={TERMINOLOGY_KEYS} />
    </>
  );
}
