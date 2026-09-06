import { platformDb } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { emitEvent } from "@/lib/events";
import { asObject } from "@/lib/json";
import { getPlatformSetting } from "@/lib/platform/settings";
import { getAdapter } from "./adapters";
import type { AiProvider as AiProviderRow } from "@prisma/client";
import type { AIProviderAdapter } from "./types";
import { AIUnavailableError, type AITextRequest, type AITextResult } from "./types";

export * from "./types";
export { AI_ADAPTERS, getAdapter } from "./adapters";

export interface AIAvailability {
  available: boolean;
  reason?: AIUnavailableError["reason"];
  providerName?: string;
  model?: string;
}

type ResolvedProvider = { error: "disabled" | "no_provider" | "limit_reached"; provider?: undefined; adapter?: undefined } | { error?: undefined; provider: AiProviderRow; adapter: AIProviderAdapter };

async function resolveProvider(businessId?: string | null): Promise<ResolvedProvider> {
  const enabled = await getPlatformSetting<boolean>("ai.enabled", false);
  if (!enabled) return { error: "disabled" as const };
  const where = businessId
    ? { isEnabled: true, OR: [{ scope: "BUSINESS" as const, businessId }, { scope: "PLATFORM" as const }] }
    : { isEnabled: true, scope: "PLATFORM" as const };
  const providers = await platformDb.aiProvider.findMany({ where, orderBy: [{ scope: "desc" }, { isDefault: "desc" }, { priority: "asc" }] });
  const chosen = providers.find((p) => p.scope === "BUSINESS") ?? providers.find((p) => p.isDefault) ?? providers[0];
  if (!chosen) return { error: "no_provider" as const };
  const adapter = getAdapter(chosen.provider);
  if (!adapter) return { error: "no_provider" as const };
  if (chosen.monthlyTokenLimit) {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    const used = await platformDb.aiUsage.aggregate({ where: { providerId: chosen.id, createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true } });
    if ((used._sum.inputTokens ?? 0) + (used._sum.outputTokens ?? 0) >= chosen.monthlyTokenLimit) return { error: "limit_reached" as const };
  }
  return { provider: chosen, adapter };
}

/** UI helper: is AI usable right now for this business? Never throws. */
export async function getAIAvailability(businessId?: string | null): Promise<AIAvailability> {
  try {
    const r = await resolveProvider(businessId);
    if (r.error) return { available: false, reason: r.error };
    return { available: true, providerName: r.provider.name, model: r.provider.model };
  } catch {
    return { available: false, reason: "provider_error" };
  }
}

/**
 * The only way application code talks to a model. Every call is optional from
 * the caller's perspective: catch AIUnavailableError and show the manual path.
 */
export const AIService = {
  async generateText(request: AITextRequest, ctx: { businessId?: string | null; userId?: string | null } = {}): Promise<AITextResult> {
    const resolved = await resolveProvider(ctx.businessId);
    if (resolved.error) throw new AIUnavailableError(resolved.error);
    const { provider, adapter } = resolved;
    const apiKey = provider.apiKeyEncrypted ? decryptSecret(provider.apiKeyEncrypted) : null;
    if (adapter.requiresApiKey && !apiKey) throw new AIUnavailableError("no_provider", "The configured AI provider has no API key.");
    const started = Date.now();
    try {
      const result = await adapter.generateText(request, {
        provider: provider.provider,
        model: provider.model,
        apiKey,
        baseUrl: provider.baseUrl,
        settings: asObject(provider.settings),
      });
      const latencyMs = Date.now() - started;
      await platformDb.aiUsage.create({
        data: {
          businessId: ctx.businessId ?? null,
          providerId: provider.id,
          userId: ctx.userId ?? null,
          feature: request.feature,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
        },
      });
      await emitEvent({ type: "ai.request.completed", businessId: ctx.businessId ?? null, payload: { businessId: ctx.businessId ?? null, feature: request.feature, provider: provider.provider, model: result.model }, actorUserId: ctx.userId ?? null });
      return { ...result, provider: provider.provider, latencyMs };
    } catch (error) {
      await platformDb.aiUsage.create({
        data: { businessId: ctx.businessId ?? null, providerId: provider.id, userId: ctx.userId ?? null, feature: request.feature, model: provider.model, status: "error", latencyMs: Date.now() - started },
      });
      if (error instanceof AIUnavailableError) throw error;
      throw new AIUnavailableError("provider_error", error instanceof Error ? error.message : String(error));
    }
  },

  async generateJson<T = unknown>(request: Omit<AITextRequest, "json">, ctx: { businessId?: string | null; userId?: string | null } = {}): Promise<T> {
    const result = await AIService.generateText({ ...request, json: true }, ctx);
    const text = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AIUnavailableError("provider_error", "The AI provider returned invalid JSON.");
    }
  },
};
