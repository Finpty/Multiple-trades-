import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { Badge, ButtonLink, EmptyState, Input, PageHeader, Select, Stat, TBody, Table, Td, Th, THead, formatDate, statusTone } from "@/components/ui";
import { FilterBar, FilterField } from "@/components/super-admin/core/filter-bar";
import { Pagination, firstParam, pageParam, queryString } from "@/components/super-admin/core/pagination";
import { SUBSCRIPTION_STATUSES, listSubscriptions } from "./service";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePlatformAdmin("ADMIN");
  const sp = await searchParams;
  const filters = { q: firstParam(sp.q), status: firstParam(sp.status), organizationId: firstParam(sp.organization), page: pageParam(sp.page) };
  const list = await listSubscriptions(filters);
  const hrefFor = (page: number) => `/super-admin/subscriptions${queryString({ q: filters.q, status: filters.status, organization: filters.organizationId, page })}`;
  const hasFilters = !!(filters.q || filters.status || filters.organizationId);

  return (
    <div>
      <PageHeader title="Subscriptions" description="Plans held by organisations. Subscriptions are records of what each customer pays for; billing providers are referenced, not integrated here." actions={<ButtonLink href="/super-admin/subscriptions/new">New subscription</ButtonLink>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {SUBSCRIPTION_STATUSES.map((s) => (
          <Stat key={s} label={s.replace("_", " ")} value={list.counts[s] ?? 0} tone={s === "ACTIVE" ? "green" : s === "PAST_DUE" ? "red" : undefined} />
        ))}
      </div>

      <FilterBar resetHref="/super-admin/subscriptions">
        <FilterField label="Search">
          <Input name="q" defaultValue={filters.q} placeholder="Plan, organisation, business, provider" />
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
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
          title={hasFilters ? "No subscriptions match" : "No subscriptions yet"}
          description={hasFilters ? "Try clearing a filter." : "Create a subscription to record the plan, seats and billing period of an organisation or business."}
          action={hasFilters ? <ButtonLink href="/super-admin/subscriptions" variant="secondary">Clear filters</ButtonLink> : <ButtonLink href="/super-admin/subscriptions/new">New subscription</ButtonLink>}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Organisation</Th>
              <Th>Business</Th>
              <Th>Plan</Th>
              <Th>Status</Th>
              <Th>Seats</Th>
              <Th>Price</Th>
              <Th>Period</Th>
              <Th>Provider</Th>
            </tr>
          </THead>
          <TBody>
            {list.rows.map((s) => (
              <tr key={s.id} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/super-admin/businesses?organization=${s.organization.id}`} className="hover:underline">
                    {s.organization.name}
                  </Link>
                </Td>
                <Td>
                  {s.business ? (
                    <Link href={`/super-admin/businesses/${s.business.id}`} className="hover:underline">
                      {s.business.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">Whole organisation</span>
                  )}
                </Td>
                <Td>
                  <Link href={`/super-admin/subscriptions/${s.id}`} className="font-medium text-neutral-900 hover:underline">
                    {s.plan}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </Td>
                <Td>{s.seats}</Td>
                <Td className="whitespace-nowrap">
                  {formatCents(s.priceCents, s.currency)} / {s.interval}
                </Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">
                  {s.currentPeriodStart ? formatDate(s.currentPeriodStart) : "—"} → {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "—"}
                </Td>
                <Td className="text-xs">{s.provider ?? <span className="text-neutral-400">manual</span>}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={list.page} pages={list.pages} total={list.total} pageSize={list.pageSize} hrefFor={hrefFor} />
    </div>
  );
}
