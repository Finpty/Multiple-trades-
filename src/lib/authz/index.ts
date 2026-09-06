import { redirect } from "next/navigation";
import { cache } from "react";
import type { Business, PlatformRole } from "@prisma/client";
import { platformDb, prisma, tenantDb, type TenantDb } from "@/lib/db";
import { getCurrentSession, type SessionUser } from "@/lib/auth/session";
import { asArray } from "@/lib/json";
import type { Permission } from "./permissions";

export * from "./permissions";

export class AuthorizationError extends Error {
  readonly status: number;
  constructor(message = "You do not have permission to do that.", status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

const PLATFORM_ROLE_RANK: Record<PlatformRole, number> = { NONE: 0, SUPPORT: 1, ADMIN: 2, OWNER: 3 };

export function hasPlatformRole(user: Pick<SessionUser, "platformRole">, minimum: PlatformRole): boolean {
  return PLATFORM_ROLE_RANK[user.platformRole] >= PLATFORM_ROLE_RANK[minimum];
}

export function isPlatformAdmin(user: Pick<SessionUser, "platformRole"> | null | undefined): boolean {
  return !!user && hasPlatformRole(user, "ADMIN");
}

/** Signed-in user or redirect to login. For pages. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const { user } = await getCurrentSession();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return user;
}

/** Signed-in user or throw. For server actions / route handlers. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const { user } = await getCurrentSession();
  if (!user) throw new AuthorizationError("Sign in required.", 401);
  return user;
}

export interface PlatformContext {
  user: SessionUser;
  db: typeof platformDb;
}

/**
 * Super Admin gate. Platform roles are a column on the user, never derived
 * from any organisation or business membership, so a tenant admin can never
 * escalate to platform access by editing their own business.
 */
export async function requirePlatformAdmin(minimum: PlatformRole = "ADMIN", opts: { redirectTo?: string; throwOnly?: boolean } = {}): Promise<PlatformContext> {
  const { user } = await getCurrentSession();
  if (!user) {
    if (opts.throwOnly) throw new AuthorizationError("Sign in required.", 401);
    redirect(`/login?next=${encodeURIComponent(opts.redirectTo ?? "/super-admin")}`);
  }
  if (!hasPlatformRole(user, minimum)) {
    if (opts.throwOnly) throw new AuthorizationError("Platform access required.");
    redirect("/admin");
  }
  return { user, db: platformDb };
}

export interface BusinessAccess {
  business: Business;
  permissions: Set<Permission>;
  roleKey: string;
  viaPlatform: boolean;
}

/**
 * Resolves what a user may do inside one business. Precedence:
 *  1. Platform ADMIN/OWNER → all permissions (audited as an override).
 *  2. Business membership role.
 *  3. Organisation membership role (org roles carry business permissions).
 * Suspended/invited memberships grant nothing. Never trusts client input.
 */
export const getBusinessAccess = cache(async (userId: string, businessId: string): Promise<BusinessAccess | null> => {
  const [user, business] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true, status: true } }),
    prisma.business.findFirst({ where: { id: businessId, deletedAt: null } }),
  ]);
  if (!user || user.status !== "ACTIVE" || !business) return null;

  if (hasPlatformRole(user, "ADMIN")) {
    const { ALL_BUSINESS_PERMISSIONS } = await import("./permissions");
    return { business, permissions: new Set(ALL_BUSINESS_PERMISSIONS), roleKey: "platform_admin", viaPlatform: true };
  }

  const membership = await prisma.businessMembership.findUnique({
    where: { businessId_userId: { businessId, userId } },
    include: { role: true },
  });
  if (membership && membership.status === "ACTIVE") {
    return { business, permissions: new Set(asArray<Permission>(membership.role.permissions)), roleKey: membership.role.key, viaPlatform: false };
  }

  const orgMembership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: business.organizationId, userId } },
    include: { role: true },
  });
  if (orgMembership && orgMembership.status === "ACTIVE") {
    const perms = asArray<Permission>(orgMembership.role.permissions).filter((p) => !p.startsWith("org."));
    if (perms.length === 0) return null;
    return { business, permissions: new Set(perms), roleKey: orgMembership.role.key, viaPlatform: false };
  }
  return null;
});

export interface BusinessContext extends BusinessAccess {
  user: SessionUser;
  /** RLS-scoped client for this business. Use it for every tenant query. */
  db: TenantDb;
  businessId: string;
  can(permission: Permission): boolean;
}

/**
 * The single entry point for tenant-scoped pages, server actions and route
 * handlers. Returns a context bundling the user, the business and an
 * RLS-scoped database client. Throws or redirects when access is missing.
 */
export async function requireBusinessAccess(
  businessId: string,
  permission?: Permission,
  opts: { throwOnly?: boolean } = {},
): Promise<BusinessContext> {
  const { user } = await getCurrentSession();
  if (!user) {
    if (opts.throwOnly) throw new AuthorizationError("Sign in required.", 401);
    redirect(`/login?next=${encodeURIComponent(`/admin/${businessId}`)}`);
  }
  const access = await getBusinessAccess(user.id, businessId);
  if (!access) {
    if (opts.throwOnly) throw new AuthorizationError("You do not have access to this business.", 404);
    redirect("/admin");
  }
  if (permission && !access.permissions.has(permission)) {
    if (opts.throwOnly) throw new AuthorizationError();
    redirect(`/admin/${businessId}?denied=${encodeURIComponent(permission)}`);
  }
  return {
    ...access,
    user,
    businessId,
    db: tenantDb(businessId),
    can: (p: Permission) => access.permissions.has(p),
  };
}

/** Businesses the user can open in the admin (for switchers & the /admin home). */
export async function listAccessibleBusinesses(user: SessionUser) {
  if (hasPlatformRole(user, "ADMIN")) {
    return platformDb.business.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, include: { industry: true } });
  }
  const [direct, orgs] = await Promise.all([
    prisma.businessMembership.findMany({ where: { userId: user.id, status: "ACTIVE" }, select: { businessId: true } }),
    prisma.organizationMembership.findMany({ where: { userId: user.id, status: "ACTIVE" }, include: { role: true } }),
  ]);
  const orgIds = orgs.filter((m) => asArray<string>(m.role.permissions).some((p) => !p.startsWith("org."))).map((m) => m.organizationId);
  return platformDb.business.findMany({
    where: { deletedAt: null, OR: [{ id: { in: direct.map((d) => d.businessId) } }, { organizationId: { in: orgIds } }] },
    orderBy: { name: "asc" },
    include: { industry: true },
  });
}
