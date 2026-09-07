import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { toJson } from "@/lib/json";

/** Message helpers: internal notes and outbound emails linked to a lead and/or customer. */

export const NoteSchema = z.object({ body: z.string().trim().min(1, "Write something first.").max(10_000) });
export const EmailSchema = z.object({
  to: z.string().trim().email("Enter a valid email address."),
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().trim().min(1, "Message body is required.").max(20_000),
});

export interface MessageTarget {
  leadId?: string | null;
  customerId?: string | null;
}

export async function addNote(db: TenantDb, businessId: string, target: MessageTarget, body: string, actorUserId: string, actorName: string) {
  return db.message.create({
    data: { businessId, leadId: target.leadId ?? null, customerId: target.customerId ?? null, channel: "NOTE", direction: "INTERNAL", body, status: "saved", metadata: toJson({ actorUserId, actorName }), sentAt: new Date() },
  });
}

/** Sends an email (best effort) and records it on the timeline. */
export async function sendEmailMessage(db: TenantDb, businessId: string, target: MessageTarget, input: z.infer<typeof EmailSchema>, from: { actorUserId: string; actorName: string; fromAddress: string | null }) {
  await sendMail({ to: input.to, subject: input.subject, text: input.body, from: from.fromAddress ?? undefined });
  return db.message.create({
    data: { businessId, leadId: target.leadId ?? null, customerId: target.customerId ?? null, channel: "EMAIL", direction: "OUTBOUND", subject: input.subject, body: input.body, toAddress: input.to, fromAddress: from.fromAddress, status: "sent", metadata: toJson({ actorUserId: from.actorUserId, actorName: from.actorName }), sentAt: new Date() },
  });
}

/** Structural client type so both transaction clients and RLS-scoped clients are accepted. */
type MessageWriter = { message: { create: (args: { data: Prisma.MessageUncheckedCreateInput }) => Promise<unknown> } };

export async function addSystemMessage(db: MessageWriter, businessId: string, target: MessageTarget, body: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await db.message.create({ data: { businessId, leadId: target.leadId ?? null, customerId: target.customerId ?? null, channel: "SYSTEM", direction: "INTERNAL", body, status: "saved", metadata: toJson(metadata), sentAt: new Date() } });
}

export async function listMessages(db: TenantDb, businessId: string, target: MessageTarget, take = 200) {
  const or: Prisma.MessageWhereInput[] = [];
  if (target.leadId) or.push({ leadId: target.leadId });
  if (target.customerId) or.push({ customerId: target.customerId });
  if (or.length === 0) return [];
  return db.message.findMany({ where: { businessId, OR: or }, orderBy: { createdAt: "desc" }, take });
}
