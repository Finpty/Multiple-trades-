"use client";

import * as React from "react";
import { EDITOR_SOURCE, isEditorMessage, type EditorMode, type EditorToSiteMessage, type SiteToEditorMessage, type ThemePreviewPayload } from "@/lib/editor/protocol";

/** Applies a draft theme pushed by the brand & theme builder without a reload. */
function applyThemePreview(theme: ThemePreviewPayload) {
  const root = document.querySelector<HTMLElement>(".site-root");
  if (!root) return;
  root.style.cssText = theme.cssVars;
  root.dataset.mode = theme.mode;
  root.dataset.animation = theme.animation;
  const vars = document.getElementById("to-theme-vars");
  if (vars) vars.textContent = `.site-root{${theme.cssVars};background:var(--color-background);color:var(--color-text);font-family:var(--font-body)}`;
  const custom = document.getElementById("to-theme-custom");
  if (custom) custom.textContent = theme.customCss;
  let fonts = document.getElementById("to-theme-fonts") as HTMLLinkElement | null;
  if (theme.fontsUrl) {
    if (!fonts) {
      fonts = document.createElement("link");
      fonts.id = "to-theme-fonts";
      fonts.rel = "stylesheet";
      document.head.appendChild(fonts);
    }
    if (fonts.href !== theme.fontsUrl) fonts.href = theme.fontsUrl;
  } else if (fonts) fonts.remove();
}

/**
 * Runs inside the site preview iframe when the live editor is open.
 * Implements the click-to-select / inline-text-edit side of the protocol.
 * In "theme" mode it only listens for draft theme updates (no outlines).
 */
export function EditorBridge({ pageId, mode = "edit" }: { pageId: string | null; mode?: EditorMode }) {
  React.useEffect(() => {
    const post = (msg: SiteToEditorMessage) => window.parent?.postMessage(msg, "*");
    if (mode === "theme") {
      const onThemeMessage = (e: MessageEvent) => {
        if (!isEditorMessage(e.data)) return;
        const msg = e.data as EditorToSiteMessage;
        if (msg.type === "setTheme") applyThemePreview(msg.theme);
        if (msg.type === "reload") window.location.reload();
      };
      const style = document.createElement("style");
      style.textContent = "a[href]{pointer-events:none}";
      document.head.appendChild(style);
      window.addEventListener("message", onThemeMessage);
      post({ source: EDITOR_SOURCE, type: "ready", pageId });
      return () => { window.removeEventListener("message", onThemeMessage); style.remove(); };
    }
    const sections = () => Array.from(document.querySelectorAll<HTMLElement>("[data-section-id]"));
    const reportSections = () => post({ source: EDITOR_SOURCE, type: "sections", sections: sections().map((el) => ({ id: el.dataset.sectionId!, type: el.dataset.sectionType ?? "", top: el.getBoundingClientRect().top + window.scrollY, height: el.offsetHeight })) });

    const style = document.createElement("style");
    style.textContent = `
      [data-section-id]{position:relative;outline:2px dashed transparent;outline-offset:-2px;transition:outline-color .15s}
      [data-section-id]:hover{outline-color:rgba(37,99,235,.5)}
      [data-section-id][data-editor-selected="true"]{outline:2px solid #2563eb}
      [data-section-id]::before{content:attr(data-section-type);position:absolute;top:0;left:0;z-index:20;background:#2563eb;color:#fff;font:600 11px system-ui;padding:2px 6px;border-radius:0 0 4px 0;opacity:0;pointer-events:none;transition:opacity .15s}
      [data-section-id]:hover::before,[data-section-id][data-editor-selected="true"]::before{opacity:1}
      [data-edit-field]{cursor:text}
      [data-edit-field]:focus{outline:1px dashed #2563eb;outline-offset:2px}
      a[href]{pointer-events:none}
    `;
    document.head.appendChild(style);

    const select = (id: string | null) => {
      sections().forEach((el) => (el.dataset.editorSelected = el.dataset.sectionId === id ? "true" : "false"));
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const section = target.closest<HTMLElement>("[data-section-id]");
      if (!section) return;
      const editable = target.closest<HTMLElement>("[data-edit-field]");
      const imageField = target.closest<HTMLElement>("[data-edit-image]");
      if (imageField) {
        e.preventDefault();
        post({ source: EDITOR_SOURCE, type: "imageClick", sectionId: section.dataset.sectionId!, field: imageField.dataset.editImage! });
        return;
      }
      if (editable) {
        editable.contentEditable = "true";
        editable.focus();
      } else {
        e.preventDefault();
      }
      select(section.dataset.sectionId!);
      post({ source: EDITOR_SOURCE, type: "sectionClick", sectionId: section.dataset.sectionId!, sectionType: section.dataset.sectionType ?? "" });
    };

    const onBlur = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!el?.dataset?.editField) return;
      el.contentEditable = "false";
      const section = el.closest<HTMLElement>("[data-section-id]");
      if (!section) return;
      post({ source: EDITOR_SOURCE, type: "textEdit", sectionId: section.dataset.sectionId!, field: el.dataset.editField!, value: el.innerText });
    };

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.dataset?.editField && e.key === "Enter" && !e.shiftKey && el.tagName !== "P" && el.tagName !== "DIV") {
        e.preventDefault();
        el.blur();
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (!isEditorMessage(e.data)) return;
      const msg = e.data as EditorToSiteMessage;
      if (msg.type === "select") select(msg.sectionId);
      if (msg.type === "scrollTo") document.querySelector<HTMLElement>(`[data-section-id="${msg.sectionId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (msg.type === "reload") window.location.reload();
      if (msg.type === "setTheme") applyThemePreview(msg.theme);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("message", onMessage);
    window.addEventListener("resize", reportSections);
    post({ source: EDITOR_SOURCE, type: "ready", pageId });
    reportSections();
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("resize", reportSections);
      style.remove();
    };
  }, [pageId, mode]);
  return null;
}
