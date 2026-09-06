"use client";

import { useId, useState } from "react";

/**
 * Before/after comparison. A range input (keyboard + touch accessible) drives
 * the clip of the "after" layer; no external library.
 */
export function BeforeAfterSlider({ before, after, beforeAlt, afterAlt, aspect = "4 / 3", filterClass = "" }: { before: string; after: string; beforeAlt: string; afterAlt: string; aspect?: string; filterClass?: string }) {
  const [pos, setPos] = useState(50);
  const id = useId();
  return (
    <div className="site-ba" style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={beforeAlt} className={filterClass} draggable={false} />
      <div className="site-ba-after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterAlt} className={filterClass} draggable={false} />
      </div>
      <div className="site-ba-handle" style={{ left: `${pos}%` }} aria-hidden="true">
        <span className="site-ba-knob">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6-6 6 6 6" />
            <path d="m15 6 6 6-6 6" />
          </svg>
        </span>
      </div>
      <span className="site-ba-tag left-3">Before</span>
      <span className="site-ba-tag right-3">After</span>
      <label htmlFor={id} className="sr-only">
        Drag to compare before and after
      </label>
      <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="site-ba-range" aria-valuetext={`${pos}% after`} />
    </div>
  );
}
