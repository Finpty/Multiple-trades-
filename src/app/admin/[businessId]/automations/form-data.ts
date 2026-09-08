import type { BusinessContext } from "@/lib/authz";
import { listBusinessMembers } from "@/lib/crm/members";
import { LEAD_STATUSES } from "@/lib/crm/leads";
import { AUTOMATION_ACTION_TYPES } from "@/lib/automation/actions";

export async function loadAutomationFormData(ctx: BusinessContext) {
  const members = await listBusinessMembers(ctx.business.id);
  return { actionTypes: AUTOMATION_ACTION_TYPES, members: members.map((m) => ({ id: m.id, name: m.name })), leadStatuses: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })) };
}
