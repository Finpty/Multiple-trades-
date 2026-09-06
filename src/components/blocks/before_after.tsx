import { resolveMediaRef } from "@/lib/site/blocks/media";
import { Container, SectionHeading, SmartImage } from "@/components/site/primitives";
import { BeforeAfterSlider } from "./before-after-slider";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Before / after slider. In the editor, missing images show click-to-add placeholders. */
async function BeforeAfterBlock({ props, ctx, settings, editor }: TypedBlockProps<"before_after">) {
  const env = blockEnv(ctx, settings, "normal");
  const [before, after] = await Promise.all([resolveMediaRef(ctx, props.before), resolveMediaRef(ctx, props.after)]);
  if ((!before || !after) && !editor) return null;
  const filterClass = `site-img site-img--${env.tokens.imageStyle}`;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} align="center" className="mb-8" />
      <div className="mx-auto max-w-4xl">
        {before && after ? (
          <div data-edit-image="after">
            <BeforeAfterSlider before={before.large} after={after.large} beforeAlt={before.alt || "Before"} afterAlt={after.alt || "After"} filterClass={filterClass} aspect={before.width && before.height ? `${before.width} / ${before.height}` : "4 / 3"} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SmartImage image={before} aspect="4/3" editField="before" editor placeholderLabel="Add before image" />
            <SmartImage image={after} aspect="4/3" editField="after" editor placeholderLabel="Add after image" />
          </div>
        )}
        {(props.caption || editor) && (
          <p className="mt-3 text-center text-sm opacity-70" data-edit-field="caption">
            {props.caption || (editor ? "Add a caption" : "")}
          </p>
        )}
      </div>
    </Container>
  );
}

defineBlock("before_after", BeforeAfterBlock);
