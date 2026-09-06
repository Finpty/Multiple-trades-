import { loadReviewsForBlock, type SiteReview } from "@/lib/site/blocks/reviews";
import { initials } from "@/lib/site/blocks/common";
import { Container, Rating, SectionHeading, SiteCard } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

function ReviewCard({ review, showRating, compact = false }: { review: SiteReview; showRating: boolean; compact?: boolean }) {
  return (
    <SiteCard className="h-full">
      {showRating && <Rating value={review.rating} size={compact ? 14 : 16} className="mb-4" />}
      {review.title && (
        <h3 className="mb-2 text-base font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
          {review.title}
        </h3>
      )}
      <blockquote className={["flex-1 leading-relaxed opacity-90", compact ? "text-sm" : "text-base"].join(" ")}>
        <p>“{review.body}”</p>
      </blockquote>
      <footer className="mt-5 flex items-center gap-3 text-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: "var(--color-accent)" }} aria-hidden="true">
          {initials(review.authorName) || "★"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{review.authorName}</p>
          <p className="truncate text-xs opacity-65">
            {[review.serviceName ?? review.projectTitle, review.source, review.dateLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
      </footer>
    </SiteCard>
  );
}

/** Customer reviews: grid, list or scroll-snap carousel, with an average-rating summary. */
async function ReviewsBlock({ props, ctx, settings, editor }: TypedBlockProps<"reviews">) {
  const env = blockEnv(ctx, settings, "normal");
  const { reviews, average, count } = await loadReviewsForBlock(ctx, { source: props.source ?? "featured", limit: props.limit ?? 6 });
  if (reviews.length === 0 && !editor) return null;
  const layout = props.layout ?? "grid";
  const showRating = props.showRating ?? true;
  return (
    <Container width={env.width}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <SectionHeading heading={props.heading} />
        {showRating && average !== null && count > 0 && (
          <div className="flex items-center gap-3">
            <Rating value={average} size={20} />
            <p className="text-sm">
              <span className="text-lg font-semibold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>{average.toFixed(1)}</span>
              <span className="opacity-70"> / 5 from {count} review{count === 1 ? "" : "s"}</span>
            </p>
          </div>
        )}
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm opacity-60">No published reviews yet — add them under Reviews in the admin.</p>
      ) : layout === "carousel" ? (
        <ul className="site-carousel -mx-5 px-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {reviews.map((r) => (
            <li key={r.id} className="w-[84vw] max-w-md sm:w-[48vw] lg:w-[32%]">
              <ReviewCard review={r} showRating={showRating} />
            </li>
          ))}
        </ul>
      ) : layout === "list" ? (
        <ul className="mx-auto max-w-3xl space-y-5">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard review={r} showRating={showRating} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`grid grid-cols-1 gap-6 ${reviews.length === 2 || reviews.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard review={r} showRating={showRating} compact />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

defineBlock("reviews", ReviewsBlock);
