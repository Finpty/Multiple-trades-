import { Container, SectionHeading } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Key numbers in a responsive row. Values use the heading font; labels are muted. */
function StatsBlock({ props, ctx, settings, editor }: TypedBlockProps<"stats">) {
  const env = blockEnv(ctx, settings, "normal");
  const items = props.items ?? [];
  if (items.length === 0 && !editor) return null;
  const cols = items.length <= 2 ? "sm:grid-cols-2" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} align="center" className="mb-10" />
      {items.length === 0 ? (
        <p className="text-center text-sm opacity-60">Add statistics from the section panel.</p>
      ) : (
        <dl className={`grid grid-cols-1 gap-6 ${cols}`}>
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-4 py-6 text-center" style={{ borderLeft: i > 0 ? "var(--border-width) solid var(--color-border)" : undefined }}>
              <dd className="order-1 text-4xl tabular-nums tracking-tight sm:text-5xl" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"], color: env.onDark ? "inherit" : "var(--color-primary)" }} data-edit-field={`items.${i}.value`}>
                {item.value}
              </dd>
              <dt className="order-2 text-sm font-medium uppercase tracking-[0.12em] opacity-70" data-edit-field={`items.${i}.label`}>
                {item.label}
              </dt>
            </div>
          ))}
        </dl>
      )}
    </Container>
  );
}

defineBlock("stats", StatsBlock);
