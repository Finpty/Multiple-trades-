import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listMaterialCategories, listMaterials, type MaterialListFilter } from "@/lib/content/materials";
import { ButtonLink, EmptyState, PageHeader, cn } from "@/components/ui";
import { MaterialsList } from "@/components/admin/content/materials/materials-list";
import { materialStateAction, reorderMaterialsAction } from "./actions";

export const dynamic = "force-dynamic";
const FILTERS: Array<{ key: MaterialListFilter; label: string }> = [{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }, { key: "archived", label: "Archived" }];

export default async function MaterialsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ filter?: string; q?: string; category?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "services.manage");
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as MaterialListFilter;
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const [rows, categories] = await Promise.all([listMaterials(ctx.db, businessId, { filter, q: q || undefined, category: category || undefined }), listMaterialCategories(ctx.db, businessId)]);
  const base = `/admin/${businessId}/materials`;
  const qs = (f: string) => { const p = new URLSearchParams(); if (f !== "all") p.set("filter", f); if (q) p.set("q", q); if (category) p.set("category", category); const s = p.toString(); return s ? `${base}?${s}` : base; };
  return (
    <div>
      <PageHeader title="Materials" description="Products and materials you work with. Link them to services so they appear on service pages, and reference them in projects." actions={<ButtonLink href={`${base}/new`}>Add material</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {FILTERS.map((f) => <Link key={f.key} href={qs(f.key)} className={cn("rounded-full px-3 py-1 text-sm", f.key === filter ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>{f.label}</Link>)}
        <form className="ml-auto flex gap-2" action={base}>
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <select name="category" defaultValue={category} className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" aria-label="Category"><option value="">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input name="q" defaultValue={q} placeholder="Search materials" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm" aria-label="Search materials" />
          <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">Filter</button>
        </form>
      </div>
      {rows.length === 0 ? <EmptyState title={q || category ? "No matches" : "No materials yet"} description="Add the tiles, stone, fixtures or products you commonly use." action={!q && <ButtonLink href={`${base}/new`}>Add material</ButtonLink>} /> : (
        <MaterialsList businessId={businessId} sortable={filter === "all" && !q && !category} rows={rows.map((r) => ({ id: r.id, name: r.name, category: r.category ?? "", services: r.services.map((s) => s.name).join(", "), thumb: r.thumb, isActive: r.isActive, archived: !!r.deletedAt }))} setState={materialStateAction} reorder={reorderMaterialsAction} />
      )}
    </div>
  );
}
