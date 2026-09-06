import { loadServiceById } from "@/lib/site/blocks/services";
import { renderMarkdown } from "@/lib/site/blocks/markdown";
import { Container, Prose, SectionHeading, SiteIcon } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/**
 * FAQ accordion (native <details>, no JS). Items come from the block props or
 * from a service's own FAQ list (source = "service"). Answers accept Markdown.
 */
async function FaqBlock({ props, ctx, settings, editor }: TypedBlockProps<"faq">) {
  const env = blockEnv(ctx, settings, "normal");
  let items: Array<{ question: string; answer: string }> = props.items ?? [];
  let editable = true;
  if (props.source === "service") {
    const service = await loadServiceById(ctx, props.serviceId);
    items = service?.faqs ?? [];
    editable = false;
  }
  if (items.length === 0 && !editor) return null;
  return (
    <Container width={env.width}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <SectionHeading heading={props.heading} />
        <div className="site-faq" style={{ borderTop: "var(--border-width) solid var(--color-border)" }}>
          {items.length === 0 && <p className="py-6 text-sm opacity-60">{props.source === "service" ? "Choose a service with FAQs in the section panel." : "Add questions from the section panel."}</p>}
          {items.map((item, i) => (
            <details key={i} open={editor && i === 0}>
              <summary>
                <span className="text-base sm:text-lg" data-edit-field={editable ? `items.${i}.question` : undefined}>
                  {item.question}
                </span>
                <span className="site-faq-chevron">
                  <SiteIcon name="chevron-down" size={20} />
                </span>
              </summary>
              <div className="site-faq-answer">
                <Prose html={renderMarkdown(item.answer)} editField={editable ? `items.${i}.answer` : undefined} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </Container>
  );
}

defineBlock("faq", FaqBlock);
