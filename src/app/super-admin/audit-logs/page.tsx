import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { EmptyState, ButtonLink, Input, PageHeader, Select, TBody, Table, Th, THead, formatDateTime } from "@/components/ui";
import { FilterBar, FilterField } from "@/components/super-admin/core/filter-bar";
import { Pagination, firstParam, pageParam, queryString } from "@/components/super-admin/core/pagination";
import { AuditRow, type AuditRowData } from "@/components/super-admin/core/audit-row";
import { AUDIT_SEVERITIES, listAuditLogs } from "./query";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePlatformAdmin("ADMIN");
  const sp = await searchParams;
  const business = firstParam(sp.business);
  const filters = {
    businessId: isUuid(business) ? business : undefined,
    actor: firstParam(sp.actor),
    action: firstParam(sp.action),
    entityType: firstParam(sp.entity),
    severity: firstParam(sp.severity),
    from: firstParam(sp.from),
    to: firstParam(sp.to),
    page: pageParam(sp.page),
  };
  const list = await listAuditLogs(filters);
  const hrefFor = (page: number) => `/super-admin/audit-logs${queryString({ business: filters.businessId, actor: filters.actor, action: filters.action, entity: filters.entityType, severity: filters.severity, from: filters.from, to: filters.to, page })}`;
  const hasFilters = !!(filters.businessId || filters.actor || filters.action || filters.entityType || filters.severity || filters.from || filters.to);

  const rows: AuditRowData[] = list.rows.map((r) => ({
    id: r.id,
    createdAt: formatDateTime(r.createdAt),
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    severity: r.severity,
    actorType: r.actorType,
    actorName: r.actor?.name ?? null,
    actorEmail: r.actor?.email ?? null,
    businessName: r.business?.name ?? null,
    businessId: r.businessId,
    ip: r.ip,
    userAgent: r.userAgent,
    before: r.before,
    after: r.after,
    metadata: r.metadata,
  }));

  return (
    <div>
      <PageHeader title="Audit logs" description={`Append-only trail of every mutation on the platform. ${list.total.toLocaleString("en-AU")} entries match.`} />

      <FilterBar resetHref="/super-admin/audit-logs">
        <FilterField label="Business">
          <Select name="business" defaultValue={filters.businessId ?? ""}>
            <option value="">All businesses</option>
            {list.businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Actor email">
          <Input name="actor" defaultValue={filters.actor} placeholder="contains…" />
        </FilterField>
        <FilterField label="Action">
          <Input name="action" defaultValue={filters.action} placeholder="e.g. business.published" />
        </FilterField>
        <FilterField label="Entity type">
          <Select name="entity" defaultValue={filters.entityType}>
            <option value="">All entities</option>
            {list.entityTypes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Severity" className="min-w-[120px]">
          <Select name="severity" defaultValue={filters.severity}>
            <option value="">All</option>
            {AUDIT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="From" className="min-w-[150px]">
          <Input name="from" type="date" defaultValue={filters.from} />
        </FilterField>
        <FilterField label="To" className="min-w-[150px]">
          <Input name="to" type="date" defaultValue={filters.to} />
        </FilterField>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No entries match" : "No audit entries yet"}
          description={hasFilters ? "Widen the date range or clear a filter." : "Every create, update, publish and security action is recorded here automatically."}
          action={hasFilters ? <ButtonLink href="/super-admin/audit-logs" variant="secondary">Clear filters</ButtonLink> : undefined}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>When</Th>
              <Th>Action</Th>
              <Th>Actor</Th>
              <Th>Business</Th>
              <Th>Severity</Th>
              <Th></Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <AuditRow key={r.id} row={r} columns={6} />
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={list.page} pages={list.pages} total={list.total} pageSize={list.pageSize} hrefFor={hrefFor} />
    </div>
  );
}
