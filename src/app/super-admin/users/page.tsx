import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { PLATFORM_ROLES, USER_STATUSES, listUsers } from "@/lib/platform/users";
import { Badge, ButtonLink, EmptyState, Input, PageHeader, Select, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";
import { FilterBar, FilterField } from "@/components/super-admin/core/filter-bar";
import { Pagination, firstParam, pageParam, queryString } from "@/components/super-admin/core/pagination";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function roleTone(role: string): "purple" | "blue" | "neutral" {
  if (role === "OWNER") return "purple";
  if (role === "ADMIN" || role === "SUPPORT") return "blue";
  return "neutral";
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePlatformAdmin("ADMIN");
  const sp = await searchParams;
  const filters = { q: firstParam(sp.q), platformRole: firstParam(sp.role), status: firstParam(sp.status), page: pageParam(sp.page) };
  const list = await listUsers(filters);
  const hrefFor = (page: number) => `/super-admin/users${queryString({ q: filters.q, role: filters.platformRole, status: filters.status, page })}`;
  const hasFilters = !!(filters.q || filters.platformRole || filters.status);

  return (
    <div>
      <PageHeader title="Users" description={`${list.total} user${list.total === 1 ? "" : "s"} match the current filters.`} actions={<ButtonLink href="/super-admin/users/new">Invite user</ButtonLink>} />

      <FilterBar resetHref="/super-admin/users">
        <FilterField label="Search">
          <Input name="q" defaultValue={filters.q} placeholder="Name or email" />
        </FilterField>
        <FilterField label="Platform role">
          <Select name="role" defaultValue={filters.platformRole}>
            <option value="">All roles</option>
            {PLATFORM_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={filters.status}>
            <option value="">Active, invited & suspended</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {list.rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No users match" : "No users yet"}
          description={hasFilters ? "Try a different search or clear the filters." : "Invite the first platform user or add members to a business."}
          action={hasFilters ? <ButtonLink href="/super-admin/users" variant="secondary">Clear filters</ButtonLink> : <ButtonLink href="/super-admin/users/new">Invite user</ButtonLink>}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>User</Th>
              <Th>Platform role</Th>
              <Th>Status</Th>
              <Th>Memberships</Th>
              <Th>Verified</Th>
              <Th>Last login</Th>
              <Th>Created</Th>
            </tr>
          </THead>
          <TBody>
            {list.rows.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/super-admin/users/${u.id}`} className="font-medium text-neutral-900 hover:underline">
                    {u.name}
                  </Link>
                  <div className="text-xs text-neutral-500">{u.email}</div>
                </Td>
                <Td>
                  <Badge tone={roleTone(u.platformRole)}>{u.platformRole}</Badge>
                </Td>
                <Td>
                  <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                </Td>
                <Td className="text-xs text-neutral-600">
                  {u._count.businessMemberships} business · {u._count.organizationMemberships} org
                </Td>
                <Td className="text-xs">{u.emailVerifiedAt ? <Badge tone="green">Verified</Badge> : <span className="text-neutral-400">No</span>}</Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(u.createdAt)}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={list.page} pages={list.pages} total={list.total} pageSize={list.pageSize} hrefFor={hrefFor} />
    </div>
  );
}
