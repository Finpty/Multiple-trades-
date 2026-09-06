import Link from "next/link";
import { siteHref } from "@/lib/tenant/resolve";
import { resolveMediaRef } from "@/lib/site/blocks/media";
import { Container } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/**
 * Page header: title band for inner pages. With an image it becomes a cover
 * band with a scrim; without one it inherits the section background.
 * Breadcrumbs are derived from the page slug (Home › parent › current).
 */
async function PageHeaderBlock({ props, ctx, page, settings, editor }: TypedBlockProps<"page_header">) {
  const env = blockEnv(ctx, settings, "normal");
  const image = await resolveMediaRef(ctx, props.image);
  const onDark = env.onDark || !!image;
  const slugParts = (page.page.slug ?? "").split("/").filter(Boolean);
  const crumbs = [{ label: "Home", href: siteHref(ctx, "/") }, ...slugParts.slice(0, -1).map((part, i) => ({ label: part.replace(/[-_]+/g, " "), href: siteHref(ctx, `/${slugParts.slice(0, i + 1).join("/")}`) }))];

  const inner = (
    <Container width={env.width} className={image ? "relative py-16 sm:py-24" : "py-2"}>
      {props.breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-4 text-xs font-medium uppercase tracking-[0.14em] opacity-75">
          <ol className="flex flex-wrap items-center gap-2">
            {crumbs.map((c) => (
              <li key={c.href} className="flex items-center gap-2">
                <Link href={c.href} className="hover:underline underline-offset-4 capitalize">{c.label}</Link>
                <span aria-hidden="true">›</span>
              </li>
            ))}
            <li aria-current="page" className="opacity-90">{page.snapshot.title || props.heading}</li>
          </ol>
        </nav>
      )}
      <h1 className="max-w-3xl text-balance text-4xl leading-[1.05] tracking-tight sm:text-5xl" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field="heading">
        {props.heading}
      </h1>
      {props.subheading && (
        <p className="mt-4 max-w-2xl text-lg leading-relaxed opacity-85" data-edit-field="subheading">
          {props.subheading}
        </p>
      )}
      {editor && !image && (
        <div className="mt-6 inline-flex items-center gap-2 border-2 border-dashed px-3 py-2 text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)", borderRadius: "var(--radius)" }} data-edit-image="image" role="button" tabIndex={0}>
          Add cover image
        </div>
      )}
    </Container>
  );

  if (!image) return <div className="site-page-header">{inner}</div>;
  return (
    <div className="site-page-header relative isolate overflow-hidden" style={{ marginTop: "calc(var(--section-spacing) * -0.7)", marginBottom: "calc(var(--section-spacing) * -0.7)", color: "#fff", background: "var(--color-primary)" }}>
      <div className="absolute inset-0 -z-10" data-edit-image="image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.large} alt={image.alt} className={`site-img site-img--${env.tokens.imageStyle} h-full w-full object-cover`} loading="eager" decoding="async" />
      </div>
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)" }} />
      <div className={onDark ? "site-on-dark" : ""}>{inner}</div>
    </div>
  );
}

defineBlock("page_header", PageHeaderBlock);
