import { z } from "zod";
import { platformDb, prisma, type TenantDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createInviteToken } from "@/lib/auth/service";
import { sendMail } from "@/lib/mail";

export const InviteSchema = z.object({ email: z.string().trim().email(), name: z.string().trim().max(120).optional(), roleId: z.string().uuid() });

export async function listBusinessRoles() {
  return prisma.role.findMany({ where: { scope: "BUSINESS" }, orderBy: { name: "asc" } });
}

export async function listMembers(db: TenantDb, businessId: string) {
  return db.businessMembership.findMany({ where: { businessId }, include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true, status: true, platformRole: true } }, role: true }, orderBy: { createdAt: "asc" } });
}

export async function inviteMember(db: TenantDb, business: { id: string; name: string }, input: z.infer<typeof InviteSchema>, actorUserId: string): Promise<{ userId: string; created: boolean }> {
  const email = input.email.toLowerCase();
  const role = await prisma.role.findFirst({ where: { id: input.roleId, scope: "BUSINESS" } });
  if (!role) throw new Error("Choose a valid role.");
  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;
  if (!user) {
    user = await prisma.user.create({ data: { email, name: input.name || email.split("@")[0], status: "INVITED" } });
    created = true;
  }
  const existing = await db.businessMembership.findUnique({ where: { businessId_userId: { businessId: business.id, userId: user.id } } });
  if (existing && existing.status === "ACTIVE") throw new Error("This person is already a member.");
  const needsInvite = user.status === "INVITED" || !user.passwordHash;
  await db.businessMembership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    create: { businessId: business.id, userId: user.id, roleId: role.id, status: needsInvite ? "INVITED" : "ACTIVE", invitedByUserId: actorUserId, invitedAt: new Date(), acceptedAt: needsInvite ? null : new Date() },
    update: { roleId: role.id, status: needsInvite ? "INVITED" : "ACTIVE", invitedByUserId: actorUserId, invitedAt: new Date() },
  });
  const url = needsInvite ? await createInviteToken(email, { businessId: business.id, roleId: role.id }) : null;
  await sendMail({ to: email, subject: `You've been invited to ${business.name}`, text: needsInvite ? `Hi ${user.name},\n\nYou've been invited to manage ${business.name} as ${role.name}. Accept the invitation and set your password here:\n${url}\n\nThe link expires in 7 days.` : `Hi ${user.name},\n\nYou now have ${role.name} access to ${business.name}. Sign in to get started.` });
  await recordAudit({ actorUserId, businessId: business.id, action: "membership.invited", entityType: "business_membership", entityId: user.id, severity: "NOTICE", after: { email, role: role.key } });
  return { userId: user.id, created };
}

export async function changeMemberRole(db: TenantDb, businessId: string, membershipId: string, roleId: string, actorUserId: string): Promise<void> {
  const [m, role] = await Promise.all([db.businessMembership.findFirstOrThrow({ where: { id: membershipId, businessId }, include: { role: true } }), prisma.role.findFirst({ where: { id: roleId, scope: "BUSINESS" } })]);
  if (!role) throw new Error("Choose a valid role.");
  if (m.role.key === "business_owner" && role.key !== "business_owner") {
    const owners = await db.businessMembership.count({ where: { businessId, status: "ACTIVE", role: { key: "business_owner" } } });
    if (owners <= 1) throw new Error("A business must keep at least one owner.");
  }
  await db.businessMembership.update({ where: { id: membershipId }, data: { roleId } });
  await recordAudit({ actorUserId, businessId, action: "membership.role_changed", entityType: "business_membership", entityId: membershipId, severity: "CRITICAL", before: { role: m.role.key }, after: { role: role.key } });
}

export async function setMemberStatus(db: TenantDb, businessId: string, membershipId: string, status: "ACTIVE" | "SUSPENDED", actorUserId: string): Promise<void> {
  const m = await db.businessMembership.findFirstOrThrow({ where: { id: membershipId, businessId }, include: { role: true } });
  if (status === "SUSPENDED" && m.role.key === "business_owner") {
    const owners = await db.businessMembership.count({ where: { businessId, status: "ACTIVE", role: { key: "business_owner" } } });
    if (owners <= 1) throw new Error("A business must keep at least one active owner.");
  }
  await db.businessMembership.update({ where: { id: membershipId }, data: { status } });
  await recordAudit({ actorUserId, businessId, action: status === "ACTIVE" ? "membership.reactivated" : "membership.suspended", entityType: "business_membership", entityId: membershipId, severity: "NOTICE" });
}

export async function removeMember(db: TenantDb, businessId: string, membershipId: string, actorUserId: string): Promise<void> {
  const m = await db.businessMembership.findFirstOrThrow({ where: { id: membershipId, businessId }, include: { role: true, user: { select: { email: true } } } });
  if (m.role.key === "business_owner") {
    const owners = await db.businessMembership.count({ where: { businessId, status: "ACTIVE", role: { key: "business_owner" } } });
    if (owners <= 1) throw new Error("A business must keep at least one owner.");
  }
  await db.businessMembership.delete({ where: { id: membershipId } });
  await recordAudit({ actorUserId, businessId, action: "membership.removed", entityType: "business_membership", entityId: membershipId, severity: "CRITICAL", before: { email: m.user.email, role: m.role.key } });
}

export async function resendInvite(db: TenantDb, business: { id: string; name: string }, membershipId: string, actorUserId: string): Promise<void> {
  const m = await db.businessMembership.findFirstOrThrow({ where: { id: membershipId, businessId: business.id }, include: { user: true, role: true } });
  const url = await createInviteToken(m.user.email, { businessId: business.id, roleId: m.roleId });
  await sendMail({ to: m.user.email, subject: `Reminder: your invitation to ${business.name}`, text: `Hi ${m.user.name},\n\nAccept your invitation to ${business.name} (${m.role.name}):\n${url}` });
  await recordAudit({ actorUserId, businessId: business.id, action: "membership.invite_resent", entityType: "business_membership", entityId: membershipId });
  void platformDb;
}
