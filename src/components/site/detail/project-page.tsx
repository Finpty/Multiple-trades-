import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, MapPin, Ruler } from "lucide-react";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import { siteAbsoluteUrl, siteTerminology, termPlural } from "@/lib/site/context";
import { customFieldEntries, plainText, PROJECT_STAGE_LABELS, type ProjectDetail } from "@/lib/site/detail";
import { BeforeAfterSlider } from "./before-after-slider";
import { JsonLd } from "./json-ld";
import { Markdown } from "./markdown";
import { MediaGrid, SiteVideo } from "./media-grid";
import { Chip, CtaBanner, DlRow, formatDate, PageHero, ProjectCards, SectionTitle } from "./shared";

/** Full project detail page: galleries by stage, before/after slider, materials, story, related work. */
export function ProjectPage({ ctx, detail }: { ctx: SiteContext; detail: ProjectDetail }) {
  const { project, area, services, byStage, featured, video, materials, related, relatedMedia, prev, next, pair } = detail;
  const terms = siteTerminology(ctx);
  const projectsLabel = termPlural(terms, "project");
  const quoteLabel = terms.quote;
  const when = formatDate(project.completionDate, ctx.business.locale);
  const areaHref = area && area.isEnabled && area.generatePage ? siteHref(ctx, `/areas/${area.slug}`) : null;
  const custom = customFieldEntries(project.customFields);
  const quoteHref = siteHref(ctx, services[0] ? `/quote?service=${encodeURIComponent(services[0].slug)}` : "/quote");
  const crumbs = [{ label: projectsLabel, path: "/projects" }, { label: project.title, path: `/projects/${project.slug}` }];
  const stages = (["BEFORE", "PROGRESS", "AFTER", "OTHER"] as const).map((stage) => ({ stage, items: byStage[stage] })).filter((s) => s.items.length > 0);
  const extraVideos = byStage.VIDEO.filter((v) => v.media.id !== video?.id);
  const url = siteAbsoluteUrl(ctx, `/projects/${project.slug}`);
  const images = [featured, ...byStage.BEFORE.map((m) => m.media), ...byStage.AFTER.map((m) => m.media), ...byStage.PROGRESS.map((m) => m.media)].filter((m): m is NonNullable<typeof m> => !!m && m.kind === "IMAGE");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    headline: project.title,
    description: project.summary ?? plainText(project.description, 300) ?? undefined,
    url,
    dateCompleted: project.completionDate ? project.completionDate.toISOString().slice(0, 10) : undefined,
    locationCreated: project.locationText || area ? { "@type": "Place", name: project.locationText ?? area?.name } : undefined,
    author: { "@id": `${siteAbsoluteUrl(ctx, "/")}#business` },
    about: services.length ? services.map((s) => ({ "@type": "Service", name: s.name, url: siteAbsoluteUrl(ctx, `/services/${s.slug}`) })) : undefined,
    image: images.slice(0, 12).map((m) => ({ "@type": "ImageObject", contentUrl: m.large, url: m.large, caption: m.alt || undefined, width: m.width ?? undefined, height: m.height ?? undefined })),
    material: materials.length ? materials.map((m) => m.name || m.type).filter(Boolean) : undefined,
  };

  return (
    <article data-edit-entity="project" data-edit-id={project.id}>
      <JsonLd data={jsonLd} />
      <PageHero
        ctx={ctx}
        crumbs={crumbs}
        eyebrow={terms.project}
        title={project.title}
        intro={project.summary}
        image={featured}
        aside={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {(project.locationText || area) && (
              <span className="inline-flex items-center gap-1.5 opacity-85">
                <MapPin className="h-4 w-4" aria-hidden />
                {project.locationText ?? area?.name}
                {areaHref && area && <Link href={areaHref} className="underline underline-offset-2 hover:opacity-70">{project.locationText ? `(${area.name})` : ""}</Link>}
              </span>
            )}
            {when && <span className="inline-flex items-center gap-1.5 opacity-85"><Calendar className="h-4 w-4" aria-hidden />Completed {when}</span>}
            {project.projectSize && <span className="inline-flex items-center gap-1.5 opacity-85"><Ruler className="h-4 w-4" aria-hidden />{project.projectSize}</span>}
            {services.length > 0 && (
              <span className="flex flex-wrap gap-2">
                {services.map((s) => <Chip key={s.id} href={siteHref(ctx, `/services/${s.slug}`)}>{s.name}</Chip>)}
              </span>
            )}
            {project.status !== "PUBLISHED" && <span className="rounded-full border border-dashed px-2 py-0.5 text-xs uppercase tracking-wider opacity-70">Draft preview</span>}
          </div>
        }
      />

      <div className="site-container grid gap-12 py-12 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-12">
          {pair && (
            <section>
              <SectionTitle sub="Drag the handle to compare">Before and after</SectionTitle>
              <BeforeAfterSlider before={pair.before.large} after={pair.after.large} alt={project.title} />
            </section>
          )}

          {project.description && (
            <section>
              <Markdown source={project.description} />
            </section>
          )}

          {stages.map(({ stage, items }) => (
            <section key={stage}>
              <SectionTitle>{PROJECT_STAGE_LABELS[stage]}</SectionTitle>
              <MediaGrid items={items.map((i) => ({ media: i.media, caption: i.caption }))} />
            </section>
          ))}

          {(video || extraVideos.length > 0) && (
            <section className="space-y-4">
              <SectionTitle>Video</SectionTitle>
              {video && <SiteVideo media={video} poster={featured} />}
              {extraVideos.map((v) => <SiteVideo key={v.id} media={v.media} />)}
            </section>
          )}

          {(project.challenges || project.solutions) && (
            <section className="grid gap-6 md:grid-cols-2">
              {project.challenges && (
                <div className="rounded-[var(--radius)] border p-6" style={{ borderColor: "var(--color-border)" }}>
                  <h2 className="text-xl font-semibold">The challenge</h2>
                  <Markdown source={project.challenges} className="mt-3 text-sm" />
                </div>
              )}
              {project.solutions && (
                <div className="rounded-[var(--radius)] border p-6" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                  <h2 className="text-xl font-semibold">Our solution</h2>
                  <Markdown source={project.solutions} className="mt-3 text-sm" />
                </div>
              )}
            </section>
          )}

          {project.testimonial && (
            <blockquote className="rounded-[var(--radius)] border-l-4 p-6 text-lg italic" style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }}>
              “{project.testimonial}”
              {project.testimonialAuthor && <footer className="mt-3 text-sm not-italic opacity-75">— {project.testimonialAuthor}</footer>}
            </blockquote>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius)] border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-60">{terms.project} details</div>
            <dl className="mt-2">
              {project.locationText && <DlRow label="Location">{areaHref && area ? <Link href={areaHref} className="underline underline-offset-2">{project.locationText}</Link> : project.locationText}</DlRow>}
              {!project.locationText && area && <DlRow label="Area">{areaHref ? <Link href={areaHref} className="underline underline-offset-2">{area.name}</Link> : area.name}</DlRow>}
              {when && <DlRow label="Completed">{when}</DlRow>}
              {project.projectSize && <DlRow label="Size">{project.projectSize}</DlRow>}
              {custom.map((c) => <DlRow key={c.key} label={c.key}>{c.value}</DlRow>)}
            </dl>
            <Link href={quoteHref} data-track="cta_click" className="mt-4 block rounded-[var(--radius)] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90" style={{ background: "var(--color-accent)" }}>
              Get a similar {quoteLabel.toLowerCase()}
            </Link>
          </div>

          {materials.length > 0 && (
            <div className="overflow-hidden rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)" }}>
              <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider opacity-60" style={{ background: "var(--color-surface)" }}>Materials used</div>
              <table className="w-full text-sm">
                <tbody>
                  {materials.map((m, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                      <td className="px-4 py-2 font-medium">{m.name || m.type}</td>
                      <td className="px-4 py-2 text-right text-xs opacity-70">{m.name && m.type ? m.type : m.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="site-container pb-12">
          <SectionTitle>More {projectsLabel.toLowerCase()} like this</SectionTitle>
          <ProjectCards ctx={ctx} projects={related} media={relatedMedia} />
        </section>
      )}

      <nav className="site-container flex flex-wrap items-center justify-between gap-4 border-t py-6 text-sm" style={{ borderColor: "var(--color-border)" }} aria-label={`${projectsLabel} navigation`}>
        {prev ? (
          <Link href={siteHref(ctx, `/projects/${prev.slug}`)} rel="prev" className="inline-flex items-center gap-2 hover:opacity-70"><ArrowLeft className="h-4 w-4" aria-hidden />{prev.title}</Link>
        ) : <span />}
        <Link href={siteHref(ctx, "/projects")} className="font-medium hover:opacity-70">All {projectsLabel.toLowerCase()}</Link>
        {next ? (
          <Link href={siteHref(ctx, `/projects/${next.slug}`)} rel="next" className="inline-flex items-center gap-2 hover:opacity-70">{next.title}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        ) : <span />}
      </nav>

      <CtaBanner ctx={ctx} title={`Planning something similar?`} text={`Tell us about your ${terms.project.toLowerCase()} and ${ctx.business.name} will put together a ${quoteLabel.toLowerCase()}.`} primary={{ label: `Request a ${quoteLabel.toLowerCase()}`, href: quoteHref }} />
    </article>
  );
}
