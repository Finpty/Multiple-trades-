"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { AiProviderSchema, IntegrationSchema, WebhookSchema, deleteBusinessAiProvider, saveBusinessAiProvider, saveIntegration, saveWebhook } from "@/lib/business/integrations";
import { AIService, AIUnavailableError } from "@/lib/ai/service";
import { deliverWebhooksForEvent } from "@/lib/integrations/webhooks";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";

const path = (b: string) => `/admin/${b}/integrations`;

export async function saveAiProviderAction(businessId: string, providerId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    const o = formToObject(formData);
    const input = AiProviderSchema.parse({ ...o, isEnabled: o.isEnabled === undefined ? true : bool(o.isEnabled), monthlyTokenLimit: str(o.monthlyTokenLimit) === "" ? "" : o.monthlyTokenLimit });
    await saveBusinessAiProvider(businessId, input, ctx.user.id, providerId && isUuid(providerId) ? providerId : undefined);
    revalidatePath(path(businessId));
    return ok(undefined, "AI provider saved");
  });
}

export async function deleteAiProviderAction(businessId: string, providerId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    await deleteBusinessAiProvider(businessId, providerId, ctx.user.id);
    revalidatePath(path(businessId));
    return ok(undefined, "Provider removed");
  });
}

export async function testAiAction(businessId: string): Promise<ActionResult<{ text: string; provider: string; model: string; latencyMs: number }>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    try {
      const r = await AIService.generateText({ feature: "business.test", prompt: "Reply with the single word OK.", maxTokens: 8 }, { businessId, userId: ctx.user.id });
      return ok({ text: r.text.trim(), provider: r.provider, model: r.model, latencyMs: r.latencyMs });
    } catch (e) {
      if (e instanceof AIUnavailableError) return fail(e.message);
      throw e;
    }
  });
}

export async function saveWebhookAction(businessId: string, webhookId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    const o = formToObject(formData);
    const input = WebhookSchema.parse({ ...o, events: Array.isArray(o.events) ? o.events : [], isActive: o.isActive === undefined ? true : bool(o.isActive) });
    await saveWebhook(ctx.db, businessId, input, ctx.user.id, webhookId && isUuid(webhookId) ? webhookId : undefined);
    revalidatePath(path(businessId));
    return ok(undefined, "Webhook saved");
  });
}

export async function deleteWebhookAction(businessId: string, webhookId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    await ctx.db.webhook.delete({ where: { id: webhookId } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "webhook.deleted", entityType: "webhook", entityId: webhookId, severity: "NOTICE" });
    revalidatePath(path(businessId));
    return ok(undefined, "Webhook deleted");
  });
}

export async function testWebhookAction(businessId: string, webhookId: string): Promise<ActionResult<{ status: number | null }>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    const hook = await ctx.db.webhook.findFirstOrThrow({ where: { id: webhookId, businessId } });
    await deliverWebhooksForEvent({ id: "test", type: "lead.created", businessId, organizationId: null, actorUserId: ctx.user.id, createdAt: new Date(), payload: { businessId, leadId: "00000000-0000-0000-0000-000000000000", source: "test", serviceId: null, assignedToUserId: null } });
    const after = await ctx.db.webhook.findFirstOrThrow({ where: { id: hook.id } });
    revalidatePath(path(businessId));
    return ok({ status: after.lastStatus }, after.lastStatus && after.lastStatus < 400 ? `Delivered (HTTP ${after.lastStatus})` : `Endpoint responded ${after.lastStatus ?? "with a network error"}`);
  });
}

export async function saveIntegrationAction(businessId: string, integrationId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    const o = formToObject(formData);
    const input = IntegrationSchema.parse({ ...o, secrets: Array.isArray(o.secrets) ? o.secrets : [], isEnabled: bool(o.isEnabled) });
    await saveIntegration(ctx.db, businessId, input, ctx.user.id, integrationId && isUuid(integrationId) ? integrationId : undefined);
    revalidatePath(path(businessId));
    return ok(undefined, "Integration saved");
  });
}

export async function deleteIntegrationAction(businessId: string, integrationId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "integrations.manage", { throwOnly: true });
    await ctx.db.integration.delete({ where: { id: integrationId } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "integration.deleted", entityType: "integration", entityId: integrationId, severity: "CRITICAL" });
    revalidatePath(path(businessId));
    return ok(undefined, "Integration removed");
  });
}
