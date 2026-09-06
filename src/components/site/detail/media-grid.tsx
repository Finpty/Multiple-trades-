import type { MediaUrlSet } from "@/lib/media/service";

export interface MediaGridItem {
  media: MediaUrlSet;
  caption?: string | null;
}

/** Responsive image grid with lightbox-free full-size links; videos render inline. */
export function MediaGrid({ items, columns = 3 }: { items: MediaGridItem[]; columns?: 2 | 3 | 4 }) {
  if (!items.length) return null;
  const cols = columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <ul className={`grid gap-4 ${cols}`}>
      {items.map(({ media, caption }) => (
        <li key={media.id} className="overflow-hidden rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          {media.kind === "VIDEO" ? (
            <video controls preload="metadata" className="aspect-[4/3] w-full object-cover" src={media.url} />
          ) : (
            <a href={media.large} target="_blank" rel="noopener" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.medium} alt={caption || media.alt} loading="lazy" width={media.width ?? undefined} height={media.height ?? undefined} className="aspect-[4/3] w-full object-cover transition hover:scale-[1.02]" />
            </a>
          )}
          {caption && <p className="px-3 py-2 text-xs opacity-75">{caption}</p>}
        </li>
      ))}
    </ul>
  );
}

export function SiteVideo({ media, poster }: { media: MediaUrlSet; poster?: MediaUrlSet | null }) {
  return <video controls preload="metadata" poster={poster?.large} className="w-full rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)", background: "#000" }} src={media.url} />;
}
