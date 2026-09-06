import { renderMarkdown } from "@/lib/site/blocks/markdown";
import { Container, Prose } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Text: optional heading + Markdown body (rendered by our safe renderer). */
function TextBlock({ props, ctx, settings }: TypedBlockProps<"text">) {
  const env = blockEnv(ctx, settings, props.width ?? "normal");
  const width = props.width === "narrow" ? "max-w-3xl" : props.width === "wide" ? "max-w-6xl" : "max-w-4xl";
  const center = props.align === "center";
  return (
    <Container width={env.width}>
      <div className={[width, center ? "mx-auto text-center" : ""].join(" ")}>
        {props.heading && (
          <h2 className="mb-6 text-balance text-2xl leading-tight tracking-tight sm:text-3xl lg:text-[2.5rem]" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field="heading">
            {props.heading}
          </h2>
        )}
        <Prose html={renderMarkdown(props.body ?? "")} editField="body" size="lg" className={center ? "[&_ul]:inline-block [&_ul]:text-left" : ""} />
      </div>
    </Container>
  );
}

defineBlock("text", TextBlock);
