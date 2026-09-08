import { requireBusinessAccess } from "@/lib/authz";
import { listRedirects, readSeoDefaults } from "@/lib/website/seo";
import { readPageSeo } from "@/lib/website/pages";
import { PageHeader } from "@/components/ui";
import { SeoDefaultsForm } from "@/components/editor/seo/seo-defaults-form";
import { PageSeoTable } from "@/components/editor/seo/page-seo-table";
import { RedirectsManager } from "@/components/editor/seo/redirects-manager";
import { quickSeoAction, redirectStateAction, saveRedirectAction, saveSeoDefaultsAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO" };

export default async function SeoPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const [pages, redirects] = await Promise.all([ctx.db.page.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }), listRedirects(ctx.db, businessId)]);
  const defaults = readSeoDefaults(ctx.business);
  const b = `/admin/${businessId}/website`;
  return (
    <>
      <PageHeader title="SEO & redirects" description="Site-wide defaults, per-page titles and descriptions, and redirects for old URLs." breadcrumbs={[{ label: "Website", href: b }, { label: "SEO" }]} />
      <div className="space-y-8">
        <SeoDefaultsForm businessId={businessId} action={saveSeoDefaultsAction.bind(null, businessId)} initial={defaults} />
        <PageSeoTable businessId={businessId} pages={pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, seo: readPageSeo(p) }))} save={quickSeoAction} />
        <RedirectsManager businessId={businessId} redirects={redirects.map((r) => ({ id: r.id, fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode, isActive: r.isActive }))} save={saveRedirectAction} state={redirectStateAction} />
      </div>
    </>
  );
}
