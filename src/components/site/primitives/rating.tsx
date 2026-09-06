/** Five-star rating using the theme accent colour. Supports half stars. */
export function Rating({ value, max = 5, size = 16, label, className = "" }: { value: number; max?: number; size?: number; label?: string; className?: string }) {
  const stars = Array.from({ length: max }, (_, i) => {
    const fill = Math.max(0, Math.min(1, value - i));
    return fill;
  });
  return (
    <span className={["inline-flex items-center gap-0.5", className].join(" ")} role="img" aria-label={label ?? `${value} out of ${max} stars`}>
      {stars.map((fill, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
          <defs>
            <linearGradient id={`star-${i}-${Math.round(fill * 100)}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset={`${fill * 100}%`} stopColor="var(--color-accent)" />
              <stop offset={`${fill * 100}%`} stopColor="transparent" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.5l2.95 6.2 6.8.85-5 4.7 1.3 6.75L12 17.7 5.95 21l1.3-6.75-5-4.7 6.8-.85z"
            fill={fill >= 1 ? "var(--color-accent)" : fill <= 0 ? "transparent" : `url(#star-${i}-${Math.round(fill * 100)})`}
            stroke="var(--color-accent)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
