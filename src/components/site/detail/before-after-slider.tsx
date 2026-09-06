"use client";

import * as React from "react";

/**
 * Tiny dependency-free before/after comparison. A range input drives the
 * clip position so it is keyboard and touch accessible out of the box.
 */
export function BeforeAfterSlider({ before, after, beforeLabel = "Before", afterLabel = "After", alt }: { before: string; after: string; beforeLabel?: string; afterLabel?: string; alt?: string }) {
  const [pos, setPos] = React.useState(50);
  return (
    <figure className="relative select-none overflow-hidden rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div className="relative aspect-[4/3] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={alt ? `${alt} — ${afterLabel}` : afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={alt ? `${alt} — ${beforeLabel}` : beforeLabel} className="absolute inset-0 h-full max-w-none object-cover" style={{ width: `${10000 / Math.max(pos, 1)}%` }} draggable={false} />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `calc(${pos}% - 1px)` }}>
          <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold shadow" style={{ color: "var(--color-primary)" }} aria-hidden>
            ⇔
          </div>
        </div>
        <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{beforeLabel}</span>
        <span className="pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{afterLabel}</span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={`Compare ${beforeLabel} and ${afterLabel}`} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
    </figure>
  );
}
