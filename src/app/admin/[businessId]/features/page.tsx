import { requireBusinessAccess } from "@/lib/authz";
import { listBusinessFeatures } from "@/lib/business/features";
import { getAIAvailability } from "@/lib/ai/service";
import { Alert, PageHeader } from "@/components/ui";
import { FeatureToggles } from "@/components/admin/config/feature-toggles";
import { saveFeatureConfigAction, toggleFeatureAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Features" };

export default async function FeaturesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "features.manage");
  const [features, ai] = await Promise.all([listBusinessFeatures(ctx.db, businessId), getAIAvailability(businessId)]);
  return (
    <>
      <PageHeader title="Features" description="Switch modules on or off. Changes apply immediately — nothing is deployed." />
      {!ai.available && features.some((f) => f.requiresAi) && <Alert tone="info" className="mb-4">AI is not available ({ai.reason === "disabled" ? "turned off by the platform" : "no provider configured"}). AI-assisted features can still be enabled; they show manual workflows until a provider exists. Every core feature works without AI.</Alert>}
      <FeatureToggles businessId={businessId} features={features} aiAvailable={ai.available} toggle={toggleFeatureAction} saveConfig={saveFeatureConfigAction} />
    </>
  );
}
