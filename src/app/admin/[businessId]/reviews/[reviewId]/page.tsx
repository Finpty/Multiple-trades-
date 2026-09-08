import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { REVIEW_SOURCES, listReviewLinkOptions, toDateInput } from "@/lib/content/reviews";
import { Badge, PageHeader } from "@/components/ui";
import { ReviewForm } from "@/components/admin/content/reviews/review-form";

export const dynamic = "force-dynamic";

export default async function EditReviewPage({ params }: { params: Promise<{ businessId: string; reviewId: string }> }) {
  const { businessId, reviewId } = await params;
  if (!isUuid(businessId) || !isUuid(reviewId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const [r, links] = await Promise.all([ctx.db.review.findFirst({ where: { id: reviewId, businessId, deletedAt: undefined } }), listReviewLinkOptions(ctx.db, businessId)]);
  if (!r) notFound();
  const sources = REVIEW_SOURCES.includes(r.source as (typeof REVIEW_SOURCES)[number]) || !r.source ? REVIEW_SOURCES : [...REVIEW_SOURCES, r.source];
  return (
    <div>
      <PageHeader title={`Review by ${r.authorName}`} description={<Badge tone={r.deletedAt ? "neutral" : r.isPublished ? "green" : "amber"}>{r.deletedAt ? "ARCHIVED" : r.isPublished ? "PUBLISHED" : "HIDDEN"}</Badge>} breadcrumbs={[{ label: "Reviews", href: `/admin/${businessId}/reviews` }, { label: r.authorName }]} />
      <ReviewForm businessId={businessId} reviewId={r.id} values={{ authorName: r.authorName, rating: r.rating, title: r.title ?? "", body: r.body, source: r.source ?? "manual", reviewedAt: toDateInput(r.reviewedAt), projectId: r.projectId, serviceId: r.serviceId, isPublished: r.isPublished, isFeatured: r.isFeatured }} projects={links.projects} services={links.services} sources={sources} />
    </div>
  );
}
