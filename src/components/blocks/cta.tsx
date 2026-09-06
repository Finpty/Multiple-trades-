import { siteHref } from "@/lib/tenant/resolve";
import { Container, SiteButton } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/**
 * Call to action. band = full-width primary band (unless the section already
 * has a coloured background), card = contained highlighted card, minimal =
 * heading + buttons inline.
 */
function CtaBlock({ props, ctx, settings }: TypedBlockProps<"cta">) {
  const env = blockEnv(ctx, settings, "normal");
  const style = props.style ?? "band";
  const paintBand = style === "band" && !env.onDark && env.background !== "image";
  const onDark = env.onDark || paintBand || env.background === "image";

  const buttons = (props.primaryCta || props.secondaryCta) && (
    <div className={["flex flex-wrap gap-3", style === "minimal" ? "" : "justify-center"].join(" ")}>
      {props.primaryCta && (
        <SiteButton href={siteHref(ctx, props.primaryCta.href)} variant={props.primaryCta.style === "link" ? "link" : "primary"} buttonStyle={env.tokens.buttonStyle} size="lg" onDark={onDark} editField="primaryCta.label">
          {props.primaryCta.label}
        </SiteButton>
      )}
      {props.secondaryCta && (
        <SiteButton href={siteHref(ctx, props.secondaryCta.href)} variant={props.secondaryCta.style === "primary" ? "primary" : props.secondaryCta.style === "link" ? "link" : "secondary"} buttonStyle={env.tokens.buttonStyle} size="lg" onDark={onDark} editField="secondaryCta.label">
          {props.secondaryCta.label}
        </SiteButton>
      )}
    </div>
  );

  const heading = (
    <h2 className={["text-balance leading-tight tracking-tight", style === "minimal" ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl"].join(" ")} style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field="heading">
      {props.heading}
    </h2>
  );
  const body = props.body && (
    <p className={["leading-relaxed opacity-85", style === "minimal" ? "mt-2 text-base" : "mt-4 text-lg"].join(" ")} data-edit-field="body">
      {props.body}
    </p>
  );

  if (style === "minimal") {
    return (
      <Container width={env.width}>
        <div className="flex flex-col gap-6 py-2 md:flex-row md:items-center md:justify-between" style={{ borderTop: "var(--border-width) solid var(--color-border)", borderBottom: "var(--border-width) solid var(--color-border)", paddingTop: "1.75rem", paddingBottom: "1.75rem" }}>
          <div className="max-w-2xl">
            {heading}
            {body}
          </div>
          {buttons}
        </div>
      </Container>
    );
  }

  if (style === "card") {
    return (
      <Container width={env.width}>
        <div className={["site-cta-card mx-auto max-w-4xl px-6 py-12 text-center sm:px-12 sm:py-16", onDark ? "site-on-dark" : ""].join(" ")} style={{ background: env.onDark ? "rgba(255,255,255,0.08)" : "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "calc(var(--radius) * 1.5)" }}>
          {heading}
          {body}
          {buttons && <div className="mt-8">{buttons}</div>}
        </div>
      </Container>
    );
  }

  return (
    <div className={["site-cta-band", paintBand ? "site-on-dark" : ""].join(" ")} style={paintBand ? { background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))", color: "var(--color-background)", borderRadius: env.width === "full" ? 0 : "calc(var(--radius) * 1.5)", padding: "3.5rem 1.5rem" } : undefined}>
      <Container width={env.width} className="text-center">
        <div className="mx-auto max-w-3xl">
          {heading}
          {body}
          {buttons && <div className="mt-8">{buttons}</div>}
        </div>
      </Container>
    </div>
  );
}

defineBlock("cta", CtaBlock);
