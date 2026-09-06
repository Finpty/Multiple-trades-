import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { getPlatformOverview } from "@/lib/platform/stats";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";
import { severityTone } from "@/components/super-admin/core/severity";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverviewPage() {
  await requirePlatformAdmin("ADMIN");
  const o = await getPlatformOverview();
  const byStatus = (s: string) => o.businessesByStatus[s] ?? 0;

  return (
    <div>
      <PageHeader
        title="Platform overview"
        description="Everything that is running on the platform right now."
        actions={
          <>
            <ButtonLink href="/super-admin/create-business">Create business</ButtonLink>
            <ButtonLink href="/super-admin/industries" variant="secondary">
              Industries
            </ButtonLink>
            <ButtonLink href="/super-admin/domains" variant="secondary">
              Domains
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Businesses" value={o.businessesTotal} hint={`${byStatus("PUBLISHED")} published · ${byStatus("DRAFT")} draft · ${byStatus("SUSPENDED")} suspended · ${byStatus("ARCHIVED")} archived`} />
        <Stat label="Organisations" value={o.organisations} />
        <Stat label="Users" value={o.users} hint={`${o.usersByStatus.ACTIVE ?? 0} active · ${o.usersByStatus.INVITED ?? 0} invited · ${o.usersByStatus.SUSPENDED ?? 0} suspended`} />
        <Stat label="Leads · 30 days" value={o.leads30d} hint="Across all businesses" />
        <Stat label="Quotes · 30 days" value={o.quotes30d} hint="Across all businesses" />
        <Stat label="Jobs · 30 days" value={o.jobs30d} hint="Across all businesses" />
        <Stat label="Published sites" value={o.publishedSites} tone="green" />
        <Stat label="Verified domains" value={o.verifiedDomains} />
        <Stat label="Pending events" value={o.pendingDomainEvents} hint={o.failedDomainEvents ? `${o.failedDomainEvents} failed` : "Queue healthy"} tone={o.failedDomainEvents ? "red" : undefined} />
        <Stat label="AI" value={o.aiEnabled ? "Enabled" : "Disabled"} hint="Platform setting ai.enabled" tone={o.aiEnabled ? "green" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recently created businesses" actions={<Link href="/super-admin/businesses" className="text-sm text-neutral-600 hover:text-neutral-900">All businesses →</Link>} />
          {o.recentBusinesses.length === 0 ? (
            <CardBody>
              <EmptyState title="No businesses yet" description="Create the first business from an industry definition." action={<ButtonLink href="/super-admin/create-business">Create business</ButtonLink>} />
            </CardBody>
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <tr>
                  <Th>Business</Th>
                  <Th>Industry</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </THead>
              <TBody>
                {o.recentBusinesses.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <Td>
                      <Link href={`/super-admin/businesses/${b.id}`} className="font-medium text-neutral-900 hover:underline">
                        {b.name}
                      </Link>
                      <div className="text-xs text-neutral-500">
                        {b.slug} · {b.organization.name}
                      </div>
                    </Td>
                    <Td>{b.industry?.name ?? <span className="text-neutral-400">—</span>}</Td>
                    <Td>
                      <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(b.createdAt)}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent audit activity" actions={<Link href="/super-admin/audit-logs" className="text-sm text-neutral-600 hover:text-neutral-900">Audit logs →</Link>} />
          {o.recentAudit.length === 0 ? (
            <CardBody>
              <EmptyState title="Nothing recorded yet" description="Every mutation on the platform is written to the audit trail." />
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
                {o.recentAudit.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(a.createdAt)}</Td>
                    <Td>
                      <div className="font-medium">{a.action}</div>
                      <div className="text-xs text-neutral-500">
                        {a.entityType}
                        {a.business ? ` · ${a.business.name}` : ""}
                      </div>
                    </Td>
                    <Td className="text-xs">{a.actor ? a.actor.name : <span className="text-neutral-500">System</span>}</Td>
                    <Td>
                      <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
