/**
 * Eyebrow / heading / intro trio used at the top of most blocks. Every text
 * carries a data-edit-field marker so the live editor can edit it in place.
 * Optional texts render only when present (the editor adds them from the
 * section panel), so an accidental blur never saves placeholder copy.
 */
export function SectionHeading({
  eyebrow,
  heading,
  intro,
  align = "left",
  as: Tag = "h2",
  size = "md",
  fields = { eyebrow: "eyebrow", heading: "heading", intro: "intro" },
  className = "",
}: {
  eyebrow?: string | null;
  heading?: string | null;
  intro?: string | null;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg" | "xl";
  fields?: { eyebrow?: string; heading?: string; intro?: string };
  className?: string;
}) {
  if (!eyebrow && !heading && !intro) return null;
  const sizes = { sm: "text-xl sm:text-2xl", md: "text-2xl sm:text-3xl lg:text-[2.5rem]", lg: "text-3xl sm:text-4xl lg:text-5xl", xl: "text-4xl sm:text-5xl lg:text-6xl" }[size];
  return (
    <div className={["site-heading-group", align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className].filter(Boolean).join(" ")}>
      {eyebrow && fields.eyebrow && (
        <p className="site-eyebrow mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-accent)" }} data-edit-field={fields.eyebrow}>
          {eyebrow}
        </p>
      )}
      {heading && fields.heading && (
        <Tag className={`${sizes} leading-[1.1] tracking-tight text-balance`} style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field={fields.heading}>
          {heading}
        </Tag>
      )}
      {intro && fields.intro && (
        <p className="mt-4 text-base leading-relaxed opacity-80 sm:text-lg" data-edit-field={fields.intro}>
          {intro}
        </p>
      )}
    </div>
  );
}
