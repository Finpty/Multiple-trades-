import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteHref, type SiteContext } from "@/lib/tenant/resolve";
import { breadcrumbJsonLd } from "@/lib/site/seo";
import { JsonLd } from "./detail/json-ld";

export interface Crumb {
  label: string;
  /** Site-relative path ("/services") */
  path: string;
}

/** Visible breadcrumb trail plus BreadcrumbList structured data. */
export function Breadcrumbs({ ctx, crumbs, className = "" }: { ctx: SiteContext; crumbs: Crumb[]; className?: string }) {
  if (crumbs.length === 0) return null;
  const trail = [{ label: "Home", path: "/" }, ...crumbs];
  return (
    <nav aria-label="Breadcrumb" className={`text-xs ${className}`}>
      <JsonLd data={breadcrumbJsonLd(ctx, trail)} />
      <ol className="flex flex-wrap items-center gap-1 opacity-75">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${c.path}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />}
              {last ? <span aria-current="page" className="font-medium">{c.label}</span> : <Link href={siteHref(ctx, c.path)} className="hover:underline">{c.label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
