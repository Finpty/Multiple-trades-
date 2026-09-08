import type { Prisma } from "@prisma/client";
import { platformDb, prisma, withTenantTransaction, type TenantDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { asObject, toJson } from "@/lib/json";
import { DEFAULT_THEME_TOKENS, ThemeTokensSchema, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";

/**
 * Brand & theme: a business theme is a design family preset plus overrides,
 * stored as draft tokens and published tokens (see src/lib/theme/tokens.ts).
 * Publishing snapshots the draft into a THEME revision so it can be restored.
 */

export interface DesignFamilyView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
  previewImageUrl: string | null;
}

export interface ThemeView {
  draft: ThemeTokens;
  published: ThemeTokens | null;
  publishedAt: string | null;
  updatedAt: string | null;
  designFamilyId: string | null;
  hasUnpublishedChanges: boolean;
  families: DesignFamilyView[];
}

export interface ThemeRevisionView {
  version: number;
  note: string | null;
  createdAt: string;
  author: string | null;
  tokens: ThemeTokens;
}

function parseTokens(raw: unknown): ThemeTokens {
  return mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>(raw ?? null));
}

export async function listDesignFamilies(): Promise<DesignFamilyView[]> {
  const rows = await platformDb.designFamily.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, description: r.description, tokens: parseTokens(r.tokens), previewImageUrl: r.previewImageUrl }));
}

export async function getThemeView(db: TenantDb, businessId: string): Promise<ThemeView> {
  const [theme, families] = await Promise.all([db.businessTheme.findUnique({ where: { businessId } }), listDesignFamilies()]);
  const draft = parseTokens(theme?.draft);
  const published = theme?.published ? parseTokens(theme.published) : null;
  return {
    draft,
    published,
    publishedAt: theme?.publishedAt?.toISOString() ?? null,
    updatedAt: theme?.updatedAt?.toISOString() ?? null,
    designFamilyId: theme?.designFamilyId ?? null,
    hasUnpublishedChanges: !theme?.publishedAt || JSON.stringify(draft) !== JSON.stringify(published),
    families,
  };
}

/** Saves the draft tokens (validated) and the chosen design family. Does not publish. */
export async function saveThemeDraft(db: TenantDb, businessId: string, input: { tokens: unknown; designFamilyId?: string | null }, actorUserId: string | null): Promise<ThemeTokens> {
  const tokens = ThemeTokensSchema.parse(input.tokens);
  let designFamilyId: string | null | undefined = input.designFamilyId;
  if (designFamilyId) {
    const exists = await platformDb.designFamily.findUnique({ where: { id: designFamilyId }, select: { id: true } });
    if (!exists) designFamilyId = null;
  }
  const data: Prisma.BusinessThemeUncheckedUpdateInput = { draft: toJson(tokens) };
  if (designFamilyId !== undefined) data.designFamilyId = designFamilyId;
  await db.businessTheme.upsert({
    where: { businessId },
    create: { businessId, draft: toJson(tokens), designFamilyId: designFamilyId ?? null },
    update: data,
  });
  await recordAudit({ actorUserId, businessId, action: "theme.updated", entityType: "theme", entityId: businessId, metadata: { designFamilyId: designFamilyId ?? null } });
  return tokens;
}

export async function listThemeRevisions(db: TenantDb, businessId: string): Promise<ThemeRevisionView[]> {
  const theme = await db.businessTheme.findUnique({ where: { businessId }, select: { id: true } });
  if (!theme) return [];
  const rows = await db.revision.findMany({ where: { businessId, entityType: "THEME", entityId: theme.id }, orderBy: { version: "desc" }, take: 50 });
  const userIds = [...new Set(rows.map((r) => r.createdByUserId).filter((x): x is string => !!x))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ version: r.version, note: r.note, createdAt: r.createdAt.toISOString(), author: r.createdByUserId ? (names.get(r.createdByUserId) ?? null) : null, tokens: parseTokens(r.snapshot) }));
}

/** Restores a THEME revision into the draft (the current draft is saved as a revision first). */
export async function restoreThemeRevision(businessId: string, version: number, ctx: { actorUserId: string | null }): Promise<void> {
  await withTenantTransaction(businessId, async (tx) => {
    const theme = await tx.businessTheme.findUniqueOrThrow({ where: { businessId } });
    const revision = await tx.revision.findUniqueOrThrow({ where: { businessId_entityType_entityId_version: { businessId, entityType: "THEME", entityId: theme.id, version } } });
    const last = await tx.revision.findFirst({ where: { businessId, entityType: "THEME", entityId: theme.id }, orderBy: { version: "desc" }, select: { version: true } });
    await tx.revision.create({ data: { businessId, entityType: "THEME", entityId: theme.id, version: (last?.version ?? 0) + 1, snapshot: toJson(theme.draft), note: `Auto-saved before restoring v${version}`, createdByUserId: ctx.actorUserId } });
    await tx.businessTheme.update({ where: { businessId }, data: { draft: toJson(parseTokens(revision.snapshot)) } });
    await emitEvent({ type: "theme.restored", businessId, payload: { businessId, version }, actorUserId: ctx.actorUserId }, tx);
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "theme.restored", entityType: "theme", entityId: businessId, metadata: { version } });
}
