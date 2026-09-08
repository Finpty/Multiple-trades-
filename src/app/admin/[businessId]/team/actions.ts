"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { TeamMemberInputSchema, TeamReorderSchema, archiveTeamMember, createTeamMember, reorderTeamMembers, restoreTeamMember, setTeamMemberActive, updateTeamMember } from "@/lib/content/team";

const base = (b: string) => `/admin/${b}/team`;
function idOf(v: unknown, what: string): string {
  const s = str(v);
  if (!isUuid(s)) throw new z.ZodError([{ code: "custom", path: [what], message: `Invalid ${what}.` }]);
  return s;
}

export async function saveTeamMemberAction(_prev: ActionResult<{ id: string; created: boolean }> | undefined, formData: FormData): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAction<{ id: string; created: boolean }>(async () => {
    const businessId = idOf(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const obj = formToObject(formData);
    const memberId = str(obj.memberId) ? idOf(obj.memberId, "member") : null;
    const input = TeamMemberInputSchema.parse(obj);
    if (!memberId) {
      const m = await createTeamMember(ctx.db, businessId, input);
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "team_member.created", entityType: "team_member", entityId: m.id, after: m });
      revalidatePath(base(businessId));
      return ok({ id: m.id, created: true }, "Team member added.");
    }
    const { before, after } = await updateTeamMember(ctx.db, businessId, memberId, input);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "team_member.updated", entityType: "team_member", entityId: memberId, before, after });
    revalidatePath(base(businessId));
    revalidatePath(`${base(businessId)}/${memberId}`);
    return ok({ id: memberId, created: false }, "Saved.");
  });
}

export async function teamMemberStateAction(businessId: string, memberId: string, state: "activate" | "deactivate" | "archive" | "restore"): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const id = idOf(memberId, "member");
    const row = state === "archive" ? await archiveTeamMember(ctx.db, businessId, id) : state === "restore" ? await restoreTeamMember(ctx.db, businessId, id) : await setTeamMemberActive(ctx.db, businessId, id, state === "activate");
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: `team_member.${state}d`.replace("dd", "d"), entityType: "team_member", entityId: id, after: { isActive: row.isActive, deletedAt: row.deletedAt } });
    revalidatePath(base(businessId));
    return ok(undefined, { activate: "Shown on the website.", deactivate: "Hidden from the website.", archive: "Archived.", restore: "Restored." }[state]);
  });
}

export async function reorderTeamAction(businessId: string, items: Array<{ id: string; sortOrder: number }>): Promise<ActionResult<{ count: number }>> {
  return runAction<{ count: number }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const count = await reorderTeamMembers(ctx.db, businessId, TeamReorderSchema.parse(items));
    revalidatePath(base(businessId));
    return ok({ count });
  });
}
