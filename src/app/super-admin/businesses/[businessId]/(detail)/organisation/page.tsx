import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getBusinessForAdmin, getBusinessOrganisation } from "@/lib/platform/businesses";
import { Badge, Card, CardBody, CardHeader, Description, EmptyState, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BusinessOrganisationPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const org = await getBusinessOrganisation(business.organizationId);
  if (!org) {
    return <EmptyState title="Organisation not found" description="The organisation that owns this business has been removed. Assign a different organisation from the Details tab." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={org.name} description="The organisation is the billing and ownership boundary; it may own several businesses." actions={<Badge tone={statusTone(org.status)}>{org.status}</Badge>} />
        <CardBody>
          <Description
            items={[
              { label: "Slug", value: <span className="font-mono text-xs">{org.slug}</span> },
              { label: "Owner", value: org.owner ? <Link href={`/super-admin/users/${org.owner.id}`} className="hover:underline">{org.owner.name} · {org.owner.email}</Link> : null },
              { label: "Billing email", value: org.billingEmail },
              { label: "Created", value: formatDateTime(org.createdAt) },
              { label: "Businesses", value: org.businesses.length },
              { label: "Members", value: org.memberships.length },
            ]}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Organisation members" description="Organisation roles grant access to every business in the organisation." />
          {org.memberships.length === 0 ? (
            <CardBody>
              <EmptyState title="No organisation members" description="Access can also be granted per business from the Members tab." />
            </CardBody>
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {org.memberships.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <Link href={`/super-admin/users/${m.user.id}`} className="font-medium hover:underline">
                        {m.user.name}
                      </Link>
                      <div className="text-xs text-neutral-500">{m.user.email}</div>
                    </Td>
                    <Td>{m.role.name}</Td>
                    <Td>
                      <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Businesses in this organisation" />
          <Table className="rounded-none border-0">
            <THead>
              <tr>
                <Th>Business</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {org.businesses.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <Link href={`/super-admin/businesses/${b.id}`} className={b.id === business.id ? "font-semibold" : "hover:underline"}>
                      {b.name}
                    </Link>
                    <div className="font-mono text-xs text-neutral-500">{b.slug}</div>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
