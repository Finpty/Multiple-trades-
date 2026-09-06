import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { BUSINESS_STATUSES, listBusinesses } from "@/lib/platform/businesses";
import { Badge, ButtonLink, EmptyState, Input, PageHeader, Select, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";
import { FilterBar, FilterField } from "@/components/super-admin/core/filter-bar";
import { Pagination, firstParam, pageParam, queryString } from "@/components/super-admin/core/pagination";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePlatformAdmin("ADMIN");
  const sp = await searchParams;
  const filters = { q: firstParam(sp.q), status: firstParam(sp.status), industryId: firstParam(sp.industry), organizationId: firstParam(sp.organization), page: pageParam(sp.page) };
  const list = await listBusinesses(filters);
  const hrefFor = (page: number) => `/super-admin/businesses${queryString({ q: filters.q, status: filters.status, industry: filters.industryId, organization: filters.organizationId, page })}`;
  const hasFilters = !!(filters.q || filters.status || filters.industryId || filters.organizationId);

  return (
    <div>
      <PageHeader title="Businesses" description={`${list.total} business${list.total === 1 ? "" : "es"} match the current filters.`} actions={<ButtonLink href="/super-admin/create-business">Create business</ButtonLink>} />

      <FilterBar resetHref="/super-admin/businesses">
        <FilterField label="Search">
          <Input name="q" defaultValue={filters.q} placeholder="Name or slug" />
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={filters.status}>
            <option value="">Active (not archived)</option>
            {BUSINESS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Industry">
          <Select name="industry" defaultValue={filters.industryId}>
            <option value="">All industries</option>
            {list.industries.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Organisation">
          <Select name="organization" defaultValue={filters.organizationId}>
            <option value="">All organisations</option>
            {list.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {list.rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No businesses match" : "No businesses yet"}
          description={hasFilters ? "Try clearing a filter or searching for a different name." : "Every business is generated from an industry definition. Create the first one to get started."}
          action={hasFilters ? <ButtonLink href="/super-admin/businesses" variant="secondary">Clear filters</ButtonLink> : <ButtonLink href="/super-admin/create-business">Create business</ButtonLink>}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th>Industry</Th>
              <Th>Organisation</Th>
              <Th>Status</Th>
              <Th>Published</Th>
              <Th>Updated</Th>
            </tr>
          </THead>
          <TBody>
            {list.rows.map((b) => (
              <tr key={b.id} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/super-admin/businesses/${b.id}`} className="font-medium text-neutral-900 hover:underline">
                    {b.name}
                  </Link>
                </Td>
                <Td className="font-mono text-xs">{b.slug}</Td>
                <Td>{b.industry?.name ?? <span className="text-neutral-400">—</span>}</Td>
                <Td>
                  <Link href={`/super-admin/businesses?organization=${b.organization.id}`} className="hover:underline">
                    {b.organization.name}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">{b.publishedAt ? formatDateTime(b.publishedAt) : "—"}</Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(b.updatedAt)}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={list.page} pages={list.pages} total={list.total} pageSize={list.pageSize} hrefFor={hrefFor} />
    </div>
  );
}
