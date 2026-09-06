import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getPlatformSetting } from "@/lib/platform/settings";
import { EmptyState, ButtonLink, PageHeader } from "@/components/ui";
import { SubscriptionForm } from "@/components/super-admin/core/subscription-form";
import { firstParam } from "@/components/super-admin/core/pagination";
import { SUBSCRIPTION_INTERVALS, SUBSCRIPTION_STATUSES, listOrganisationsWithBusinesses } from "../service";
import { createSubscriptionAction } from "../actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function NewSubscriptionPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePlatformAdmin("ADMIN");
  const sp = await searchParams;
  const [organisations, defaultCurrency] = await Promise.all([listOrganisationsWithBusinesses(), getPlatformSetting<string>("platform.defaultCurrency", "AUD")]);
  const presetOrg = firstParam(sp.organization);
  const presetBusiness = firstParam(sp.business);
  const organizationId = isUuid(presetOrg) && organisations.some((o) => o.id === presetOrg) ? presetOrg : organisations[0]?.id ?? "";
  const businessId = isUuid(presetBusiness) && organisations.find((o) => o.id === organizationId)?.businesses.some((b) => b.id === presetBusiness) ? presetBusiness : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl">
      <PageHeader breadcrumbs={[{ label: "Subscriptions", href: "/super-admin/subscriptions" }, { label: "New" }]} title="New subscription" description="Record a plan for an organisation or one of its businesses." />
      {organisations.length === 0 ? (
        <EmptyState title="No organisations yet" description="Subscriptions belong to an organisation. Create a business first; its organisation is created with it." action={<ButtonLink href="/super-admin/create-business">Create business</ButtonLink>} />
      ) : (
        <SubscriptionForm
          mode="create"
          action={createSubscriptionAction}
          organisations={organisations}
          statuses={SUBSCRIPTION_STATUSES}
          intervals={SUBSCRIPTION_INTERVALS}
          values={{
            organizationId,
            businessId,
            plan: "",
            status: "ACTIVE",
            seats: 1,
            price: "0",
            currency: defaultCurrency,
            interval: "month",
            currentPeriodStart: today,
            currentPeriodEnd: "",
            trialEndsAt: "",
            provider: "",
            externalId: "",
            notes: "",
          }}
        />
      )}
    </div>
  );
}
