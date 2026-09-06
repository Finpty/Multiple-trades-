import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { getInfrastructureSummary } from "@/lib/platform/stats";
import { Alert, Badge, Card, CardBody, CardHeader, Description, EmptyState, PageHeader, Stat, TBody, Table, Td, Th, THead, formatDateTime } from "@/components/ui";
import { ActionButton } from "@/components/super-admin/core/action-button";
import { processPendingEventsAction, purgeRateLimitsAction, purgeSessionsAction, retryFailedEventsAction } from "./actions";

export const dynamic = "force-dynamic";

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m` : `${m}m`;
}

export default async function InfrastructurePage() {
  await requirePlatformAdmin("ADMIN");
  const i = await getInfrastructureSummary();
  const cost = (i.ai.costMicros / 1_000_000).toLocaleString("en-AU", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <PageHeader title="Infrastructure" description="Runtime environment, database health, the event queue and maintenance tasks." />

      {!i.database.ok && (
        <Alert tone="danger" title="Database unreachable">
          {i.database.error}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Environment" description="Read from the process environment. Change these in the deployment, not here." />
          <CardBody>
            <Description
              items={[
                { label: "Node environment", value: <Badge tone={i.environment.nodeEnv === "production" ? "green" : "amber"}>{i.environment.nodeEnv}</Badge> },
                { label: "Node version", value: i.environment.nodeVersion },
                { label: "Process uptime", value: uptime(i.environment.uptimeSeconds) },
                { label: "Platform URL", value: i.environment.platformUrl },
                { label: "Platform hosts", value: i.environment.platformHosts.join(", ") },
                { label: "Database", value: <span className="font-mono text-xs">{i.environment.databaseHost}</span> },
                { label: "Storage driver", value: `${i.environment.storageDriver}${i.environment.storagePath ? ` (${i.environment.storagePath})` : ""}` },
                { label: "Mail driver", value: `${i.environment.mailDriver} · from ${i.environment.mailFrom}` },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Database" description={i.database.ok ? `Connected · ${i.database.latencyMs} ms round trip` : "Connection failed"} actions={<Badge tone={i.database.ok ? "green" : "red"}>{i.database.ok ? "OK" : "DOWN"}</Badge>} />
          <CardBody>
            {i.database.version && <p className="mb-4 text-xs text-neutral-500">{i.database.version}</p>}
            {i.database.rowCounts.length === 0 ? (
              <EmptyState title="No counts available" />
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                {i.database.rowCounts.map((r) => (
                  <div key={r.table} className="flex items-center justify-between border-b border-neutral-100 py-1">
                    <span className="font-mono text-xs text-neutral-600">{r.table}</span>
                    <span className="font-medium">{r.count.toLocaleString("en-AU")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Event queue" description="Domain events are persisted first, then dispatched to automations, webhooks and notifications. Failed events are retried up to five times." actions={
          <>
            <ActionButton action={processPendingEventsAction} pendingText="Processing…" variant="primary">
              Process pending now
            </ActionButton>
            <ActionButton action={retryFailedEventsAction} pendingText="Retrying…" confirm="Reset every failed event and dispatch it again?">
              Retry failed
            </ActionButton>
          </>
        } />
        <CardBody>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Pending" value={i.events.pending} tone={i.events.pending ? undefined : "green"} />
            <Stat label="Failed" value={i.events.failed} tone={i.events.failed ? "red" : "green"} hint={`${i.events.retryable} retryable`} />
            <Stat label="Processed" value={i.events.processed.toLocaleString("en-AU")} />
            <Stat label="Exhausted" value={i.events.failed - i.events.retryable} hint="Failed 5 times; use Retry failed" />
          </div>
          {i.events.recentFailed.length === 0 ? (
            <EmptyState title="No failed events" description="Every event has been delivered to its handlers." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>Business</Th>
                  <Th>Attempts</Th>
                  <Th>Error</Th>
                </tr>
              </THead>
              <TBody>
                {i.events.recentFailed.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(e.createdAt)}</Td>
                    <Td className="font-mono text-xs">{e.type}</Td>
                    <Td className="text-xs">
                      {e.businessId ? (
                        <Link href={`/super-admin/businesses/${e.businessId}/activity`} className="font-mono hover:underline">
                          {e.businessId.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-neutral-400">platform</span>
                      )}
                    </Td>
                    <Td>{e.attempts}</Td>
                    <Td className="text-xs text-red-700">
                      <pre className="max-w-xl whitespace-pre-wrap break-words font-sans">{e.error ?? "—"}</pre>
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Maintenance" description="Housekeeping that a scheduler normally runs. Safe to run at any time." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4">
              <div>
                <div className="text-sm font-medium">Expired sessions</div>
                <div className="text-xs text-neutral-500">{i.maintenance.expiredSessions.toLocaleString("en-AU")} expired or long-revoked session rows.</div>
              </div>
              <ActionButton action={purgeSessionsAction} pendingText="Purging…">
                Purge sessions
              </ActionButton>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4">
              <div>
                <div className="text-sm font-medium">Expired rate-limit buckets</div>
                <div className="text-xs text-neutral-500">{i.maintenance.expiredRateLimits.toLocaleString("en-AU")} buckets past their reset time.</div>
              </div>
              <ActionButton action={purgeRateLimitsAction} pendingText="Purging…">
                Purge rate limits
              </ActionButton>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="AI usage · last 30 days" description="Totals across every business and provider. AI is optional; zero usage is normal when it is disabled." actions={<Link href="/super-admin/ai-providers" className="text-sm text-neutral-600 hover:text-neutral-900">AI providers →</Link>} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Requests" value={i.ai.requests.toLocaleString("en-AU")} hint={i.ai.failed ? `${i.ai.failed} failed` : "No failures"} tone={i.ai.failed ? "red" : undefined} />
              <Stat label="Estimated cost" value={cost} hint="From provider cost estimates" />
              <Stat label="Input tokens" value={i.ai.inputTokens.toLocaleString("en-AU")} />
              <Stat label="Output tokens" value={i.ai.outputTokens.toLocaleString("en-AU")} />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Applied migrations" description={`${i.migrations.length} migration${i.migrations.length === 1 ? "" : "s"} recorded in _prisma_migrations.`} />
        {i.migrations.length === 0 ? (
          <CardBody>
            <EmptyState title="No migrations recorded" description="Run the database migrations before using the platform." />
          </CardBody>
        ) : (
          <Table className="rounded-none border-0">
            <THead>
              <tr>
                <Th>Migration</Th>
                <Th>Started</Th>
                <Th>Finished</Th>
                <Th>Steps</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {i.migrations.map((m) => (
                <tr key={m.id}>
                  <Td className="font-mono text-xs">{m.name}</Td>
                  <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(m.startedAt)}</Td>
                  <Td className="whitespace-nowrap text-xs text-neutral-500">{m.finishedAt ? formatDateTime(m.finishedAt) : "—"}</Td>
                  <Td>{m.appliedStepsCount}</Td>
                  <Td>{m.rolledBackAt ? <Badge tone="red">Rolled back</Badge> : m.finishedAt ? <Badge tone="green">Applied</Badge> : <Badge tone="amber">Incomplete</Badge>}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
