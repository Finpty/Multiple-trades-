import { sanitizeHtml } from "@/lib/site/blocks/sanitize";
import { Container, Prose } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Free-form HTML, sanitised (no scripts, no event handlers, no javascript: URLs). */
function RichContentBlock({ props, ctx, settings, editor }: TypedBlockProps<"rich_content">) {
  const env = blockEnv(ctx, settings, "normal");
  const html = sanitizeHtml(props.html ?? "");
  return (
    <Container width={env.width}>
      {html.trim() ? (
        <Prose html={html} editField="html" />
      ) : editor ? (
        <div className="border-2 border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", borderRadius: "var(--radius)" }} data-edit-field="html">
          Add custom HTML content
        </div>
      ) : null}
    </Container>
  );
}

defineBlock("rich_content", RichContentBlock);
