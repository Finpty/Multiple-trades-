import { tenantDb } from "@/lib/db";
import { asArray } from "@/lib/json";
import type { SiteContext } from "@/lib/tenant/resolve";

export interface SiteProcessStep {
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

/** Stages of the default workflow (else the first workflow) as process steps. */
export async function loadWorkflowSteps(ctx: SiteContext): Promise<SiteProcessStep[]> {
  const db = tenantDb(ctx.business.id);
  const wf = await db.workflow.findFirst({ where: { businessId: ctx.business.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  if (!wf) return [];
  return asArray<Record<string, unknown>>(wf.stages)
    .filter((s) => s && typeof s === "object" && typeof s.name === "string")
    .map((s) => ({
      title: String(s.name),
      description: typeof s.description === "string" && s.description ? s.description : null,
      icon: typeof s.icon === "string" ? s.icon : null,
      color: typeof s.color === "string" ? s.color : null,
    }));
}
