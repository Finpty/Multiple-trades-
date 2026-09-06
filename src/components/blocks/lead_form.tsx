import { resolveMediaRef } from "@/lib/site/blocks/media";
import { loadFormBySlug } from "@/lib/site/blocks/forms";
import { listServiceOptions } from "@/lib/site/blocks/services";
import { Container, SectionHeading, SmartImage } from "@/components/site/primitives";
import { FormRenderer } from "./forms/form-renderer";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Lead form: stacked (centred card) or split (form beside an image). */
async function LeadFormBlock({ props, ctx, settings, editor }: TypedBlockProps<"lead_form">) {
  const env = blockEnv(ctx, settings, "normal");
  const [form, image] = await Promise.all([loadFormBySlug(ctx, props.formSlug), resolveMediaRef(ctx, props.image)]);
  if (!form && !editor) return null;
  const services = form && form.fields.some((f) => f.type === "service") ? await listServiceOptions(ctx) : [];
  const layout = props.layout ?? "stacked";

  const formCard = (
    <div className="p-6 sm:p-8" style={{ background: "var(--color-background)", color: "var(--color-text)", border: "var(--border-width) solid var(--color-border)", borderRadius: "calc(var(--radius) * 1.25)", boxShadow: "0 24px 60px -40px color-mix(in srgb, var(--color-text) 40%, transparent)" }}>
      {form ? (
        <FormRenderer businessId={ctx.business.id} formSlug={form.slug} fields={form.fields} settings={form.settings} services={services} preselectFromQuery buttonClassName={`site-btn--style-${env.tokens.buttonStyle}`} />
      ) : (
        <p className="text-sm opacity-60">Form “{props.formSlug}” was not found or is inactive. Choose a form in the section panel.</p>
      )}
    </div>
  );

  if (layout === "split") {
    return (
      <Container width={env.width}>
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-24">
            <SectionHeading heading={props.heading} intro={props.intro} className="mb-8" />
            <SmartImage image={image} aspect="4/3" imageStyle={env.tokens.imageStyle} editField="image" editor={editor} sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
          {formCard}
        </div>
      </Container>
    );
  }

  return (
    <Container width={env.width}>
      <div className="mx-auto max-w-2xl">
        <SectionHeading heading={props.heading} intro={props.intro} align="center" className="mb-8" />
        {formCard}
      </div>
    </Container>
  );
}

defineBlock("lead_form", LeadFormBlock);
