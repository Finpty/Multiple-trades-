import { resolveMediaRef } from "@/lib/site/blocks/media";
import { Container, SmartImage } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Single image with caption. width: normal (container) / wide / full (edge to edge). */
async function ImageBlock({ props, ctx, settings, editor }: TypedBlockProps<"image">) {
  const env = blockEnv(ctx, settings, props.width === "wide" ? "wide" : props.width === "full" ? "full" : "normal");
  const image = await resolveMediaRef(ctx, props.image);
  if (!image && !editor) return null;
  const figure = (
    <figure className="site-image-block">
      <SmartImage image={image} imageStyle={env.tokens.imageStyle} editField="image" editor={editor} rounded={props.width !== "full"} sizes={props.width === "normal" ? "(min-width: 1024px) 960px, 100vw" : "100vw"} aspect={image ? "auto" : "16/9"} />
      {(props.caption || editor) && (
        <figcaption className="mt-3 text-center text-sm opacity-70" data-edit-field="caption">
          {props.caption || (editor ? "Add a caption" : "")}
        </figcaption>
      )}
    </figure>
  );
  if (props.width === "full") return <Container width="full" flush>{figure}</Container>;
  return <Container width={props.width === "wide" ? "wide" : env.width}>{figure}</Container>;
}

defineBlock("image", ImageBlock);
