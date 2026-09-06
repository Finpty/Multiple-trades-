import { icons } from "lucide-react";

type LucideName = keyof typeof icons;

/** "shield-check" | "shield_check" | "shieldCheck" | "ShieldCheck" → "ShieldCheck" */
function toPascal(name: string): string {
  return name
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

export function resolveLucideIcon(name: string | null | undefined): (typeof icons)[LucideName] | null {
  if (!name) return null;
  const key = toPascal(name) as LucideName;
  return icons[key] ?? null;
}

/**
 * Renders an owner-chosen icon: a lucide icon name (any case), an emoji or a
 * short text glyph. Falls back to `fallback` (e.g. a step number) when the
 * name is unknown. Works in Server Components.
 */
export function SiteIcon({ name, size = 22, className = "", fallback = null, strokeWidth = 1.75 }: { name?: string | null; size?: number; className?: string; fallback?: React.ReactNode; strokeWidth?: number }) {
  const Lucide = resolveLucideIcon(name);
  if (Lucide) return <Lucide size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
  const text = (name ?? "").trim();
  if (text && !/^[a-z0-9-_]+$/i.test(text) && text.length <= 3) {
    return (
      <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">
        {text}
      </span>
    );
  }
  return <>{fallback}</>;
}

/** Circular icon badge used by features, process and services. */
export function IconBadge({ name, fallback, size = "md", tone = "accent" }: { name?: string | null; fallback?: React.ReactNode; size?: "sm" | "md" | "lg"; tone?: "accent" | "primary" | "surface" }) {
  const dim = { sm: 36, md: 48, lg: 60 }[size];
  const icon = { sm: 18, md: 22, lg: 28 }[size];
  const background = tone === "accent" ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : tone === "primary" ? "var(--color-primary)" : "var(--color-surface)";
  const color = tone === "accent" ? "var(--color-accent)" : tone === "primary" ? "var(--color-background)" : "var(--color-primary)";
  return (
    <span className="inline-flex shrink-0 items-center justify-center font-semibold" style={{ width: dim, height: dim, borderRadius: "calc(var(--radius) + 4px)", background, color }}>
      <SiteIcon name={name} size={icon} fallback={fallback} />
    </span>
  );
}
