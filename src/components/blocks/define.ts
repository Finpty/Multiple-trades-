import type { BlockProps, BlockType } from "@/lib/blocks/schema";
import { registerBlock, type BlockComponent, type BlockRenderProps } from "./registry";
import { sectionWidth, type SectionWidth } from "@/lib/site/blocks/common";
import { siteTokens } from "@/lib/site/blocks/theme";
import type { ThemeTokens } from "@/lib/theme/tokens";
import type { SiteContext } from "@/lib/tenant/resolve";

export type TypedBlockProps<T extends BlockType> = BlockRenderProps<BlockProps<T>>;

/** Typed registration helper: props are the zod-inferred shape for the block type. */
export function defineBlock<T extends BlockType>(type: T, component: (args: TypedBlockProps<T>) => Promise<React.ReactNode> | React.ReactNode): void {
  registerBlock(type, component as unknown as BlockComponent);
}

/** Per-render presentation context shared by every block. */
export interface BlockEnv {
  tokens: ThemeTokens;
  width: SectionWidth;
  /** True when the section wrapper painted a primary/dark background. */
  onDark: boolean;
  background: string;
}

export function blockEnv(ctx: SiteContext, settings: Record<string, unknown> | undefined, defaultWidth: SectionWidth = "normal"): BlockEnv {
  const background = typeof settings?.background === "string" ? settings.background : "default";
  return { tokens: siteTokens(ctx), width: sectionWidth(settings, defaultWidth), onDark: background === "primary" || background === "dark", background };
}
