/**
 * Side-effect module: importing "@/components/blocks" registers every block
 * renderer (each file calls defineBlock/registerBlock at module scope).
 * Keep this list in sync with BLOCK_SCHEMAS in src/lib/blocks/schema.ts.
 */
import "./hero";
import "./page_header";
import "./text";
import "./rich_content";
import "./image";
import "./video";
import "./gallery";
import "./before_after";
import "./stats";
import "./services";
import "./projects";
import "./reviews";
import "./faq";
import "./pricing";
import "./process";
import "./team";
import "./map";
import "./service_areas";
import "./contact";
import "./lead_form";
import "./quote_form";
import "./calculator";
import "./viewer_3d";
import "./cta";
import "./comparison";
import "./timeline";
import "./features";

export { registerBlock, getBlockComponent, FallbackBlock, type BlockRenderProps, type BlockComponent } from "./registry";
export { defineBlock, blockEnv, type TypedBlockProps, type BlockEnv } from "./define";
