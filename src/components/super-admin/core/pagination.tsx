import Link from "next/link";
import { buttonClass, cn } from "@/components/ui";

/** Server-safe pagination row. `hrefFor` builds the URL for a page number. */
export function Pagination({ page, pages, total, pageSize, hrefFor }: { page: number; pages: number; total: number; pageSize: number; hrefFor: (page: number) => string }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
          Previous
        </PageLink>
        <span className="px-2 text-xs text-neutral-500">
          Page {page} of {pages}
        </span>
        <PageLink href={hrefFor(page + 1)} disabled={page >= pages}>
          Next
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className={cn(buttonClass("secondary", "sm"), "pointer-events-none opacity-50")}>{children}</span>;
  return (
    <Link href={href} className={buttonClass("secondary", "sm")}>
      {children}
    </Link>
  );
}

/** Builds a query string from a record, dropping empty values. */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Reads a positive integer page number from search params. */
export function pageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
