import { Container, SectionHeading } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Dated milestones along a vertical line. */
function TimelineBlock({ props, ctx, settings, editor }: TypedBlockProps<"timeline">) {
  const env = blockEnv(ctx, settings, "normal");
  const items = props.items ?? [];
  if (items.length === 0 && !editor) return null;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} className="mb-10" />
      {items.length === 0 ? (
        <p className="text-sm opacity-60">Add milestones from the section panel.</p>
      ) : (
        <ol className="site-timeline max-w-3xl space-y-10 pl-10">
          {items.map((item, i) => (
            <li key={i} className="relative">
              <span className="site-timeline-dot -left-10" aria-hidden="true" />
              {(item.date || editor) && (
                <time className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: env.onDark ? "inherit" : "var(--color-accent)" }} data-edit-field={`items.${i}.date`}>
                  {item.date || (editor ? "Add date" : "")}
                </time>
              )}
              <h3 className="text-xl leading-snug" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field={`items.${i}.title`}>
                {item.title}
              </h3>
              {(item.description || editor) && (
                <p className="mt-2 leading-relaxed opacity-80" data-edit-field={`items.${i}.description`}>
                  {item.description || (editor ? "Add a description" : "")}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Container>
  );
}

defineBlock("timeline", TimelineBlock);
