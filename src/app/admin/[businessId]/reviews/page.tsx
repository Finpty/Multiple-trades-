import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listReviews, reviewStats, type ReviewFilter } from "@/lib/content/reviews";
import { ButtonLink, EmptyState, PageHeader, Stat, cn, formatDate } from "@/components/ui";
import { ReviewsList } from "@/components/admin/content/reviews/reviews-list";
import { reorderReviewsAction, reviewStateAction } from "./actions";

export const dynamic = "force-dynamic";
const FILTERS: Array<{ key: ReviewFilter; label: string }> = [{ key: "all", label: "All" }, { key: "published", label: "Published" }, { key: "hidden", label: "Hidden" }, { key: "featured", label: "Featured" }, { key: "archived", label: "Archived" }];

export default async function ReviewsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ filter?: string; q?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as ReviewFilter;
  const q = (sp.q ?? "").trim();
  const [rows, stats] = await Promise.all([listReviews(ctx.db, businessId, { filter, q: q || undefined }), reviewStats(ctx.db, businessId)]);
  const base = `/admin/${businessId}/reviews`;
  return (
    <div>
      <PageHeader title="Reviews" description="Customer reviews shown in review blocks and on service and project pages. Reviews also feed the star rating in search results." actions={<ButtonLink href={`${base}/new`}>Add review</ButtonLink>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Published reviews" value={stats.count} />
        <Stat label="Average rating" value={stats.count ? `${stats.average} / 5` : "—"} />
        <Stat label="5-star share" value={stats.count ? `${Math.round(((stats.byRating[5] ?? 0) / stats.count) * 100)}%` : "—"} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {FILTERS.map((f) => <Link key={f.key} href={f.key === "all" && !q ? base : `${base}?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("rounded-full px-3 py-1 text-sm", f.key === filter ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>{f.label}</Link>)}
        <form className="ml-auto" action={base}>{filter !== "all" && <input type="hidden" name="filter" value={filter} />}<input name="q" defaultValue={q} placeholder="Search reviews" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm" aria-label="Search reviews" /></form>
      </div>
      {rows.length === 0 ? <EmptyState title={q ? "No matches" : "No reviews yet"} description="Add reviews you have received, or save a project testimonial as a review." action={!q && <ButtonLink href={`${base}/new`}>Add review</ButtonLink>} /> : (
        <ReviewsList businessId={businessId} sortable={filter === "all" && !q} rows={rows.map((r) => ({ id: r.id, author: r.authorName, rating: r.rating, title: r.title ?? "", excerpt: r.body.slice(0, 140), meta: [r.source, r.reviewedAt ? formatDate(r.reviewedAt) : null, r.serviceName, r.projectTitle].filter(Boolean).join(" · "), isPublished: r.isPublished, isFeatured: r.isFeatured, archived: !!r.deletedAt }))} setState={reviewStateAction} reorder={reorderReviewsAction} />
      )}
    </div>
  );
}
