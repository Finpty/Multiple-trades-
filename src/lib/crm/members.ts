import { prisma } from "@/lib/db";

export interface MemberOption {
  id: string;
  name: string;
  email: string;
}

/** Active members of a business (assignee dropdowns). Membership rows are platform-level, so read via the base client filtered by businessId. */
export async function listBusinessMembers(businessId: string): Promise<MemberOption[]> {
  const rows = await prisma.businessMembership.findMany({
    where: { businessId, status: "ACTIVE", user: { deletedAt: null, status: "ACTIVE" } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.user.id, name: r.user.name, email: r.user.email }));
}

export async function memberNameMap(businessId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const m of await listBusinessMembers(businessId)) out[m.id] = m.name;
  return out;
}
