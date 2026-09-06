import { resolveMediaRefs, type ResolvedMedia } from "@/lib/site/blocks/media";
import { loadProjectAfterImages } from "@/lib/site/blocks/projects";
import { loadMediaByTag } from "@/lib/site/blocks/gallery";
import { Container, SectionHeading, SmartImage } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

const COLS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5" };

/**
 * Image grid. Sources: manual MediaRefs, AFTER images of published projects,
 * or public media carrying a tag. Each tile links to the full-size file.
 */
async function GalleryBlock({ props, ctx, settings, editor }: TypedBlockProps<"gallery">) {
  const env = blockEnv(ctx, settings, "normal");
  const source = props.source ?? "manual";
  const columns = props.columns ?? 3;
  let images: Array<ResolvedMedia & { caption?: string; editField?: string }> = [];
  if (source === "projects") images = await loadProjectAfterImages(ctx, columns * 4);
  else if (source === "media_tag") images = await loadMediaByTag(ctx, props.tag, columns * 4);
  else images = (await resolveMediaRefs(ctx, props.images ?? [])).map((img, i) => ({ ...img, editField: `images.${i}` }));

  if (images.length === 0 && !editor) return null;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} align="center" className="mb-10" />
      {images.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center border-2 border-dashed text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", borderRadius: "var(--radius)" }} data-edit-image={source === "manual" ? `images.0` : undefined} role={source === "manual" ? "button" : undefined}>
          {source === "manual" ? "Add images" : source === "projects" ? "Publish projects with after photos to fill this gallery." : `No public images tagged "${props.tag ?? ""}" yet.`}
        </div>
      ) : (
        <ul className={`grid grid-cols-2 gap-3 sm:gap-4 ${COLS[columns] ?? COLS[3]}`}>
          {images.map((img, i) => (
            <li key={`${img.id || img.url}-${i}`} className="site-card--interactive overflow-hidden" style={{ borderRadius: "var(--radius)" }}>
              <a href={img.large || img.url} target="_blank" rel="noopener" className="block" aria-label={img.caption || img.alt || `Image ${i + 1}`}>
                <SmartImage image={img} aspect="1/1" imageStyle={env.tokens.imageStyle} sizes={`(min-width: 1024px) ${Math.round(100 / columns)}vw, 50vw`} editField={img.editField} editor={editor} />
              </a>
              {img.caption && <p className="px-1 pt-2 text-xs opacity-70">{img.caption}</p>}
            </li>
          ))}
          {editor && source === "manual" && (
            <li>
              <SmartImage image={null} aspect="1/1" editField={`images.${images.length}`} editor placeholderLabel="Add image" />
            </li>
          )}
        </ul>
      )}
    </Container>
  );
}

defineBlock("gallery", GalleryBlock);
