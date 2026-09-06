import { resolveMediaRef } from "@/lib/site/blocks/media";
import { videoEmbedUrl } from "@/lib/site/blocks/common";
import { Container } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/**
 * Video: an uploaded VIDEO media row plays in a native <video controls>;
 * a YouTube / Vimeo URL becomes a privacy-enhanced iframe embed.
 */
async function VideoBlock({ props, ctx, settings, editor }: TypedBlockProps<"video">) {
  const env = blockEnv(ctx, settings, "normal");
  const [video, poster] = await Promise.all([resolveMediaRef(ctx, props.video), resolveMediaRef(ctx, props.poster)]);
  const embed = videoEmbedUrl(props.embedUrl) ?? (video && video.kind !== "VIDEO" ? videoEmbedUrl(video.url) : null);
  const uploaded = video && video.kind === "VIDEO" ? video : null;
  const frame: React.CSSProperties = { aspectRatio: "16 / 9", borderRadius: "var(--radius)", background: "var(--color-surface)" };

  let media: React.ReactNode = null;
  if (uploaded) {
    media = (
      <video className="h-full w-full object-cover" src={uploaded.url} poster={poster?.large} controls playsInline preload="metadata" style={{ borderRadius: "var(--radius)" }} data-edit-image="video">
        Your browser does not support embedded video.
      </video>
    );
  } else if (embed) {
    media = <iframe src={embed.src} title={props.caption || "Video"} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" style={{ borderRadius: "var(--radius)" }} />;
  } else if (editor) {
    media = (
      <div className="flex h-full w-full items-center justify-center border-2 border-dashed text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", borderRadius: "var(--radius)" }} data-edit-image="video" data-edit-field="embedUrl" role="button" tabIndex={0}>
        Add a video (upload or paste a YouTube / Vimeo link)
      </div>
    );
  } else {
    return null;
  }

  return (
    <Container width={env.width}>
      <figure className="site-video mx-auto max-w-5xl">
        <div className="relative w-full overflow-hidden" style={frame}>{media}</div>
        {(props.caption || editor) && (
          <figcaption className="mt-3 text-center text-sm opacity-70" data-edit-field="caption">
            {props.caption || (editor ? "Add a caption" : "")}
          </figcaption>
        )}
      </figure>
    </Container>
  );
}

defineBlock("video", VideoBlock);
