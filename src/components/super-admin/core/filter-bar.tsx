import { ButtonLink, Card, buttonClass } from "@/components/ui";

/**
 * GET filter form. Children are the inputs; the form submits to the current
 * path so the page reads filters from searchParams. Server-component safe.
 */
export function FilterBar({ children, resetHref, hidden }: { children: React.ReactNode; resetHref: string; hidden?: Record<string, string> }) {
  return (
    <Card className="mb-4 p-4">
      <form method="get" className="flex flex-wrap items-end gap-3">
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        <div className="flex items-center gap-2">
          <button type="submit" className={buttonClass("primary", "md")}>
            Apply
          </button>
          <ButtonLink href={resetHref} variant="ghost">
            Reset
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}

export function FilterField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className ?? "min-w-[160px] flex-1"}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
