import Link from "next/link";
import { siteHref } from "@/lib/tenant/resolve";
import { siteTerminology, termPlural } from "@/lib/site/context";
import { loadServicesForBlock, type SiteServiceCard } from "@/lib/site/blocks/services";
import { Container, Price, SectionHeading, SiteButton, SiteCard, SiteIcon } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

function flatten(cards: SiteServiceCard[], depth = 0): Array<SiteServiceCard & { depth: number }> {
  return cards.flatMap((c) => [{ ...c, depth }, ...flatten(c.children, depth + 1)]);
}

/**
 * Pricing. source = "services" renders a price table from the catalogue
 * (price range + method, formatted in the business currency); manual tiers
 * render as comparison cards with an optional highlighted tier.
 */
async function PricingBlock({ props, ctx, settings, editor }: TypedBlockProps<"pricing">) {
  const env = blockEnv(ctx, settings, "normal");
  const terms = siteTerminology(ctx);
  const source = props.source ?? "services";

  if (source === "services") {
    const rows = flatten(await loadServicesForBlock(ctx, { source: "all", limit: 100 }));
    if (rows.length === 0 && !editor) return null;
    return (
      <Container width={env.width}>
        <SectionHeading heading={props.heading} intro={props.intro} className="mb-10" />
        {rows.length === 0 ? (
          <p className="text-sm opacity-60">No published {termPlural(terms, "service").toLowerCase()} to price yet.</p>
        ) : (
          <div className="overflow-x-auto" style={{ border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-background)", color: "var(--color-text)" }}>
            <table className="w-full min-w-[30rem] border-collapse text-left text-sm sm:text-base">
              <thead>
                <tr style={{ background: "var(--color-surface)" }}>
                  <th className="px-5 py-4 font-semibold" scope="col">{terms.service}</th>
                  <th className="px-5 py-4 font-semibold" scope="col">Pricing</th>
                  <th className="px-5 py-4 text-right font-semibold" scope="col">Guide price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} style={{ borderTop: "var(--border-width) solid var(--color-border)" }}>
                    <td className="px-5 py-4" style={{ paddingLeft: `${1.25 + s.depth * 1.25}rem` }}>
                      <Link href={siteHref(ctx, s.href)} className="font-medium hover:underline underline-offset-4">{s.name}</Link>
                      {s.shortDescription && s.depth === 0 && <p className="mt-0.5 text-xs opacity-65">{s.shortDescription}</p>}
                    </td>
                    <td className="px-5 py-4 opacity-80">{s.pricingMethodLabel}</td>
                    <td className="px-5 py-4 text-right">
                      <Price label={s.priceLabel} size="sm" align="right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs opacity-60">Guide prices only. Every job is quoted individually.</p>
      </Container>
    );
  }

  const tiers = props.tiers ?? [];
  if (tiers.length === 0 && !editor) return null;
  const cols = tiers.length === 1 ? "max-w-md mx-auto" : tiers.length === 2 ? "sm:grid-cols-2 max-w-4xl mx-auto" : tiers.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} align="center" className="mb-12" />
      {tiers.length === 0 ? (
        <p className="text-center text-sm opacity-60">Add pricing tiers from the section panel.</p>
      ) : (
        <ul className={`grid grid-cols-1 gap-6 ${cols}`}>
          {tiers.map((tier, i) => (
            <li key={i}>
              <SiteCard className="relative h-full" highlighted={tier.highlighted}>
                {tier.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ background: "var(--color-accent)", color: "#fff" }}>
                    Most popular
                  </span>
                )}
                <h3 className="text-lg" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field={`tiers.${i}.name`}>
                  {tier.name}
                </h3>
                <p className="mt-3 text-3xl tabular-nums tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"], color: "var(--color-primary)" }} data-edit-field={`tiers.${i}.price`}>
                  {tier.price}
                </p>
                {(tier.description || editor) && (
                  <p className="mt-2 text-sm opacity-75" data-edit-field={`tiers.${i}.description`}>
                    {tier.description || (editor ? "Add a description" : "")}
                  </p>
                )}
                {tier.features.length > 0 && (
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {tier.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: "var(--color-accent)" }}>
                          <SiteIcon name="check" size={12} strokeWidth={3} />
                        </span>
                        <span data-edit-field={`tiers.${i}.features.${j}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {tier.cta && (
                  <div className="mt-8">
                    <SiteButton href={siteHref(ctx, tier.cta.href)} variant={tier.highlighted ? "primary" : tier.cta.style === "link" ? "link" : tier.cta.style === "secondary" ? "secondary" : "primary"} buttonStyle={env.tokens.buttonStyle} className="w-full justify-center" editField={`tiers.${i}.cta.label`}>
                      {tier.cta.label}
                    </SiteButton>
                  </div>
                )}
              </SiteCard>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

defineBlock("pricing", PricingBlock);
