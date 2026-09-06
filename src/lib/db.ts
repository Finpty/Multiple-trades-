import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Database access layer.
 *
 * Three clients exist on purpose:
 *
 *  • `prisma`      – raw client. PostgreSQL Row Level Security is FORCED on every
 *                    tenant table, so this client sees NO tenant rows unless a
 *                    tenant/bypass setting is applied. Use it only for
 *                    platform-wide tables (users, sessions, industries, ...).
 *
 *  • `tenantDb(id)` – scoped to one business. Sets `app.current_business_id`
 *                    for every query so RLS restricts reads AND writes to that
 *                    business. This is the default client for all tenant code.
 *
 *  • `platformDb`  – sets `app.bypass_rls = on`. Only for code that has already
 *                    passed `requirePlatformAdmin()` or for trusted system jobs
 *                    (seeding, cross-tenant maintenance, audit writes).
 *
 * Soft delete: models with a `deletedAt` column automatically exclude deleted
 * rows from find, count and aggregate queries unless `deletedAt` is mentioned in
 * `where` explicitly (e.g. `{ deletedAt: { not: null } }` to list archived).
 */

const globalForPrisma = globalThis as unknown as { __tradeonePrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__tradeonePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__tradeonePrisma = prisma;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOFT_DELETE_MODELS = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "deletedAt"))
    .map((m) => m.name),
);

const SOFT_DELETE_READ_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

type AnyArgs = { where?: Record<string, unknown> } & Record<string, unknown>;

function applySoftDelete(model: string, operation: string, args: AnyArgs): AnyArgs {
  if (!SOFT_DELETE_MODELS.has(model) || !SOFT_DELETE_READ_OPS.has(operation)) return args;
  const where = args.where ?? {};
  if (Object.prototype.hasOwnProperty.call(where, "deletedAt")) return args;
  return { ...args, where: { ...where, deletedAt: null } };
}

function rlsExtension(setting: { key: "app.current_business_id" | "app.bypass_rls"; value: string }) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: `rls:${setting.key}`,
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const finalArgs = applySoftDelete(model, operation, args as AnyArgs);
            // Batch transaction: set_config(..., true) is transaction-local, so the
            // setting applies exactly to the query that follows and nothing else.
            const [, result] = await prisma.$transaction([
              prisma.$executeRaw`SELECT set_config(${setting.key}, ${setting.value}, TRUE)`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              query(finalArgs as any),
            ]);
            return result;
          },
        },
      },
    }),
  );
}

const tenantClientCache = new Map<string, ReturnType<typeof buildTenantClient>>();

function buildTenantClient(businessId: string) {
  return prisma.$extends(rlsExtension({ key: "app.current_business_id", value: businessId }));
}

/** Client whose every query is restricted to one business by RLS. */
export function tenantDb(businessId: string) {
  if (!UUID_RE.test(businessId)) throw new Error("tenantDb: businessId must be a uuid");
  let client = tenantClientCache.get(businessId);
  if (!client) {
    client = buildTenantClient(businessId);
    if (tenantClientCache.size > 500) tenantClientCache.clear();
    tenantClientCache.set(businessId, client);
  }
  return client;
}

export type TenantDb = ReturnType<typeof tenantDb>;

/** Client that bypasses RLS. Only use after platform authorization or in trusted jobs. */
export const platformDb = prisma.$extends(rlsExtension({ key: "app.bypass_rls", value: "on" }));
export type PlatformDb = typeof platformDb;

/** Any client accepted by shared service functions. */
export type DbClient = TenantDb | PlatformDb;

/**
 * Interactive transaction scoped to one business. Inside `fn`, `tx` is a plain
 * transaction client whose connection already carries the tenant setting.
 */
export async function withTenantTransaction<T>(
  businessId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number },
): Promise<T> {
  if (!UUID_RE.test(businessId)) throw new Error("withTenantTransaction: businessId must be a uuid");
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_business_id', ${businessId}, TRUE)`;
      return fn(tx);
    },
    { timeout: options?.timeout ?? 30_000 },
  );
}

/** Interactive transaction with RLS bypass. Platform/system code only. */
export async function withPlatformTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number },
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
      return fn(tx);
    },
    { timeout: options?.timeout ?? 60_000 },
  );
}

export { Prisma };
