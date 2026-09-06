import { resolveMediaRef } from "@/lib/site/blocks/media";
import { embeddable3dUrl } from "@/lib/site/blocks/common";
import { Container, SectionHeading, SmartImage } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/**
 * 3D viewer without any client library: known embeddable viewers (Sketchfab,
 * Matterport, Kuula, p3d.in, …) render in an iframe; any other model URL
 * shows the poster with an "open model" link.
 */
async function Viewer3dBlock({ props, ctx, settings, editor }: TypedBlockProps<"viewer_3d">) {
  const env = blockEnv(ctx, settings, "normal");
  const poster = await resolveMediaRef(ctx, props.poster);
  const embed = embeddable3dUrl(props.modelUrl);
  const rawUrl = props.modelUrl && /^https?:\/\//i.test(props.modelUrl) ? props.modelUrl : null;
  if (!embed && !poster && !rawUrl && !editor) return null;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} align="center" className="mb-8" />
      <div className="mx-auto max-w-5xl">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9", borderRadius: "var(--radius)", background: "var(--color-surface)", border: "var(--border-width) solid var(--color-border)" }}>
          {embed ? (
            <iframe src={embed} title={props.heading || "3D model"} className="absolute inset-0 h-full w-full" allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          ) : (
            <>
              <SmartImage image={poster} aspect="16/9" imageStyle={env.tokens.imageStyle} editField="poster" editor={editor} className="absolute inset-0" placeholderLabel="Add poster image" />
              {rawUrl && (
                <a href={rawUrl} target="_blank" rel="noopener noreferrer" className="site-btn site-btn--primary site-btn--md site-btn--style-solid absolute bottom-4 left-1/2 -translate-x-1/2">
                  Open 3D model
                </a>
              )}
              {!rawUrl && editor && !poster && (
                <p className="absolute inset-x-0 bottom-4 text-center text-xs opacity-70" data-edit-field="modelUrl">
                  Paste a Sketchfab, Matterport or model URL in the section panel.
                </p>
              )}
            </>
          )}
        </div>
        {!embed && rawUrl && <p className="mt-2 text-center text-xs opacity-60">The model opens in a new tab.</p>}
        {(props.caption || editor) && (
          <p className="mt-3 text-center text-sm opacity-70" data-edit-field="caption">
            {props.caption || (editor ? "Add a caption" : "")}
          </p>
        )}
      </div>
    </Container>
  );
}

defineBlock("viewer_3d", Viewer3dBlock);
