/** Price label with method hint, e.g. "From $85.00 / m²" + "Per square metre". */
export function Price({ label, method, size = "md", className = "", align = "left" }: { label: string | null; method?: string | null; size?: "sm" | "md" | "lg"; className?: string; align?: "left" | "right" }) {
  if (!label && !method) return null;
  const amount = { sm: "text-sm", md: "text-base", lg: "text-2xl" }[size];
  return (
    <div className={["site-price flex flex-col", align === "right" ? "items-end text-right" : "", className].join(" ")}>
      {label ? (
        <span className={`${amount} font-semibold tabular-nums`} style={{ fontFamily: "var(--font-heading)" }}>
          {label}
        </span>
      ) : (
        <span className={`${amount} font-medium opacity-80`}>Quote on request</span>
      )}
      {method && label && <span className="text-xs uppercase tracking-wide opacity-60">{method}</span>}
    </div>
  );
}
