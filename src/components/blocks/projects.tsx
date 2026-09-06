import Link from "next/link";
import { siteHref } from "@/lib/tenant/resolve";
import { siteTerminology, termPlural } from "@/lib/site/context";
import { loadProjectsForBlock, type SiteProjectCard } from "@/lib/site/blocks/projects";
import { Container, SectionHeading, SiteCard, SiteIcon, SmartImage } from "@/components/site/primitives";
import { blockEnv, defineBlock, type BlockEnv, type TypedBlockProps } from "./define";

function ProjectCardView({ ctx, project, env, aspect }: { ctx: TypedBlockProps<"projects">["ctx"]; project: SiteProjectCard; env: BlockEnv; aspect: "4/3" | "auto" }) {
  const href = siteHref(ctx, project.href);
  return (
    <SiteCard padded={false} interactive className="h-full">
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <SmartImage image={project.image} aspect={aspect} imageStyle={env.tokens.imageStyle} rounded={false} sizes="(min-width: 1024px) 33vw, 100vw" fallback={<div className="flex items-center justify-center" style={{ aspectRatio: "4 / 3", background: "var(--color-surface)", color: "var(--color-muted)" }}><SiteIcon name="image" size={36} strokeWidth={1.3} /></div>} />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {project.serviceNames.length > 0 && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--color-accent)" }}>
            {project.serviceNames.slice(0, 2).join(" · ")}
          </p>
        )}
        <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }}>
          <Link href={href} className="hover:underline underline-offset-4">{project.title}</Link>
        </h3>
        {project.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed opacity-80">{project.summary}</p>}
        {(project.locationText || project.completionLabel) && (
          <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs opacity-70">
            {project.locationText && (
              <span className="inline-flex items-center gap-1">
                <SiteIcon name="map-pin" size={13} />
                {project.locationText}
              </span>
            )}
            {project.completionLabel && (
              <span className="inline-flex items-center gap-1">
                <SiteIcon name="calendar" size={13} />
                {project.completionLabel}
              </span>
            )}
          </p>
        )}
      </div>
    </SiteCard>
  );
}

/** Portfolio: grid, masonry (CSS columns) or carousel (scroll-snap, no JS). */
async function ProjectsBlock({ props, ctx, settings, editor }: TypedBlockProps<"projects">) {
  const env = blockEnv(ctx, settings, "normal");
  const terms = siteTerminology(ctx);
  const projects = await loadProjectsForBlock(ctx, { source: props.source ?? "featured", projectIds: props.projectIds, serviceId: props.serviceId, limit: props.limit ?? 6 });
  if (projects.length === 0 && !editor) return null;
  const layout = props.layout ?? "grid";
  return (
    <Container width={env.width}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <SectionHeading heading={props.heading} intro={props.intro} />
        {projects.length > 0 && (
          <Link href={siteHref(ctx, "/projects")} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: env.onDark ? "inherit" : "var(--color-accent)" }}>
            All {termPlural(terms, "project").toLowerCase()}
            <SiteIcon name="arrow-right" size={16} />
          </Link>
        )}
      </div>
      {projects.length === 0 ? (
        <p className="text-sm opacity-60">No published {termPlural(terms, "project").toLowerCase()} match this block yet.</p>
      ) : layout === "carousel" ? (
        <ul className="site-carousel -mx-5 px-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {projects.map((p) => (
            <li key={p.id} className="w-[82vw] max-w-sm sm:w-[46vw] lg:w-[31%]">
              <ProjectCardView ctx={ctx} project={p} env={env} aspect="4/3" />
            </li>
          ))}
        </ul>
      ) : layout === "masonry" ? (
        <ul className="site-masonry columns-1 sm:columns-2 lg:columns-3">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCardView ctx={ctx} project={p} env={env} aspect="auto" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`grid grid-cols-1 gap-6 ${projects.length === 2 ? "sm:grid-cols-2" : projects.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCardView ctx={ctx} project={p} env={env} aspect="4/3" />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

defineBlock("projects", ProjectsBlock);
