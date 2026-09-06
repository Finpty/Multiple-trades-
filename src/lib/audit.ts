import type { AuditActorType, AuditSeverity, Prisma } from "@prisma/client";
import { platformDb } from "@/lib/db";
import { toJson } from "@/lib/json";

export interface AuditInput {
  actorUserId?: string | null;
  actorType?: AuditActorType;
  organizationId?: string | null;
  businessId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  severity?: AuditSeverity;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const SENSITIVE_KEYS = /password|secret|token|apikey|api_key|authorization|cookie|hash/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

/**
 * Append-only audit trail. Writes never throw into business logic: an audit
 * failure is logged, not surfaced, so it can't be used to block an action.
 * Sensitive keys are redacted before persistence.
 */
export async function recordAudit(input: AuditInput, tx?: Prisma.TransactionClient): Promise<void> {
  const data = {
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? (input.actorUserId ? "USER" : "SYSTEM"),
    organizationId: input.organizationId ?? null,
    businessId: input.businessId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    severity: input.severity ?? "INFO",
    before: input.before === undefined ? undefined : toJson(redact(input.before)),
    after: input.after === undefined ? undefined : toJson(redact(input.after)),
    metadata: toJson(redact(input.metadata ?? {})),
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 512) ?? null,
    requestId: input.requestId ?? null,
  } satisfies Prisma.AuditLogUncheckedCreateInput;
  try {
    if (tx) await tx.auditLog.create({ data });
    else await platformDb.auditLog.create({ data });
  } catch (error) {
    console.error("[audit] failed to record", input.action, error);
  }
}
