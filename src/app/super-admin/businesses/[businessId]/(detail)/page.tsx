import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getBusinessCounts, getBusinessForAdmin } from "@/lib/platform/businesses";
import { Alert, Stat } from "@/components/ui";
import { BusinessDetailsForm } from "@/components/super-admin/core/business-details-form";
import { updateBusinessDetailsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BusinessDetailsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { db } = await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const archived = !!business.deletedAt;
  const [industries, organizations, counts] = await Promise.all([
    prisma.industry.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    archived ? null : getBusinessCounts(businessId),
  ]);

  return (
    <div className="space-y-6">
      {counts && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Stat label="Pages" value={counts.pages} />
          <Stat label="Services" value={counts.services} />
          <Stat label="Media" value={counts.media} />
          <Stat label="Leads" value={counts.leads} />
          <Stat label="Quotes" value={counts.quotes} />
          <Stat label="Jobs" value={counts.jobs} />
          <Stat label="Members" value={counts.members} />
        </div>
      )}
      {archived && <Alert tone="neutral">Details are read-only while the business is archived.</Alert>}
      <BusinessDetailsForm
        action={updateBusinessDetailsAction}
        disabled={archived}
        industries={industries}
        organizations={organizations}
        business={{
          id: business.id,
          name: business.name,
          slug: business.slug,
          legalName: business.legalName,
          tradingName: business.tradingName,
          businessNumber: business.businessNumber,
          taxNumber: business.taxNumber,
          phone: business.phone,
          email: business.email,
          website: business.website,
          tagline: business.tagline,
          description: business.description,
          country: business.country,
          state: business.state,
          timezone: business.timezone,
          currency: business.currency,
          locale: business.locale,
          taxName: business.taxName,
          taxRate: business.taxRate.toString(),
          taxInclusive: business.taxInclusive,
          serviceAreaText: business.serviceAreaText,
          industryId: business.industryId,
          organizationId: business.organizationId,
        }}
      />
    </div>
  );
}
