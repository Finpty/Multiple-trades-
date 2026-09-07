import { requireBusinessAccess } from "@/lib/authz";
import { PERMISSIONS, SYSTEM_ROLES, type Permission } from "@/lib/authz/permissions";
import { PageHeader, Table, TBody, Td, Th, THead } from "@/components/ui";

export const metadata = { title: "Roles reference" };

export default async function RolesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireBusinessAccess(businessId, "users.manage");
  const roles = SYSTEM_ROLES.filter((r) => r.scope === "BUSINESS");
  const perms = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => !p.startsWith("org."));
  return (
    <>
      <PageHeader title="Roles reference" description="What each role can do. Roles are enforced on the server for every action." breadcrumbs={[{ label: "Users & roles", href: `/admin/${businessId}/users` }, { label: "Roles" }]} />
      <Table>
        <THead><tr><Th>Permission</Th>{roles.map((r) => <Th key={r.key} className="text-center">{r.name}</Th>)}</tr></THead>
        <TBody>
          {perms.map((p) => (
            <tr key={p}><Td><span className="font-medium">{PERMISSIONS[p]}</span><span className="block font-mono text-xs text-neutral-500">{p}</span></Td>{roles.map((r) => <Td key={r.key} className="text-center">{r.permissions.includes(p) ? "✓" : <span className="text-neutral-300">—</span>}</Td>)}</tr>
          ))}
        </TBody>
      </Table>
    </>
  );
}
