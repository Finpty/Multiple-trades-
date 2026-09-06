import Link from "next/link";
import { siteHref } from "@/lib/tenant/resolve";
import { siteTerminology, termPlural } from "@/lib/site/context";
import { loadFormBySlug } from "@/lib/site/blocks/forms";
import { loadServicesForBlock, listServiceOptions } from "@/lib/site/blocks/services";
import { Container, SectionHeading, SiteIcon } from "@/components/site/primitives";
import { FormRenderer } from "./forms/form-renderer";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/**
 * Quote request form. Pre-selects ?service=<slug> from the URL and, when
 * showServices is on, lists the services beside the form so visitors can
 * confirm what they are asking about.
 */
async function QuoteFormBlock({ props, ctx, settings, editor }: TypedBlockProps<"quote_form">) {
  const env = blockEnv(ctx, settings, "normal");
  const terms = siteTerminology(ctx);
  const [form, options] = await Promise.all([loadFormBySlug(ctx, props.formSlug), listServiceOptions(ctx)]);
  if (!form && !editor) return null;
  const services = props.showServices ? await loadServicesForBlock(ctx, { source: "all", limit: 12 }) : [];

  const formCard = (
    <div className="p-6 sm:p-8" style={{ background: "var(--color-background)", color: "var(--color-text)", border: "var(--border-width) solid var(--color-border)", borderRadius: "calc(var(--radius) * 1.25)", boxShadow: "0 24px 60px -40px color-mix(in srgb, var(--color-text) 40%, transparent)" }}>
      {form ? (
        <FormRenderer businessId={ctx.business.id} formSlug={form.slug} fields={form.fields} settings={form.settings} services={options} preselectFromQuery submitLabel={form.settings.submitLabel ?? `Request a ${terms.quote.toLowerCase()}`} buttonClassName={`site-btn--style-${env.tokens.buttonStyle}`} />
      ) : (
        <p className="text-sm opacity-60">Form “{props.formSlug}” was not found or is inactive. Choose a form in the section panel.</p>
      )}
    </div>
  );

  if (services.length === 0) {
    return (
      <Container width={env.width}>
        <div className="mx-auto max-w-2xl">
          <SectionHeading heading={props.heading} intro={props.intro} align="center" className="mb-8" />
          {formCard}
        </div>
      </Container>
    );
  }

  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} className="mb-10" />
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <aside className="lg:sticky lg:top-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{termPlural(terms, "service")} we {terms.quote.toLowerCase()}</p>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <Link href={siteHref(ctx, `/quote?service=${encodeURIComponent(s.slug)}`)} className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition hover:opacity-80" style={{ background: env.onDark ? "rgba(255,255,255,0.1)" : "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius)" }}>
                  <span className="flex items-center gap-2">
                    <SiteIcon name={s.icon ?? "chevron-right"} size={16} className="opacity-70" fallback={<SiteIcon name="chevron-right" size={16} className="opacity-70" />} />
                    {s.name}
                  </span>
                  {s.priceLabel && <span className="text-xs opacity-70">{s.priceLabel}</span>}
                </Link>
                {s.children.length > 0 && (
                  <ul className="ml-6 mt-1 space-y-1">
                    {s.children.map((c) => (
                      <li key={c.id}>
                        <Link href={siteHref(ctx, `/quote?service=${encodeURIComponent(c.slug)}`)} className="block px-3 py-1.5 text-sm opacity-80 hover:underline underline-offset-4">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>
        {formCard}
      </div>
    </Container>
  );
}

defineBlock("quote_form", QuoteFormBlock);
