"use client";

import * as React from "react";
import { EDITOR_SOURCE, isEditorMessage, type EditorToSiteMessage, type SiteToEditorMessage } from "@/lib/editor/protocol";

/**
 * Runs inside the site preview iframe when the live editor is open.
 * Implements the click-to-select / inline-text-edit side of the protocol.
 */
export function EditorBridge({ pageId }: { pageId: string | null }) {
  React.useEffect(() => {
    const post = (msg: SiteToEditorMessage) => window.parent?.postMessage(msg, "*");
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
  }, [pageId]);
  return null;
}
