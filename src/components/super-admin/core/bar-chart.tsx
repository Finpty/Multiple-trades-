/**
 * Dependency-free inline SVG bar chart for daily / monthly series. Renders
 * on the server; no hydration needed.
 */
export interface BarPoint {
  label: string;
  value: number;
  title?: string;
}

export function BarChart({ points, height = 160, color = "#171717", valueFormatter, emptyText = "No data for this period." }: { points: BarPoint[]; height?: number; color?: string; valueFormatter?: (v: number) => string; emptyText?: string }) {
  const max = Math.max(0, ...points.map((p) => p.value));
  if (points.length === 0 || max === 0) {
    return <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm text-neutral-500">{emptyText}</div>;
  }
  const width = 720;
  const padL = 44;
  const padB = 28;
  const padT = 10;
  const innerW = width - padL - 8;
  const innerH = height - padB - padT;
  const gap = points.length > 40 ? 1 : 3;
  const barW = Math.max(2, innerW / points.length - gap);
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString("en-AU"));
  const ticks = [0, 0.5, 1].map((t) => ({ y: padT + innerH - innerH * t, v: max * t }));
  const labelEvery = points.length > 45 ? 15 : points.length > 20 ? 5 : points.length > 10 ? 2 : 1;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[480px]" role="img" aria-label="Bar chart">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - 8} y1={t.y} y2={t.y} stroke="#e5e5e5" strokeDasharray={i === 0 ? undefined : "3 3"} />
            <text x={padL - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="#737373">
              {fmt(Math.round(t.v))}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const h = max ? (p.value / max) * innerH : 0;
          const x = padL + i * (innerW / points.length) + gap / 2;
          const y = padT + innerH - h;
          return (
            <g key={p.label}>
              <rect x={x} y={y} width={barW} height={h} rx={1.5} fill={color} opacity={p.value === 0 ? 0.15 : 0.9}>
                <title>{p.title ?? `${p.label}: ${fmt(p.value)}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#737373">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
