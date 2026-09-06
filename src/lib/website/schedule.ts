import { platformDb } from "@/lib/db";
import { publishPage } from "@/lib/business/publish";

/**
 * Publishes every page whose scheduled time has passed. Called by the cron
 * route; safe to run concurrently because publishPage clears scheduledAt and
 * the page list is re-read on every run.
 */
export async function publishScheduledPages(now: Date = new Date()): Promise<{ published: number; failed: Array<{ pageId: string; error: string }> }> {
  const due = await platformDb.page.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now }, deletedAt: null, business: { deletedAt: null, status: { notIn: ["ARCHIVED", "SUSPENDED"] } } },
    select: { id: true, businessId: true, scheduledAt: true },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });
  let published = 0;
  const failed: Array<{ pageId: string; error: string }> = [];
  for (const page of due) {
    try {
      await publishPage(page.businessId, page.id, { actorUserId: null, note: `Scheduled publish (${page.scheduledAt?.toISOString() ?? ""})` });
      published++;
    } catch (error) {
      console.error("[schedule] failed to publish page", page.id, error);
      failed.push({ pageId: page.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { published, failed };
}
