import { requireBusinessAccess } from "@/lib/authz";
import { getAIAvailability } from "@/lib/ai/service";
import { AI_ADAPTERS } from "@/lib/ai/adapters";
import { getPlatformSetting } from "@/lib/platform/settings";
import { aiUsageThisMonth, integrationSecretKeys, listBusinessAiProviders } from "@/lib/business/integrations";
import { DOMAIN_EVENT_TYPES } from "@/lib/events/types";
import { asArray } from "@/lib/json";
import { Alert, PageHeader } from "@/components/ui";
import { IntegrationsPanel } from "@/components/admin/config/integrations-panel";
import { deleteAiProviderAction, deleteIntegrationAction, deleteWebhookAction, saveAiProviderAction, saveIntegrationAction, saveWebhookAction, testAiAction, testWebhookAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations & AI" };

export default async function IntegrationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "integrations.manage");
  const [aiEnabled, allowKeys, availability, providers, usage, webhooks, integrations] = await Promise.all([
    getPlatformSetting<boolean>("ai.enabled", false),
    getPlatformSetting<boolean>("ai.allowBusinessKeys", true),
    getAIAvailability(businessId),
    listBusinessAiProviders(businessId),
    aiUsageThisMonth(businessId),
    ctx.db.webhook.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
    ctx.db.integration.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Integrations & AI" description="Optional connections. Everything in TRADE ONE works without any of these." />
      <Alert tone="neutral" className="mb-4">AI is <strong>{aiEnabled ? "enabled" : "disabled"}</strong> platform-wide{availability.available ? ` and available via ${availability.providerName} (${availability.model})` : " for this business"}. AI only adds optional shortcuts (draft text, summaries); no core workflow depends on it.</Alert>
      <IntegrationsPanel
        businessId={businessId}
        ai={{ enabled: aiEnabled, allowKeys, available: availability.available, providers, usage, adapters: Object.values(AI_ADAPTERS).map((a) => ({ id: a.id, label: a.label, defaultBaseUrl: a.defaultBaseUrl, defaultModels: a.defaultModels, requiresApiKey: a.requiresApiKey })) }}
        webhooks={webhooks.map((w) => ({ id: w.id, url: w.url, events: asArray<string>(w.events), isActive: w.isActive, lastStatus: w.lastStatus, lastCalledAt: w.lastCalledAt?.toISOString() ?? null, hasSecret: !!w.secretEncrypted }))}
        integrations={integrations.map((i) => ({ id: i.id, provider: i.provider, name: i.name, config: JSON.stringify(i.config, null, 2), secretKeys: integrationSecretKeys(i.secretsEncrypted), isEnabled: i.isEnabled, status: i.status }))}
        eventTypes={[...DOMAIN_EVENT_TYPES]}
        actions={{ saveAi: saveAiProviderAction, deleteAi: deleteAiProviderAction, testAi: testAiAction, saveWebhook: saveWebhookAction, deleteWebhook: deleteWebhookAction, testWebhook: testWebhookAction, saveIntegration: saveIntegrationAction, deleteIntegration: deleteIntegrationAction }}
      />
    </>
  );
}
