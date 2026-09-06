import type { ResolvedMedia } from "@/lib/site/blocks/media";
import type { ThemeTokens } from "@/lib/theme/tokens";

export type ImageAspect = "auto" | "16/9" | "4/3" | "3/2" | "1/1" | "3/4" | "21/9";

const ASPECT: Record<ImageAspect, string | undefined> = { auto: undefined, "16/9": "16 / 9", "4/3": "4 / 3", "3/2": "3 / 2", "1/1": "1 / 1", "3/4": "3 / 4", "21/9": "21 / 9" };

/**
 * Responsive image from a resolved media row. Emits srcset from the stored
 * renditions, applies the theme's image treatment class, and — in editor
 * mode only — renders a dashed "Add image" placeholder when nothing is set.
 */
export function SmartImage({
  image,
  alt,
  aspect = "auto",
  fit = "cover",
  sizes = "(min-width: 1024px) 50vw, 100vw",
  className = "",
  imgClassName = "",
  imageStyle = "natural",
  editField,
  editor = false,
  priority = false,
  placeholderLabel = "Add image",
  rounded = true,
  fallback = null,
  style,
}: {
  image: ResolvedMedia | null | undefined;
  alt?: string;
  aspect?: ImageAspect;
  fit?: "cover" | "contain";
  sizes?: string;
  className?: string;
  imgClassName?: string;
  imageStyle?: ThemeTokens["imageStyle"];
  /** data-edit-image prop path */
  editField?: string;
  editor?: boolean;
  priority?: boolean;
  placeholderLabel?: string;
  rounded?: boolean;
  /** Rendered when there is no image and we are not in editor mode. */
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const radius = rounded ? "var(--radius)" : undefined;
  const frameStyle: React.CSSProperties = { aspectRatio: ASPECT[aspect], borderRadius: radius, ...style };
  if (!image) {
    if (editor && editField) {
      return (
        <div
          className={["site-image-placeholder flex items-center justify-center overflow-hidden border-2 border-dashed text-sm", className].join(" ")}
          style={{ ...frameStyle, aspectRatio: ASPECT[aspect] ?? "4 / 3", borderColor: "var(--color-border)", color: "var(--color-muted)", background: "var(--color-surface)", minHeight: 96 }}
          data-edit-image={editField}
          role="button"
          tabIndex={0}
          aria-label={placeholderLabel}
        >
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            {placeholderLabel}
          </span>
        </div>
      );
    }
    return <>{fallback}</>;
  }
  const isExternal = !image.id;
  const srcSet = isExternal || image.kind !== "IMAGE" ? undefined : [`${image.thumb} 320w`, `${image.medium} 960w`, `${image.large} 1920w`].join(", ");
  const src = image.kind === "IMAGE" ? image.medium : image.url;
  return (
    <div className={["site-image overflow-hidden", className].join(" ")} style={frameStyle} data-edit-image={editField}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt ?? image.alt ?? ""}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className={[`site-img site-img--${imageStyle}`, aspect === "auto" ? "h-auto w-full" : "h-full w-full", fit === "cover" ? "object-cover" : "object-contain", imgClassName].join(" ")}
        style={{ borderRadius: radius }}
      />
    </div>
  );
}
