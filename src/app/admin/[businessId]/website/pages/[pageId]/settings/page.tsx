import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PAGE_AUDIENCES, PAGE_TEMPLATES, readPageSeo } from "@/lib/website/pages";
import { PageHeader } from "@/components/ui";
import { PageSettingsForm } from "@/components/editor/sections/page-settings-form";
import { updatePageSettingsAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function PageSettingsPage({ params }: { params: Promise<{ businessId: string; pageId: string }> }) {
  const { businessId, pageId } = await params;
  if (!isUuid(pageId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const page = await ctx.db.page.findFirst({ where: { id: pageId, businessId } });
  if (!page) notFound();
  const parents = await ctx.db.page.findMany({ where: { businessId, id: { not: pageId }, status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const seo = readPageSeo(page);
  const b = `/admin/${businessId}/website`;
  return (
    <>
      <PageHeader title={`${page.title} — settings`} breadcrumbs={[{ label: "Website", href: b }, { label: "Pages", href: `${b}/pages` }, { label: page.title, href: `${b}/pages/${page.id}` }, { label: "Settings" }]} />
      <PageSettingsForm businessId={businessId} action={updatePageSettingsAction.bind(null, businessId, pageId)} parents={parents} templates={PAGE_TEMPLATES.map((t) => ({ key: t.key, label: t.label }))} audiences={[...PAGE_AUDIENCES]} initial={{ title: page.title, slug: page.slug, isSystem: page.kind === "SYSTEM", isHome: page.systemKey === "home", templateKey: page.templateKey, audience: page.audience, showInNav: page.showInNav, sortOrder: page.sortOrder, parentId: page.parentId, seo, settingsJson: JSON.stringify(page.settings ?? {}, null, 2) }} />
    </>
  );
}
