import type { TenantDb } from "@/lib/db";

export interface MemberOption {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Active business members that can be assigned jobs, tasks and bookings. */
export async function listMembers(db: TenantDb, businessId: string): Promise<MemberOption[]> {
  const rows = await db.businessMembership.findMany({
    where: { businessId, status: "ACTIVE", user: { status: "ACTIVE", deletedAt: null } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.user.id, name: r.user.name, email: r.user.email, initials: initialsOf(r.user.name) }));
}

/** Members plus the current user (a platform admin acting inside the business is not a member). */
export async function listAssignees(db: TenantDb, businessId: string, current: { id: string; name: string; email: string }): Promise<MemberOption[]> {
  const members = await listMembers(db, businessId);
  if (members.some((m) => m.id === current.id)) return members;
  return [{ id: current.id, name: current.name, email: current.email, initials: initialsOf(current.name) }, ...members];
}

export function memberById(members: MemberOption[], id: string | null | undefined): MemberOption | null {
  if (!id) return null;
  return members.find((m) => m.id === id) ?? null;
}
