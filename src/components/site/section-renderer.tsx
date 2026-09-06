import { FallbackBlock, getBlockComponent } from "@/components/blocks/registry";
import { validateBlockProps, SectionSettingsSchema } from "@/lib/blocks/schema";
import type { SiteContext } from "@/lib/tenant/resolve";
import type { RenderablePage } from "@/lib/site/pages";
import "@/components/blocks";

const PADDING: Record<string, string> = { none: "0", sm: "calc(var(--section-spacing) * 0.4)", md: "calc(var(--section-spacing) * 0.7)", lg: "var(--section-spacing)" };

function backgroundStyle(bg: string): React.CSSProperties {
  switch (bg) {
    case "surface":
      return { background: "var(--color-surface)" };
    case "primary":
      return { background: "var(--color-primary)", color: "var(--color-background)" };
    case "dark":
      return { background: "#0a0a0a", color: "#fafafa" };
    default:
      return {};
  }
}

/** Renders every section of a page through the block registry. */
export async function SectionRenderer({ page, ctx, editor }: { page: RenderablePage; ctx: SiteContext; editor: boolean }) {
  const sections = page.snapshot.sections.filter((s) => editor || !s.isHidden);
  return (
    <>
      {await Promise.all(
        sections.map(async (section) => {
          const settings = SectionSettingsSchema.parse(section.settings ?? {});
          const validated = validateBlockProps(section.type, section.props);
          const props = validated.ok ? validated.props : (section.props as Record<string, unknown>);
          const Component = getBlockComponent(section.type) ?? FallbackBlock;
          const content = await Component({ id: section.id, type: section.type, props, settings: section.settings, ctx, page, editor });
          return (
            <section
              key={section.id}
              id={settings.anchor || undefined}
              data-section-id={section.id}
              data-section-type={section.type}
              data-hidden={section.isHidden ? "true" : undefined}
              className={[settings.hideOnMobile ? "hidden md:block" : "", settings.cssClass ?? "", section.isHidden && editor ? "opacity-40" : ""].join(" ")}
              style={{ paddingTop: PADDING[settings.paddingTop], paddingBottom: PADDING[settings.paddingBottom], ...backgroundStyle(settings.background) }}
            >
              {content}
            </section>
          );
        }),
      )}
    </>
  );
}
