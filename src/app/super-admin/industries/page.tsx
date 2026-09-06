import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { listIndustries } from "@/lib/platform/industries";
import { Badge, ButtonLink, EmptyState, Input, PageHeader, TBody, Table, Td, Th, THead } from "@/components/ui";
import { Icon } from "@/components/admin/icon";
import { asArray } from "@/lib/json";

export const metadata = { title: "Industries" };

export default async function IndustriesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { q } = await searchParams;
  const rows = await listIndustries({ q });
  return (
    <>
      <PageHeader title="Industries" description="Every trade the platform can generate a business for. Add a new industry here — no code, no deployment." actions={<ButtonLink href="/super-admin/industries/new">New industry</ButtonLink>} />
      <form className="mb-4 max-w-sm"><Input name="q" placeholder="Search industries…" defaultValue={q ?? ""} /></form>
      {rows.length === 0 ? (
        <EmptyState title="No industries yet" description="Create your first industry to start generating businesses." action={<ButtonLink href="/super-admin/industries/new">New industry</ButtonLink>} />
      ) : (
        <Table>
          <THead><tr><Th>Industry</Th><Th>Slug</Th><Th>Services</Th><Th>Stages</Th><Th>Businesses</Th><Th>Status</Th><Th></Th></tr></THead>
          <TBody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td><span className="flex items-center gap-2"><Icon name={r.icon ?? "Wrench"} className="h-4 w-4 text-neutral-500" /><Link href={`/super-admin/industries/${r.id}`} className="font-medium hover:underline">{r.name}</Link>{r.isSystem && <Badge>system</Badge>}</span></Td>
                <Td className="text-neutral-500">{r.slug}</Td>
                <Td>{asArray(r.defaultServices).length}</Td>
                <Td>{asArray(r.projectStages).length}</Td>
                <Td>{r._count.businesses}</Td>
                <Td><Badge tone={r.isActive ? "green" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge></Td>
                <Td><Link href={`/super-admin/industries/${r.id}`} className="text-sm underline">Edit</Link></Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
