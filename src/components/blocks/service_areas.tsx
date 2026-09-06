import Link from "next/link";
import { siteHref } from "@/lib/tenant/resolve";
import { groupServiceAreas, loadServiceAreasForBlock, type SiteServiceArea } from "@/lib/site/blocks/areas";
import { Container, SectionHeading, SiteIcon } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

function AreaLink({ ctx, area, className, style }: { ctx: TypedBlockProps<"service_areas">["ctx"]; area: SiteServiceArea; className: string; style?: React.CSSProperties }) {
  const label = area.type === "POSTCODE" && area.postcode ? `${area.name} ${area.postcode}` : area.name;
  if (!area.href) return <span className={className} style={style}>{label}</span>;
  return (
    <Link href={siteHref(ctx, area.href)} className={`${className} hover:underline underline-offset-4`} style={style}>
      {label}
    </Link>
  );
}

/**
 * Service areas: list / grid / tags. Areas with a generated page link to
 * /areas/<slug>. Long lists (>20) are grouped by parent area or state.
 */
async function ServiceAreasBlock({ props, ctx, settings, editor }: TypedBlockProps<"service_areas">) {
  const env = blockEnv(ctx, settings, "normal");
  const areas = await loadServiceAreasForBlock(ctx, { limit: props.limit ?? 60 });
  if (areas.length === 0 && !editor) return null;
  const layout = props.layout ?? "grid";
  const groups = areas.length > 20 ? groupServiceAreas(areas) : [{ label: "", areas }];
  const tagStyle: React.CSSProperties = { background: env.onDark ? "rgba(255,255,255,0.12)" : "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "999px" };

  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} className="mb-10" />
      {areas.length === 0 ? (
        <p className="text-sm opacity-60">No service areas enabled yet — add them under Service areas in the admin.</p>
      ) : (
        <div className={groups.length > 1 ? "grid gap-10 sm:grid-cols-2 lg:grid-cols-3" : ""}>
          {groups.map((group) => (
            <div key={group.label}>
              {group.label && (
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: env.onDark ? "inherit" : "var(--color-accent)" }}>
                  {group.label}
                </h3>
              )}
              {layout === "tags" ? (
                <ul className="flex flex-wrap gap-2">
                  {group.areas.map((a) => (
                    <li key={a.id}>
                      <AreaLink ctx={ctx} area={a} className="inline-block px-3.5 py-1.5 text-sm font-medium" style={tagStyle} />
                    </li>
                  ))}
                </ul>
              ) : layout === "list" ? (
                <ul className="columns-1 gap-8 sm:columns-2 lg:columns-3">
                  {group.areas.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <SiteIcon name="map-pin" size={14} className="shrink-0 opacity-60" />
                      <AreaLink ctx={ctx} area={a} className={a.isPrimary ? "font-semibold" : ""} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={`grid grid-cols-2 gap-3 ${groups.length > 1 ? "" : "sm:grid-cols-3 lg:grid-cols-4"}`}>
                  {group.areas.map((a) => (
                    <li key={a.id}>
                      <AreaLink ctx={ctx} area={a} className="flex items-center gap-2 px-4 py-3 text-sm font-medium" style={{ background: "var(--color-background)", color: "var(--color-text)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius)" }} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}

defineBlock("service_areas", ServiceAreasBlock);
