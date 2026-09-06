/**
 * Foundation verification: proves tenant isolation, soft-delete guards, auth
 * primitives and the publish pipeline against the real PostgreSQL database.
 * Run: pnpm exec tsx scripts/verify-foundation.ts
 */
import "dotenv/config";
import { platformDb, prisma, tenantDb } from "../src/lib/db";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { createSession, validateSessionToken, invalidateAllUserSessions } from "../src/lib/auth/session";
import { decryptSecret, encryptSecret } from "../src/lib/crypto";
import { evaluateConditions } from "../src/lib/rules/conditions";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`ok - ${msg}`);
}

async function main() {
  const [kabura, elite] = await Promise.all([
    platformDb.business.findUniqueOrThrow({ where: { slug: "kabura" } }),
    platformDb.business.findUniqueOrThrow({ where: { slug: "elite-plumbing" } }),
  ]);

  // 1. RLS: raw client sees no tenant rows at all (fail closed)
  const rawPages = await prisma.page.count();
  assert(rawPages === 0, `raw client sees 0 pages under forced RLS (saw ${rawPages})`);

  // 2. Tenant clients see only their own rows
  const kPages = await tenantDb(kabura.id).page.count();
  const ePages = await tenantDb(elite.id).page.count();
  const allPages = await platformDb.page.count();
  assert(kPages > 0 && ePages > 0, `tenant clients see their own pages (kabura=${kPages}, elite=${ePages})`);
  assert(kPages + ePages === allPages, `tenant page counts sum to platform total (${allPages})`);
  const leak = await tenantDb(kabura.id).page.findMany({ where: { businessId: elite.id } });
  assert(leak.length === 0, "kabura client cannot read elite pages even when asking explicitly");

  // 3. RLS blocks cross-tenant writes
  let writeBlocked = false;
  try {
    await tenantDb(kabura.id).service.create({ data: { businessId: elite.id, name: "Leak", slug: "leak-test" } });
  } catch {
    writeBlocked = true;
  }
  assert(writeBlocked, "kabura client cannot insert a service owned by elite");

  // 4. Soft delete guard
  const svc = await tenantDb(kabura.id).service.findFirstOrThrow({ where: { businessId: kabura.id } });
  await tenantDb(kabura.id).service.update({ where: { id: svc.id }, data: { deletedAt: new Date() } });
  const visible = await tenantDb(kabura.id).service.findUnique({ where: { id: svc.id } });
  const archived = await tenantDb(kabura.id).service.findFirst({ where: { id: svc.id, deletedAt: { not: null } } });
  assert(visible === null && archived !== null, "soft-deleted service is hidden by default and visible when asked for");
  await tenantDb(kabura.id).service.update({ where: { id: svc.id }, data: { deletedAt: null } });

  // 5. Publish pipeline produced snapshots + revisions
  const home = await tenantDb(kabura.id).page.findFirstOrThrow({ where: { businessId: kabura.id, systemKey: "home" } });
  assert(home.status === "PUBLISHED" && home.published !== null, "home page published with snapshot");
  const revisions = await tenantDb(kabura.id).revision.count({ where: { entityType: "PAGE", entityId: home.id } });
  assert(revisions >= 1, `home page has ${revisions} revision(s)`);
  const theme = await tenantDb(kabura.id).businessTheme.findUniqueOrThrow({ where: { businessId: kabura.id } });
  assert(theme.published !== null, "theme published");

  // 6. Generated configuration
  const [services, fields, pricing, forms, menus, workflows, features, areas, rules] = await Promise.all([
    tenantDb(kabura.id).service.count(),
    tenantDb(kabura.id).customFieldDefinition.count(),
    tenantDb(kabura.id).pricingItem.count(),
    tenantDb(kabura.id).form.count(),
    tenantDb(kabura.id).navigationMenu.count(),
    tenantDb(kabura.id).workflow.count(),
    tenantDb(kabura.id).businessFeature.count({ where: { isEnabled: true } }),
    tenantDb(kabura.id).serviceArea.count(),
    tenantDb(kabura.id).automationRule.count(),
  ]);
  assert(services >= 5 && fields >= 5 && pricing >= 8 && forms === 2 && menus === 2 && workflows === 1 && features >= 5 && areas >= 5 && rules === 3, `kabura generated: services=${services} fields=${fields} pricing=${pricing} forms=${forms} menus=${menus} workflows=${workflows} features=${features} areas=${areas} automations=${rules}`);

  // 7. Auth primitives
  const hash = await hashPassword("correct horse battery staple");
  assert(await verifyPassword(hash, "correct horse battery staple"), "argon2id verifies the right password");
  assert(!(await verifyPassword(hash, "wrong")), "argon2id rejects the wrong password");
  const owner = await prisma.user.findFirstOrThrow({ where: { platformRole: "OWNER" } });
  const { token } = await createSession(owner.id, { ip: "127.0.0.1", userAgent: "verify" });
  const valid = await validateSessionToken(token);
  assert(valid.user?.id === owner.id, "session token validates to the owner");
  assert(!(await validateSessionToken(token + "x")).user, "tampered token is rejected");
  await invalidateAllUserSessions(owner.id);
  assert(!(await validateSessionToken(token)).user, "sessions are rejected after sign-out-everywhere");

  // 8. Secrets at rest
  const enc = encryptSecret("sk-test-123");
  assert(!enc.includes("sk-test") && decryptSecret(enc) === "sk-test-123", "AES-GCM secret round-trips and is not stored in clear");

  // 9. Rule engine
  assert(evaluateConditions({ match: "all", rules: [{ field: "inputs.tile_size_mm", operator: "gt", value: 1200 }] }, { inputs: { tile_size_mm: 1500 } }), "rule engine matches tile_size > 1200");
  assert(!evaluateConditions({ match: "all", rules: [{ field: "inputs.tile_size_mm", operator: "gt", value: 1200 }] }, { inputs: { tile_size_mm: 600 } }), "rule engine rejects tile_size <= 1200");

  // 10. Audit + events recorded
  const audits = await platformDb.auditLog.count({ where: { businessId: kabura.id } });
  const events = await platformDb.domainEvent.count({ where: { businessId: kabura.id } });
  assert(audits > 0 && events > 0, `audit entries (${audits}) and domain events (${events}) recorded for kabura`);
  const automationRuns = await platformDb.automationRun.count({ where: { businessId: kabura.id } });
  console.log(`info - automation runs so far: ${automationRuns}`);

  console.log("\nFOUNDATION VERIFIED");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
