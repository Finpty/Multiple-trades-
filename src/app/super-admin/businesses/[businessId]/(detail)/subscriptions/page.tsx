import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { formatCents } from "@/lib/money";
import { getBusinessForAdmin, getBusinessSubscriptions } from "@/lib/platform/businesses";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, TBody, Table, Td, Th, THead, formatDate, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BusinessSubscriptionsPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const subs = await getBusinessSubscriptions(business.organizationId);
  const newHref = `/super-admin/subscriptions/new?organization=${business.organizationId}&business=${businessId}`;

  return (
    <Card>
      <CardHeader title="Subscriptions" description={`Plans held by ${business.organization.name}. A subscription can cover the whole organisation or one business.`} actions={<ButtonLink href={newHref} size="sm">New subscription</ButtonLink>} />
      {subs.length === 0 ? (
        <CardBody>
          <EmptyState title="No subscriptions" description="This organisation has no plan on record. Create one to track seats, pricing and billing periods." action={<ButtonLink href={newHref}>Create subscription</ButtonLink>} />
        </CardBody>
      ) : (
        <Table className="rounded-none border-0">
          <THead>
            <tr>
              <Th>Plan</Th>
              <Th>Scope</Th>
              <Th>Status</Th>
              <Th>Seats</Th>
              <Th>Price</Th>
              <Th>Period</Th>
              <Th>Provider</Th>
            </tr>
          </THead>
          <TBody>
            {subs.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link href={`/super-admin/subscriptions/${s.id}`} className="font-medium hover:underline">
                    {s.plan}
                  </Link>
                </Td>
                <Td>{s.business ? s.business.name : <span className="text-neutral-500">Whole organisation</span>}</Td>
                <Td>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </Td>
                <Td>{s.seats}</Td>
                <Td>
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
    </Card>
  );
}
