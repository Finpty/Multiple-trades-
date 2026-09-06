import { Container, IconBadge, SectionHeading } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

const COLS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

/** Features / USPs: icon + title + description grid (2–4 columns). */
function FeaturesBlock({ props, ctx, settings, editor }: TypedBlockProps<"features">) {
  const env = blockEnv(ctx, settings, "normal");
  const items = props.items ?? [];
  if (items.length === 0 && !editor) return null;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} align="center" className="mb-12" />
      {items.length === 0 ? (
        <p className="text-center text-sm opacity-60">Add features from the section panel.</p>
      ) : (
        <ul className={`grid grid-cols-1 gap-x-8 gap-y-10 ${COLS[props.columns ?? 3] ?? COLS[3]}`}>
          {items.map((item, i) => (
            <li key={i} className="flex flex-col items-start gap-4">
              <IconBadge name={item.icon} fallback={<span className="text-lg">{String(i + 1).padStart(2, "0")}</span>} tone={env.onDark ? "surface" : "accent"} />
              <div>
                <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field={`items.${i}.title`}>
                  {item.title}
                </h3>
                {(item.description || editor) && (
                  <p className="mt-2 text-sm leading-relaxed opacity-80 sm:text-base" data-edit-field={`items.${i}.description`}>
                    {item.description || (editor ? "Add a description" : "")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

defineBlock("features", FeaturesBlock);
