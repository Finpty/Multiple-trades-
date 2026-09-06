import type { DomainEventEnvelope } from "@/lib/events";
import { platformDb, tenantDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { toJson } from "@/lib/json";

/** Action catalogue exposed in the automation builder UI. */
export type AutomationAction =
  | { type: "create_task"; title: string; description?: string; dueInDays?: number; assignToUserId?: string | null }
  | { type: "notify_user"; userId?: string | null; useAssignedUser?: boolean; title: string; body?: string }
  | { type: "send_email"; to: string; subject: string; body: string }
  | { type: "create_project_from_quote" }
  | { type: "update_lead_status"; status: string }
  | { type: "request_review"; delayDays?: number }
  | { type: "log_message"; body: string };

export const AUTOMATION_ACTION_TYPES: Array<{ type: AutomationAction["type"]; label: string; description: string }> = [
  { type: "create_task", label: "Create task", description: "Create a follow-up task, optionally assigned." },
  { type: "notify_user", label: "Notify user", description: "Send an in-app notification to a team member." },
  { type: "send_email", label: "Send email", description: "Send an email to a fixed address or a template variable." },
  { type: "create_project_from_quote", label: "Create project from quote", description: "When a quote is accepted, open a project and a job." },
  { type: "update_lead_status", label: "Update lead status", description: "Move the lead to a given status." },
  { type: "request_review", label: "Request review", description: "Email the customer asking for a review." },
  { type: "log_message", label: "Log note", description: "Add an internal note to the record timeline." },
];

export interface ActionContext {
  event: DomainEventEnvelope;
  businessId: string;
  ruleId: string;
}

function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = key.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), payload);
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function executeAutomationAction(action: AutomationAction, ctx: ActionContext): Promise<unknown> {
  const db = tenantDb(ctx.businessId);
  const payload = ctx.event.payload as Record<string, unknown>;
  switch (action.type) {
    case "create_task": {
      const dueAt = action.dueInDays ? new Date(Date.now() + action.dueInDays * 86_400_000) : null;
      const task = await db.task.create({
        data: {
          businessId: ctx.businessId,
          title: interpolate(action.title, payload),
          description: action.description ? interpolate(action.description, payload) : null,
          dueAt,
          assignedToUserId: action.assignToUserId ?? (typeof payload.assignedToUserId === "string" ? payload.assignedToUserId : null),
          jobId: typeof payload.jobId === "string" ? payload.jobId : null,
          leadId: typeof payload.leadId === "string" ? payload.leadId : null,
          customerId: typeof payload.customerId === "string" ? payload.customerId : null,
          source: `automation:${ctx.ruleId}`,
        },
      });
      return { taskId: task.id };
    }
    case "notify_user": {
      const userId = action.useAssignedUser && typeof payload.assignedToUserId === "string" ? payload.assignedToUserId : action.userId;
      if (!userId) return { skipped: "no user" };
      const n = await platformDb.notification.create({
        data: {
          userId,
          businessId: ctx.businessId,
          type: ctx.event.type,
          title: interpolate(action.title, payload),
          body: action.body ? interpolate(action.body, payload) : null,
          data: toJson(payload),
        },
      });
      return { notificationId: n.id };
    }
    case "send_email": {
      const to = interpolate(action.to, payload);
      if (!to) return { skipped: "no recipient" };
      await sendMail({ to, subject: interpolate(action.subject, payload), text: interpolate(action.body, payload) });
      return { sent: to };
    }
    case "update_lead_status": {
      if (typeof payload.leadId !== "string") return { skipped: "no lead" };
      await db.lead.update({ where: { id: payload.leadId }, data: { status: action.status as never } });
      return { leadId: payload.leadId, status: action.status };
    }
    case "create_project_from_quote": {
      if (typeof payload.quoteId !== "string") return { skipped: "no quote" };
      const { createJobFromQuote } = await import("@/lib/operations/jobs");
      const job = await createJobFromQuote(ctx.businessId, payload.quoteId, { actorUserId: null });
      return { jobId: job.id };
    }
    case "request_review": {
      const customerId = typeof payload.customerId === "string" ? payload.customerId : null;
      if (!customerId) return { skipped: "no customer" };
      const customer = await db.customer.findUnique({ where: { id: customerId } });
      if (!customer?.email) return { skipped: "no email" };
      const business = await platformDb.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } });
      await sendMail({
        to: customer.email,
        subject: `How did we do? — ${business?.name ?? "Your recent project"}`,
        text: `Hi ${customer.firstName},\n\nThanks for choosing ${business?.name ?? "us"}. We'd love a quick review of your experience.`,
      });
      await db.message.create({
        data: { businessId: ctx.businessId, customerId, channel: "EMAIL", direction: "OUTBOUND", subject: "Review request", body: "Automated review request sent.", toAddress: customer.email, sentAt: new Date() },
      });
      return { sent: customer.email };
    }
    case "log_message": {
      const m = await db.message.create({
        data: {
          businessId: ctx.businessId,
          customerId: typeof payload.customerId === "string" ? payload.customerId : null,
          leadId: typeof payload.leadId === "string" ? payload.leadId : null,
          channel: "NOTE",
          direction: "INTERNAL",
          body: interpolate(action.body, payload),
          metadata: { automationRuleId: ctx.ruleId },
        },
      });
      return { messageId: m.id };
    }
    default:
      return { skipped: "unknown action" };
  }
}
