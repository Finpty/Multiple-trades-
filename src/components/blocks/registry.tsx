import type { BlockType } from "@/lib/blocks/schema";
import type { SiteContext } from "@/lib/tenant/resolve";
import type { RenderablePage } from "@/lib/site/pages";

/**
 * Block renderer registry. Each block receives its validated props and the
 * site context; data blocks load tenant rows themselves via ctx.business.id.
 * Renderers are async server components. Missing renderers fall back to
 * <FallbackBlock> so an unknown block never breaks a page.
 */
export interface BlockRenderProps<P = Record<string, unknown>> {
  id: string;
  type: string;
  props: P;
  settings: Record<string, unknown>;
  ctx: SiteContext;
  page: RenderablePage;
  editor: boolean;
}

export type BlockComponent = (props: BlockRenderProps) => Promise<React.ReactNode> | React.ReactNode;

const registry: Partial<Record<BlockType, BlockComponent>> = {};

export function registerBlock(type: BlockType, component: BlockComponent) {
  registry[type] = component;
}

export function getBlockComponent(type: string): BlockComponent | null {
  return registry[type as BlockType] ?? null;
}

export function FallbackBlock({ type, props }: BlockRenderProps) {
  const heading = typeof props.heading === "string" ? props.heading : typeof props.title === "string" ? props.title : null;
  const body = typeof props.body === "string" ? props.body : typeof props.subheading === "string" ? props.subheading : null;
  return (
    <div className="mx-auto max-w-5xl px-6">
      {heading && <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }} data-edit-field={typeof props.heading === "string" ? "heading" : "title"}>{heading}</h2>}
      {body && <p className="mt-2 opacity-80" data-edit-field={typeof props.body === "string" ? "body" : "subheading"}>{body}</p>}
      {!heading && !body && <p className="text-sm opacity-60">[{type}]</p>}
    </div>
  );
}
