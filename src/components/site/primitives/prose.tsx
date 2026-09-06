/**
 * Renders already-sanitised HTML (see src/lib/site/blocks/sanitize.ts and
 * markdown.ts) with theme-aware typography from globals.css (.site-prose).
 */
export function Prose({ html, className = "", editField, size = "md" }: { html: string; className?: string; editField?: string; size?: "sm" | "md" | "lg" }) {
  return <div className={["site-prose", `site-prose--${size}`, className].filter(Boolean).join(" ")} data-edit-field={editField} dangerouslySetInnerHTML={{ __html: html }} />;
}
