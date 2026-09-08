import type { Prisma, TeamMember } from "@prisma/client";
import { z } from "zod";
import type { DbClient } from "@/lib/db";
import { mediaUrls } from "@/lib/media/service";

/** Team members shown by the "team" block and the about page. */

export interface TeamMemberRow {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  mediaId: string | null;
  thumb: string | null;
  isActive: boolean;
  sortOrder: number;
  deletedAt: Date | null;
  updatedAt: Date;
}

export type TeamFilter = "active" | "inactive" | "archived" | "all";

export async function listTeamMembers(db: DbClient, businessId: string, filter: TeamFilter = "all"): Promise<TeamMemberRow[]> {
  const where: Prisma.TeamMemberWhereInput = { businessId };
  if (filter === "archived") where.deletedAt = { not: null };
  else if (filter === "active") where.isActive = true;
  else if (filter === "inactive") where.isActive = false;
  const rows = await db.teamMember.findMany({ where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const mediaIds = rows.map((r) => r.mediaId).filter((x): x is string => !!x);
  const media = mediaIds.length ? await db.media.findMany({ where: { businessId, id: { in: mediaIds } } }) : [];
  const thumbs = new Map<string, string>();
  for (const m of media) thumbs.set(m.id, (await mediaUrls(m)).thumb);
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, email: r.email, phone: r.phone, bio: r.bio, mediaId: r.mediaId, thumb: r.mediaId ? thumbs.get(r.mediaId) ?? null : null, isActive: r.isActive, sortOrder: r.sortOrder, deletedAt: r.deletedAt, updatedAt: r.updatedAt }));
}

const optionalTrimmed = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).optional().or(z.literal("")));

export const TeamMemberInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: optionalTrimmed(120),
  bio: optionalTrimmed(3000),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().email("Enter a valid email").max(200).optional().or(z.literal(""))),
  phone: optionalTrimmed(40),
  mediaId: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable()),
  isActive: z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean()),
});
export type TeamMemberInput = z.infer<typeof TeamMemberInputSchema>;

export class TeamMemberNotFoundError extends Error {
  constructor() {
    super("Team member not found.");
    this.name = "TeamMemberNotFoundError";
  }
}

async function ownedMediaId(db: DbClient, businessId: string, mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null;
  const m = await db.media.findFirst({ where: { id: mediaId, businessId }, select: { id: true } });
  return m?.id ?? null;
}

function toData(input: TeamMemberInput, mediaId: string | null) {
  return { name: input.name, role: input.role || null, bio: input.bio || null, email: input.email || null, phone: input.phone || null, mediaId, isActive: input.isActive };
}

export async function createTeamMember(db: DbClient, businessId: string, input: TeamMemberInput): Promise<TeamMember> {
  const [mediaId, last] = await Promise.all([ownedMediaId(db, businessId, input.mediaId), db.teamMember.findFirst({ where: { businessId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })]);
  return db.teamMember.create({ data: { businessId, ...toData(input, mediaId), sortOrder: (last?.sortOrder ?? -1) + 1 } });
}

export async function updateTeamMember(db: DbClient, businessId: string, id: string, input: TeamMemberInput): Promise<{ before: TeamMember; after: TeamMember }> {
  const before = await db.teamMember.findFirst({ where: { id, businessId } });
  if (!before) throw new TeamMemberNotFoundError();
  const mediaId = await ownedMediaId(db, businessId, input.mediaId);
  const after = await db.teamMember.update({ where: { id }, data: toData(input, mediaId) });
  return { before, after };
}

export async function setTeamMemberActive(db: DbClient, businessId: string, id: string, value: boolean): Promise<TeamMember> {
  const row = await db.teamMember.findFirst({ where: { id, businessId } });
  if (!row) throw new TeamMemberNotFoundError();
  return db.teamMember.update({ where: { id }, data: { isActive: value } });
}

export async function archiveTeamMember(db: DbClient, businessId: string, id: string): Promise<TeamMember> {
  const row = await db.teamMember.findFirst({ where: { id, businessId } });
  if (!row) throw new TeamMemberNotFoundError();
  return db.teamMember.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

export async function restoreTeamMember(db: DbClient, businessId: string, id: string): Promise<TeamMember> {
  const row = await db.teamMember.findFirst({ where: { id, businessId, deletedAt: { not: null } } });
  if (!row) throw new TeamMemberNotFoundError();
  return db.teamMember.update({ where: { id }, data: { deletedAt: null, isActive: true } });
}

export const TeamReorderSchema = z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(100_000) })).max(500);

export async function reorderTeamMembers(db: DbClient, businessId: string, items: z.infer<typeof TeamReorderSchema>): Promise<number> {
  let n = 0;
  for (const it of items) n += (await db.teamMember.updateMany({ where: { id: it.id, businessId }, data: { sortOrder: it.sortOrder } })).count;
  return n;
}
