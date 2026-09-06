import { siteHref } from "@/lib/tenant/resolve";
import { resolveMediaRef } from "@/lib/site/blocks/media";
import { videoEmbedUrl } from "@/lib/site/blocks/common";
import { Container, SiteButton, SmartImage, SiteIcon } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/**
 * Hero: four layouts. Text is editable in place; the image is click-to-replace.
 *  centered   – text centred over optional image below
 *  split      – text left, media right
 *  full-bleed – media behind, text on a gradient scrim
 *  minimal    – heading + subheading only, no media
 */
async function HeroBlock({ props, ctx, settings, editor }: TypedBlockProps<"hero">) {
  const env = blockEnv(ctx, settings, "normal");
  const [image, video] = await Promise.all([resolveMediaRef(ctx, props.image), resolveMediaRef(ctx, props.video)]);
  const embed = !video && props.video?.url ? videoEmbedUrl(props.video.url) : null;
  const layout = props.layout ?? "split";
  const onDark = env.onDark || layout === "full-bleed";
  const hasMedia = !!image || !!video || !!embed || (editor && layout !== "minimal");

  const media =
    video && video.kind === "VIDEO" ? (
      <video className="h-full w-full object-cover" src={video.url} poster={image?.large} autoPlay muted loop playsInline style={{ borderRadius: layout === "full-bleed" ? 0 : "var(--radius)" }} data-edit-image="video" />
    ) : embed ? (
      <div className="relative h-full w-full overflow-hidden" style={{ aspectRatio: "16 / 9", borderRadius: "var(--radius)" }}>
        <iframe src={embed.src} title={props.heading} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    ) : (
      <SmartImage image={image} aspect={layout === "full-bleed" ? "auto" : "4/3"} imageStyle={env.tokens.imageStyle} editField="image" editor={editor} priority sizes={layout === "full-bleed" ? "100vw" : "(min-width: 1024px) 50vw, 100vw"} className={layout === "full-bleed" ? "h-full w-full" : "w-full"} rounded={layout !== "full-bleed"} imgClassName={layout === "full-bleed" ? "h-full w-full" : ""} placeholderLabel="Add hero image" />
    );

  const buttons = (props.primaryCta || props.secondaryCta) && (
    <div className={["mt-8 flex flex-wrap gap-3", layout === "centered" || layout === "minimal" ? "justify-center" : ""].join(" ")}>
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

  const highlights = props.highlights.length > 0 && (
    <ul className={["mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium", layout === "centered" || layout === "minimal" ? "justify-center" : ""].join(" ")}>
      {props.highlights.map((h, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: onDark ? "rgba(255,255,255,0.18)" : "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: onDark ? "inherit" : "var(--color-accent)" }}>
            <SiteIcon name="check" size={12} strokeWidth={3} />
          </span>
          <span data-edit-field={`highlights.${i}`}>{h}</span>
        </li>
      ))}
    </ul>
  );

  const text = (
    <div className={layout === "centered" || layout === "minimal" ? "mx-auto max-w-3xl text-center" : "max-w-xl"}>
      {props.eyebrow && (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: onDark ? "inherit" : "var(--color-accent)", opacity: onDark ? 0.85 : 1 }} data-edit-field="eyebrow">
          {props.eyebrow}
        </p>
      )}
      <h1 className={["text-balance leading-[1.05] tracking-tight", layout === "minimal" ? "text-3xl sm:text-4xl lg:text-5xl" : "text-4xl sm:text-5xl lg:text-6xl"].join(" ")} style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field="heading">
        {props.heading}
      </h1>
      {props.subheading && (
        <p className="mt-6 text-lg leading-relaxed opacity-85 sm:text-xl" data-edit-field="subheading">
          {props.subheading}
        </p>
      )}
      {buttons}
      {highlights}
    </div>
  );

  if (layout === "full-bleed") {
    return (
      <div className="site-hero site-hero--full relative isolate -my-[var(--section-spacing)] min-h-[70vh] overflow-hidden" style={{ marginTop: "calc(var(--section-spacing) * -0.7)", marginBottom: "calc(var(--section-spacing) * -0.7)", color: "#fff", background: "var(--color-primary)" }}>
        <div className="absolute inset-0 -z-10">{hasMedia && media}</div>
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.2) 100%)" }} />
        <Container width={env.width} className="flex min-h-[70vh] items-center py-24">
          <div className="site-rise">{text}</div>
        </Container>
      </div>
    );
  }

  if (layout === "minimal") {
    return (
      <Container width={env.width} className="site-hero site-hero--minimal py-6">
        <div className="site-rise">{text}</div>
      </Container>
    );
  }

  if (layout === "centered") {
    return (
      <Container width={env.width} className="site-hero site-hero--centered">
        <div className="site-rise">{text}</div>
        {hasMedia && <div className="mx-auto mt-12 max-w-5xl">{media}</div>}
      </Container>
    );
  }

  return (
    <Container width={env.width} className="site-hero site-hero--split">
      <div className={["grid items-center gap-10 lg:gap-16", hasMedia ? "lg:grid-cols-2" : ""].join(" ")}>
        <div className="site-rise">{text}</div>
        {hasMedia && <div className="relative">{media}</div>}
      </div>
    </Container>
  );
}

defineBlock("hero", HeroBlock);
