import type { Prisma } from "@prisma/client";
import { asArray } from "@/lib/json";
import { AUTOMATION_ACTION_TYPES, type AutomationAction } from "@/lib/automation/actions";

/** One-line description of a rule's actions for lists and audit. */
export function summariseAutomationActions(raw: Prisma.JsonValue): string {
  const actions = asArray<AutomationAction>(raw);
  if (actions.length === 0) return "do nothing";
  return actions.map((a) => {
    const label = AUTOMATION_ACTION_TYPES.find((t) => t.type === a.type)?.label ?? a.type;
    switch (a.type) {
      case "create_task": return `${label} “${a.title}”`;
      case "send_email": return `${label} to ${a.to}`;
      case "update_lead_status": return `${label} → ${a.status}`;
      case "notify_user": return `${label} “${a.title}”`;
      default: return label;
    }
  }).join(", ");
}
