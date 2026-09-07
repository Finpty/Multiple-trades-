"use server";

import { requireBusinessAccess } from "@/lib/authz";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { exportBusiness, exportFilename } from "@/lib/business/export";
import { recordAudit } from "@/lib/audit";

export async function exportBusinessAction(businessId: string): Promise<ActionResult<{ filename: string; json: string }>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "export.manage", { throwOnly: true });
    const snapshot = await exportBusiness(businessId);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "business.exported", entityType: "business", entityId: businessId, severity: "NOTICE" });
    return ok({ filename: exportFilename(snapshot), json: JSON.stringify(snapshot, null, 2) });
  });
}
