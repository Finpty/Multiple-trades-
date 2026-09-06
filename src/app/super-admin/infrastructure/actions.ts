"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/authz";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import { processPendingEvents } from "@/lib/events";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { purgeExpiredRateLimits } from "@/lib/auth/rate-limit";
import { resetFailedEvents } from "@/lib/platform/stats";

function revalidate() {
  revalidatePath("/super-admin/infrastructure");
  revalidatePath("/super-admin");
}

export async function processPendingEventsAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const { processed } = await processPendingEvents(200);
    await recordAudit({ actorUserId: user.id, action: "infrastructure.events.processed", entityType: "domain_event", severity: "NOTICE", metadata: { processed } });
    revalidate();
    return ok(undefined, processed ? `Processed ${processed} event${processed === 1 ? "" : "s"}.` : "No pending events to process.");
  });
}

export async function retryFailedEventsAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const reset = await resetFailedEvents();
    const { processed } = reset ? await processPendingEvents(200) : { processed: 0 };
    await recordAudit({ actorUserId: user.id, action: "infrastructure.events.retried", entityType: "domain_event", severity: "NOTICE", metadata: { reset, processed } });
    revalidate();
    return ok(undefined, reset ? `Re-queued ${reset} failed event${reset === 1 ? "" : "s"} and processed ${processed}.` : "No failed events to retry.");
  });
}

export async function purgeSessionsAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const count = await purgeExpiredSessions();
    await recordAudit({ actorUserId: user.id, action: "infrastructure.sessions.purged", entityType: "session", severity: "NOTICE", metadata: { count } });
    revalidate();
    return ok(undefined, `Removed ${count} expired session${count === 1 ? "" : "s"}.`);
  });
}

export async function purgeRateLimitsAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const count = await purgeExpiredRateLimits();
    await recordAudit({ actorUserId: user.id, action: "infrastructure.rate_limits.purged", entityType: "rate_limit_bucket", severity: "INFO", metadata: { count } });
    revalidate();
    return ok(undefined, `Removed ${count} expired rate-limit bucket${count === 1 ? "" : "s"}.`);
  });
}
