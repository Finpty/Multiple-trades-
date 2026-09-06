import { tenantDb } from "@/lib/db";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { siteHref } from "@/lib/tenant/resolve";
import { siteTerminology } from "@/lib/site/context";
import { listServiceOptions } from "@/lib/site/blocks/services";
import { Container, SectionHeading } from "@/components/site/primitives";
import { CalculatorClient, type CalculatorField } from "./forms/calculator-client";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

const DEFAULT_DISCLAIMER = "This is an instant guide price based on the details you entered. Final pricing is confirmed in a written quote after we review the job.";

/**
 * Calculator: ESTIMATE custom field definitions (shown on forms) + service
 * select, priced by the public estimate API. The "formal quote" button
 * carries the inputs to /quote?service=<slug>&…
 */
async function CalculatorBlock({ props, ctx, settings }: TypedBlockProps<"calculator">) {
  const env = blockEnv(ctx, settings, "normal");
  const terms = siteTerminology(ctx);
  const [defs, services] = await Promise.all([listFieldDefinitions(tenantDb(ctx.business.id), ctx.business.id, "ESTIMATE"), listServiceOptions(ctx)]);
  const fields: CalculatorField[] = defs
    .filter((d) => d.showOnForms && d.type !== "MEDIA")
    .map((d) => ({ key: d.key, label: d.label, type: d.type, options: d.options, isRequired: d.isRequired, helpText: d.helpText, defaultValue: d.defaultValue ?? null, validation: { unit: d.validation.unit, min: d.validation.min, max: d.validation.max } }));
  const defaultServiceId = props.serviceId && services.some((s) => s.id === props.serviceId) ? props.serviceId : null;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} align="center" className="mb-10" />
      <div className="mx-auto max-w-5xl">
        <CalculatorClient
          businessId={ctx.business.id}
          fields={fields}
          services={services}
          defaultServiceId={defaultServiceId}
          disclaimer={props.disclaimer?.trim() || DEFAULT_DISCLAIMER}
          currency={ctx.business.currency}
          locale={ctx.business.locale}
          quoteHref={siteHref(ctx, "/quote")}
          buttonClassName={`site-btn--style-${env.tokens.buttonStyle}`}
          serviceLabel={terms.service}
          quoteLabel={`Request a formal ${terms.quote.toLowerCase()}`}
        />
        {props.disclaimer && (
          <p className="sr-only" data-edit-field="disclaimer">
            {props.disclaimer}
          </p>
        )}
      </div>
    </Container>
  );
}

defineBlock("calculator", CalculatorBlock);
