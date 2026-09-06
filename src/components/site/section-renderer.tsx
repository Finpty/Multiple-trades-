import { FallbackBlock, getBlockComponent } from "@/components/blocks/registry";
import { validateBlockProps, SectionSettingsSchema } from "@/lib/blocks/schema";
import type { SiteContext } from "@/lib/tenant/resolve";
import type { RenderablePage } from "@/lib/site/pages";
import { siteMedia, siteTokens } from "@/lib/site/context";
import "@/components/blocks";

const PADDING: Record<string, string> = { none: "0", sm: "calc(var(--section-spacing) * 0.4)", md: "calc(var(--section-spacing) * 0.7)", lg: "var(--section-spacing)" };
const WIDTH: Record<string, string> = { narrow: "site-container site-container-narrow", normal: "site-container", wide: "site-container site-container-wide", full: "" };

function backgroundStyle(bg: string): React.CSSProperties {
  switch (bg) {
    case "surface":
      return { background: "var(--color-surface)" };
    case "primary":
      return { background: "var(--color-primary)", color: "var(--color-background)" };
    case "dark":
      return { background: "#0a0a0a", color: "#fafafa" };
    case "image":
      return { color: "#fff" };
    default:
      return {};
  }
}

async function backgroundImageUrl(ctx: SiteContext, ref: { mediaId?: string | null; url?: string | null } | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.mediaId) {
    const media = await siteMedia(ctx, ref.mediaId);
    if (media) return media.large;
  }
  if (ref.url && /^(https?:\/\/|\/)/i.test(ref.url)) return ref.url;
  return null;
}

/**
 * Renders every section of a page through the block registry. Section
 * settings control background (colour or cover image), spacing, container
 * width and the CSS-only reveal animation (theme tokens.animation).
 */
export async function SectionRenderer({ page, ctx, editor }: { page: RenderablePage; ctx: SiteContext; editor: boolean }) {
  const sections = page.snapshot.sections.filter((s) => editor || !s.isHidden);
  const reveal = siteTokens(ctx).animation !== "none" && !editor;
  return (
    <>
      {await Promise.all(
        sections.map(async (section) => {
          const parsedSettings = SectionSettingsSchema.safeParse(section.settings ?? {});
          const settings = parsedSettings.success ? parsedSettings.data : SectionSettingsSchema.parse({});
          const validated = validateBlockProps(section.type, section.props);
          const props = validated.ok ? validated.props : (section.props as Record<string, unknown>);
          const Component = getBlockComponent(section.type) ?? FallbackBlock;
          const content = await Component({ id: section.id, type: section.type, props, settings: section.settings, ctx, page, editor });
          const image = settings.background === "image" ? await backgroundImageUrl(ctx, settings.backgroundImage) : null;
          const style: React.CSSProperties = { paddingTop: PADDING[settings.paddingTop], paddingBottom: PADDING[settings.paddingBottom], ...backgroundStyle(settings.background) };
          if (image) {
            style.backgroundImage = `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${image.replace(/"/g, "%22")}")`;
            style.backgroundSize = "cover";
            style.backgroundPosition = "center";
          }
          const wrapperClass = WIDTH[settings.width] ?? WIDTH.normal;
          return (
            <section
              key={section.id}
              id={settings.anchor || undefined}
              data-section-id={section.id}
              data-section-type={section.type}
              data-hidden={section.isHidden ? "true" : undefined}
              data-background={settings.background}
              className={[settings.hideOnMobile ? "hidden md:block" : "", settings.cssClass ?? "", section.isHidden && editor ? "opacity-40" : "", reveal ? "site-reveal" : ""].filter(Boolean).join(" ")}
              style={style}
            >
              {wrapperClass ? <div className={wrapperClass}>{content}</div> : content}
            </section>
          );
        }),
      )}
    </>
  );
}
