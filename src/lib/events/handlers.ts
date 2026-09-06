import { registerEventHandler } from "@/lib/events";

/**
 * Built-in subscribers. Each is a thin adapter; the real logic lives in its
 * module. Adding a subscriber never requires touching the emitting code.
 */
export function registerBuiltInHandlers(): void {
  registerEventHandler("*", "automation-engine", async (event) => {
    if (!event.businessId) return;
    const { runAutomationsForEvent } = await import("@/lib/automation/engine");
    await runAutomationsForEvent(event);
  });

  registerEventHandler("*", "webhooks", async (event) => {
    if (!event.businessId) return;
    const { deliverWebhooksForEvent } = await import("@/lib/integrations/webhooks");
    await deliverWebhooksForEvent(event);
  });
}
