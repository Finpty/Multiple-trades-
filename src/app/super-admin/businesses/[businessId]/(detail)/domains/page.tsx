import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getBusinessDomains, getBusinessForAdmin } from "@/lib/platform/businesses";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BusinessDomainsPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const domains = await getBusinessDomains(businessId);
  const manageHref = `/super-admin/domains?business=${businessId}`;

  return (
    <Card>
      <CardHeader title="Domains" description="Hostnames that resolve to this business. Verification and SSL are managed from the Domains section." actions={<ButtonLink href={manageHref} variant="secondary" size="sm">Manage domains</ButtonLink>} />
      {domains.length === 0 ? (
        <CardBody>
          <EmptyState title="No custom domains" description={`The site is reachable at the platform path /${business.slug} until a custom domain is added and verified.`} action={<ButtonLink href={manageHref}>Add a domain</ButtonLink>} />
        </CardBody>
      ) : (
        <Table className="rounded-none border-0">
          <THead>
            <tr>
              <Th>Hostname</Th>
              <Th>Kind</Th>
              <Th>Verification</Th>
              <Th>SSL</Th>
              <Th>Last checked</Th>
            </tr>
          </THead>
          <TBody>
            {domains.map((d) => (
              <tr key={d.id}>
                <Td>
                  <span className="font-mono text-xs">{d.hostname}</span>
                  {d.isPrimary && <Badge tone="blue" className="ml-2">primary</Badge>}
                </Td>
                <Td>{d.kind}</Td>
                <Td>
                  <Badge tone={statusTone(d.verificationStatus)}>{d.verificationStatus}</Badge>
                  {d.verificationError && <div className="mt-1 text-xs text-red-600">{d.verificationError}</div>}
                </Td>
                <Td>
                  <Badge tone={statusTone(d.sslStatus)}>{d.sslStatus}</Badge>
                  {d.sslProvider && <span className="ml-1 text-xs text-neutral-500">{d.sslProvider}</span>}
                </Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">{d.lastCheckedAt ? formatDateTime(d.lastCheckedAt) : "Never"}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
