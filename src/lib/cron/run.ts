import { platformDb } from "@/lib/db";
import { processPendingEvents } from "@/lib/events";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { purgeExpiredRateLimits } from "@/lib/auth/rate-limit";
import { recheckPendingDomains } from "@/lib/domains/service";
import { purgeDeletedMedia } from "@/lib/media/service";

export interface CronTaskResult {
  task: string;
  ok: boolean;
  detail?: unknown;
  error?: string;
  ms: number;
}

async function step(task: string, fn: () => Promise<unknown>): Promise<CronTaskResult> {
  const started = Date.now();
  try {
    const detail = await fn();
    return { task, ok: true, detail, ms: Date.now() - started };
  } catch (error) {
    return { task, ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
  }
}

/**
 * Scheduled maintenance. Recommended cadence: every 5 minutes. Every task is
 * isolated; a failure never stops the others. Optional modules are imported
 * lazily so the platform runs even if a module is absent.
 */
export async function runCron(): Promise<{ ranAt: string; results: CronTaskResult[] }> {
  const results: CronTaskResult[] = [];
  results.push(await step("events.process", () => processPendingEvents(200)));
  results.push(
    await step("pages.publishScheduled", async () => {
      const mod = await import("@/lib/website/schedule").catch(() => null);
      return mod?.publishScheduledPages ? mod.publishScheduledPages() : { skipped: "module unavailable" };
    }),
  );
  results.push(
    await step("invoices.markOverdue", async () => {
      const mod = (await import("@/lib/operations/invoices").catch(() => null)) as { markOverdueInvoices?: () => Promise<unknown> } | null;
      return mod?.markOverdueInvoices ? mod.markOverdueInvoices() : { skipped: "module unavailable" };
    }),
  );
  results.push(await step("domains.recheck", () => recheckPendingDomains(50)));
  results.push(await step("sessions.purge", () => purgeExpiredSessions()));
  results.push(await step("rateLimits.purge", () => purgeExpiredRateLimits()));
  results.push(
    await step("media.purgeDeleted", async () => {
      const businesses = await platformDb.business.findMany({ select: { id: true } });
      let purged = 0;
      for (const b of businesses) purged += await purgeDeletedMedia(b.id, 30);
      return { purged };
    }),
  );
  return { ranAt: new Date().toISOString(), results };
}
