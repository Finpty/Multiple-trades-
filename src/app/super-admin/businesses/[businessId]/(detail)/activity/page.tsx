import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getBusinessForAdmin, getBusinessRecentAudit, getBusinessRecentEvents } from "@/lib/platform/businesses";
import { Badge, Card, CardBody, CardHeader, EmptyState, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";
import { severityTone } from "@/components/super-admin/core/severity";

export const dynamic = "force-dynamic";

export default async function BusinessActivityPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const [audit, events] = await Promise.all([getBusinessRecentAudit(businessId, 20), getBusinessRecentEvents(businessId, 20)]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Recent audit" description="Last 20 audited actions in this business." actions={<Link href={`/super-admin/audit-logs?business=${businessId}`} className="text-sm text-neutral-600 hover:text-neutral-900">All →</Link>} />
        {audit.length === 0 ? (
          <CardBody>
            <EmptyState title="No audit entries" description="Actions inside this business will appear here." />
          </CardBody>
        ) : (
          <Table className="rounded-none border-0">
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Actor</Th>
                <Th>Severity</Th>
              </tr>
            </THead>
            <TBody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(a.createdAt)}</Td>
                  <Td>
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-neutral-500">{a.entityType}</div>
                  </Td>
                  <Td className="text-xs">{a.actor ? a.actor.name : "System"}</Td>
                  <Td>
                    <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent domain events" description="Last 20 events emitted by this business and their processing status." />
        {events.length === 0 ? (
          <CardBody>
            <EmptyState title="No events yet" description="Events are emitted when leads, quotes, jobs, pages and other records change." />
          </CardBody>
        ) : (
          <Table className="rounded-none border-0">
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Attempts</Th>
              </tr>
            </THead>
            <TBody>
              {events.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(e.createdAt)}</Td>
                  <Td>
                    <div className="font-mono text-xs">{e.type}</div>
                    {e.error && <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={e.error}>{e.error}</div>}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                  </Td>
                  <Td>{e.attempts}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
