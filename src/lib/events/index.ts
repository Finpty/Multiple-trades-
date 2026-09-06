import type { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/db";
import { toJson } from "@/lib/json";
import type { DomainEventEnvelope, DomainEventPayloads, DomainEventType } from "./types";

export * from "./types";

export type EventHandler<T extends DomainEventType = DomainEventType> = (event: DomainEventEnvelope<T>) => Promise<void>;

type HandlerRegistry = Map<string, Array<{ name: string; handler: EventHandler }>>;

const registryHolder = globalThis as unknown as { __tradeoneEventHandlers?: HandlerRegistry };
const registry: HandlerRegistry = registryHolder.__tradeoneEventHandlers ?? new Map();
registryHolder.__tradeoneEventHandlers = registry;

/** Subscribe to a specific event type or "*" for everything. Idempotent per handler name. */
export function registerEventHandler<T extends DomainEventType>(type: T | "*", name: string, handler: EventHandler<T>): void {
  const list = registry.get(type) ?? [];
  if (list.some((h) => h.name === name)) return;
  list.push({ name, handler: handler as EventHandler });
  registry.set(type, list);
}

export interface EmitEventInput<T extends DomainEventType> {
  type: T;
  payload: DomainEventPayloads[T];
  businessId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
}

/**
 * Persist a domain event (outbox) and dispatch it to in-process handlers.
 * Pass `tx` to write the event inside the caller's transaction; dispatch then
 * happens after the transaction commits by the caller invoking `flushEvents`,
 * or lazily by the pending-event processor. Without `tx` the event is written
 * and dispatched immediately.
 */
export async function emitEvent<T extends DomainEventType>(input: EmitEventInput<T>, tx?: Prisma.TransactionClient): Promise<string> {
  const payload = input.payload as unknown as Record<string, unknown>;
  const businessId = input.businessId ?? (typeof payload.businessId === "string" ? payload.businessId : null);
  const data: Prisma.DomainEventUncheckedCreateInput = {
    type: input.type,
    payload: toJson(payload),
    businessId,
    organizationId: input.organizationId ?? null,
    actorUserId: input.actorUserId ?? null,
  };
  const row = tx ? await tx.domainEvent.create({ data }) : await platformDb.domainEvent.create({ data });
  if (!tx) {
    // Fire-and-forget; failures are recorded on the event row and retried by the processor.
    void dispatchEvent(row.id);
  }
  return row.id;
}

async function loadHandlers(type: string) {
  await ensureBuiltInHandlers();
  return [...(registry.get(type) ?? []), ...(registry.get("*") ?? [])];
}

let builtInsLoaded = false;
async function ensureBuiltInHandlers() {
  if (builtInsLoaded) return;
  builtInsLoaded = true;
  // Lazy import avoids circular dependencies between modules that both emit and handle events.
  await import("@/lib/events/handlers").then((m) => m.registerBuiltInHandlers()).catch((e) => {
    console.error("[events] failed to register built-in handlers", e);
    builtInsLoaded = false;
  });
}

/** Dispatch one persisted event to every registered handler. */
export async function dispatchEvent(eventId: string): Promise<void> {
  const row = await platformDb.domainEvent.findUnique({ where: { id: eventId } });
  if (!row || row.status === "PROCESSED") return;
  const envelope: DomainEventEnvelope = {
    id: row.id,
    type: row.type as DomainEventType,
    payload: row.payload as never,
    businessId: row.businessId,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId,
    createdAt: row.createdAt,
  };
  const handlers = await loadHandlers(row.type);
  const errors: string[] = [];
  for (const { name, handler } of handlers) {
    try {
      await handler(envelope);
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await platformDb.domainEvent.update({
    where: { id: row.id },
    data: {
      attempts: { increment: 1 },
      status: errors.length ? "FAILED" : "PROCESSED",
      processedAt: new Date(),
      error: errors.length ? errors.join("\n").slice(0, 4000) : null,
    },
  });
}

/** Dispatch events written inside a transaction after it committed. */
export async function flushEvents(eventIds: string[]): Promise<void> {
  for (const id of eventIds) await dispatchEvent(id);
}

/** Worker/cron entry point: retries pending and failed events. */
export async function processPendingEvents(limit = 100): Promise<{ processed: number }> {
  const rows = await platformDb.domainEvent.findMany({
    where: { OR: [{ status: "PENDING" }, { status: "FAILED", attempts: { lt: 5 } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const row of rows) await dispatchEvent(row.id);
  return { processed: rows.length };
}
