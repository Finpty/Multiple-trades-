import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { getBusinessForAdmin, getBusinessPrimaryDomain } from "@/lib/platform/businesses";
import { Alert, Badge, ButtonLink, PageHeader, statusTone, formatDateTime } from "@/components/ui";
import { ActionButton } from "@/components/super-admin/core/action-button";
import { BusinessTabs } from "@/components/super-admin/core/business-tabs";
import { archiveBusinessAction, publishBusinessAction, restoreBusinessAction, suspendBusinessAction, unpublishBusinessAction, unsuspendBusinessAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BusinessDetailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const primary = business.deletedAt ? null : await getBusinessPrimaryDomain(businessId);
  const siteUrl = publicSiteUrl(business, primary?.hostname ?? null);
  const archived = business.status === "ARCHIVED" || !!business.deletedAt;
  const suspended = business.status === "SUSPENDED";
  const fields = { businessId };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Businesses", href: "/super-admin/businesses" }, { label: business.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {business.name}
            <Badge tone={statusTone(business.status)}>{business.status}</Badge>
          </span>
        }
        description={
          <span>
            <span className="font-mono text-xs">{business.slug}</span> · {business.industry?.name ?? "No industry"} · {business.organization.name}
            {business.publishedAt && <> · Published {formatDateTime(business.publishedAt)}</>}
          </span>
        }
        actions={
          <>
            {!archived && (
              <>
                <ButtonLink href={`/admin/${business.id}`} variant="secondary" size="sm">
                  Open business admin
                </ButtonLink>
                <a href={siteUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-900 hover:bg-neutral-50">
                  View site ↗
                </a>
                <ButtonLink href={`/super-admin/businesses/${business.id}/duplicate`} variant="secondary" size="sm">
                  Duplicate
                </ButtonLink>
                <ButtonLink href={`/super-admin/templates/new?from=${business.id}`} variant="secondary" size="sm">
                  Save as template
                </ButtonLink>
              </>
            )}
            {!archived && !suspended && business.status !== "PUBLISHED" && (
              <ActionButton action={publishBusinessAction} fields={fields} variant="primary" confirm="Publish every page, the theme and navigation of this business and make the site live?">
                Publish
              </ActionButton>
            )}
            {!archived && !suspended && business.status === "PUBLISHED" && (
              <ActionButton action={unpublishBusinessAction} fields={fields} confirm="Take the site offline? The content stays intact and can be republished at any time.">
                Unpublish
              </ActionButton>
            )}
            {!archived && !suspended && (
              <ActionButton action={suspendBusinessAction} fields={fields} variant="danger" confirm="Suspend this business? The site and admin will be unavailable until it is unsuspended.">
                Suspend
              </ActionButton>
            )}
            {!archived && suspended && (
              <ActionButton action={unsuspendBusinessAction} fields={fields} variant="primary" confirm="Lift the suspension and restore the previous status?">
                Unsuspend
              </ActionButton>
            )}
            {!archived && (
              <ActionButton action={archiveBusinessAction} fields={fields} variant="danger" confirm="Archive this business? It disappears from every list and its site goes offline. It can be restored later.">
                Archive
              </ActionButton>
            )}
            {archived && (
              <ActionButton action={restoreBusinessAction} fields={fields} variant="primary" confirm="Restore this archived business?">
                Restore
              </ActionButton>
            )}
          </>
        }
      />

      {archived && (
        <Alert tone="warning" className="mb-4" title="This business is archived">
          It was archived {business.deletedAt ? formatDateTime(business.deletedAt) : ""}. It is hidden from tenant users and its site is offline. Restore it to make changes.
        </Alert>
      )}
      {suspended && (
        <Alert tone="danger" className="mb-4" title="This business is suspended">
          Tenant users cannot open the admin and the public site is offline until the suspension is lifted.
        </Alert>
      )}

      <BusinessTabs businessId={business.id} />
      {children}
      <p className="mt-8 text-xs text-neutral-400">
        Business id <span className="font-mono">{business.id}</span> · Created {formatDateTime(business.createdAt)} ·{" "}
        <Link href={`/super-admin/audit-logs?business=${business.id}`} className="hover:underline">
          Full audit trail
        </Link>
      </p>
    </div>
  );
}
