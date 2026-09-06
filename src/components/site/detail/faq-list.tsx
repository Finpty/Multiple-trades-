import { ChevronDown } from "lucide-react";
import { Markdown } from "./markdown";

/** Accessible accordion built on <details>, no JavaScript required. */
export function FaqList({ items, heading }: { items: Array<{ question: string; answer: string }>; heading?: string }) {
  const clean = items.filter((f) => f.question && f.answer);
  if (!clean.length) return null;
  return (
    <div>
      {heading && <h2 className="mb-5 text-2xl font-semibold">{heading}</h2>}
      <div className="divide-y rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)" }}>
        {clean.map((f, i) => (
          <details key={i} className="group px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              <span>{f.question}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3 text-sm opacity-85">
              <Markdown source={f.answer} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
