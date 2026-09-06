/**
 * Live editor ↔ site preview protocol.
 *
 * The admin live editor renders the tenant site inside an iframe with
 *   ?__preview=draft&__editor=1
 * The site wraps each section in an element with `data-section-id` and
 * `data-section-type`, marks editable text with `data-edit-field="<propPath>"`,
 * and includes a small client script (src/components/site/editor-bridge.tsx)
 * that speaks this protocol over window.postMessage. Both sides validate the
 * `source` field and ignore anything else.
 */
export const EDITOR_SOURCE = "tradeone-editor" as const;

export type EditorToSiteMessage =
  | { source: typeof EDITOR_SOURCE; type: "select"; sectionId: string | null }
  | { source: typeof EDITOR_SOURCE; type: "scrollTo"; sectionId: string }
  | { source: typeof EDITOR_SOURCE; type: "setDevice"; device: "desktop" | "tablet" | "mobile" }
  | { source: typeof EDITOR_SOURCE; type: "reload" };

export type SiteToEditorMessage =
  | { source: typeof EDITOR_SOURCE; type: "ready"; pageId: string | null }
  | { source: typeof EDITOR_SOURCE; type: "sectionClick"; sectionId: string; sectionType: string }
  | { source: typeof EDITOR_SOURCE; type: "textEdit"; sectionId: string; field: string; value: string }
  | { source: typeof EDITOR_SOURCE; type: "imageClick"; sectionId: string; field: string }
  | { source: typeof EDITOR_SOURCE; type: "sections"; sections: Array<{ id: string; type: string; top: number; height: number }> };

export function isEditorMessage(data: unknown): data is EditorToSiteMessage | SiteToEditorMessage {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === EDITOR_SOURCE;
}

/** Query params that switch a site request into preview / editor mode (editors only). */
export const PREVIEW_PARAM = "__preview";
export const EDITOR_PARAM = "__editor";
