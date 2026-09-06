import { createHmac } from "node:crypto";
import type { DomainEventEnvelope } from "@/lib/events";
import { tenantDb } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { asArray } from "@/lib/json";

/** Delivers a domain event to every active webhook of the business that subscribes to it. */
export async function deliverWebhooksForEvent(event: DomainEventEnvelope): Promise<void> {
  if (!event.businessId) return;
  const db = tenantDb(event.businessId);
  const hooks = await db.webhook.findMany({ where: { businessId: event.businessId, isActive: true } });
  for (const hook of hooks) {
    const events = asArray<string>(hook.events);
    if (events.length && !events.includes(event.type) && !events.includes("*")) continue;
    const body = JSON.stringify({ id: event.id, type: event.type, businessId: event.businessId, createdAt: event.createdAt, payload: event.payload });
    const headers: Record<string, string> = { "content-type": "application/json", "x-tradeone-event": event.type };
    if (hook.secretEncrypted) {
      headers["x-tradeone-signature"] = createHmac("sha256", decryptSecret(hook.secretEncrypted)).update(body).digest("hex");
    }
    let status: number | null = null;
    try {
      const res = await fetch(hook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
      status = res.status;
    } catch {
      status = 0;
    }
    await db.webhook.update({ where: { id: hook.id }, data: { lastStatus: status, lastCalledAt: new Date() } });
  }
}
