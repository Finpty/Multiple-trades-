import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { REVIEW_SOURCES, listReviewLinkOptions } from "@/lib/content/reviews";
import { PageHeader } from "@/components/ui";
import { ReviewForm } from "@/components/admin/content/reviews/review-form";

export const dynamic = "force-dynamic";

export default async function NewReviewPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const links = await listReviewLinkOptions(ctx.db, businessId);
  return (
    <div>
      <PageHeader title="Add review" breadcrumbs={[{ label: "Reviews", href: `/admin/${businessId}/reviews` }, { label: "New" }]} />
      <ReviewForm businessId={businessId} reviewId={null} values={{ authorName: "", rating: 5, title: "", body: "", source: "manual", reviewedAt: new Date().toISOString().slice(0, 10), projectId: null, serviceId: null, isPublished: true, isFeatured: false }} projects={links.projects} services={links.services} sources={REVIEW_SOURCES} />
    </div>
  );
}
