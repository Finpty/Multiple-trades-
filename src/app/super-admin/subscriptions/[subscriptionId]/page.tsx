import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { asObject } from "@/lib/json";
import { formatCents } from "@/lib/money";
import { Alert, Badge, Card, CardBody, CardHeader, Description, PageHeader, formatDateTime, statusTone } from "@/components/ui";
import { ActionButton } from "@/components/super-admin/core/action-button";
import { SubscriptionForm } from "@/components/super-admin/core/subscription-form";
import { SUBSCRIPTION_INTERVALS, SUBSCRIPTION_STATUSES, getSubscription, listOrganisationsWithBusinesses } from "../service";
import { cancelSubscriptionAction, updateSubscriptionAction } from "../actions";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { subscriptionId } = await params;
  if (!isUuid(subscriptionId)) notFound();
  const [sub, organisations] = await Promise.all([getSubscription(subscriptionId), listOrganisationsWithBusinesses()]);
  if (!sub) notFound();
  const meta = asObject<{ notes?: string; cancelReason?: string }>(sub.metadata);
  const canceled = sub.status === "CANCELED";

  return (
    <div className="max-w-4xl">
      <PageHeader
        breadcrumbs={[{ label: "Subscriptions", href: "/super-admin/subscriptions" }, { label: sub.plan }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {sub.plan}
            <Badge tone={statusTone(sub.status)}>{sub.status}</Badge>
          </span>
        }
        description={
          <span>
            {sub.organization.name}
            {sub.business ? ` · ${sub.business.name}` : " · whole organisation"} · {formatCents(sub.priceCents, sub.currency)} / {sub.interval}
          </span>
        }
        actions={
          !canceled && (
            <ActionButton action={cancelSubscriptionAction} fields={{ subscriptionId: sub.id }} variant="danger" confirm="Cancel this subscription? The record is kept with status CANCELED.">
              Cancel subscription
            </ActionButton>
          )
        }
      />

      {canceled && (
        <Alert tone="warning" className="mb-4" title="Cancelled">
          Cancelled {sub.canceledAt ? formatDateTime(sub.canceledAt) : ""}.{meta.cancelReason ? ` Reason: ${meta.cancelReason}` : ""} Change the status below to reinstate it.
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader title="Summary" />
        <CardBody>
          <Description
            items={[
              { label: "Organisation", value: <Link href={`/super-admin/businesses?organization=${sub.organization.id}`} className="hover:underline">{sub.organization.name}</Link> },
              { label: "Business", value: sub.business ? <Link href={`/super-admin/businesses/${sub.business.id}`} className="hover:underline">{sub.business.name}</Link> : "Whole organisation" },
              { label: "Created", value: formatDateTime(sub.createdAt) },
              { label: "Updated", value: formatDateTime(sub.updatedAt) },
              { label: "Provider", value: sub.provider ?? "manual" },
              { label: "External id", value: sub.externalId ? <span className="font-mono text-xs">{sub.externalId}</span> : null },
            ]}
          />
        </CardBody>
      </Card>

      <SubscriptionForm
        mode="edit"
        action={updateSubscriptionAction}
        organisations={organisations}
        statuses={SUBSCRIPTION_STATUSES}
        intervals={SUBSCRIPTION_INTERVALS}
        values={{
          id: sub.id,
          organizationId: sub.organizationId,
          businessId: sub.businessId,
          plan: sub.plan,
          status: sub.status,
          seats: sub.seats,
          price: (sub.priceCents / 100).toFixed(2),
          currency: sub.currency,
          interval: sub.interval,
          currentPeriodStart: dateInput(sub.currentPeriodStart),
          currentPeriodEnd: dateInput(sub.currentPeriodEnd),
          trialEndsAt: dateInput(sub.trialEndsAt),
          provider: sub.provider ?? "",
          externalId: sub.externalId ?? "",
          notes: typeof meta.notes === "string" ? meta.notes : "",
        }}
      />
      <p className="mt-6 text-xs text-neutral-400">
        Subscription id <span className="font-mono">{sub.id}</span>
      </p>
    </div>
  );
}
