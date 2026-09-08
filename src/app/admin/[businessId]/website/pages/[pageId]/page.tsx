import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { toSectionView } from "@/lib/website/section-types";
import { listEditorOptions } from "@/lib/website/options";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { Badge, ButtonLink, PageHeader, statusTone } from "@/components/ui";
import { SectionEditor } from "@/components/editor/sections/section-editor";
import { addSectionAction, deleteSectionAction, duplicateSectionAction, reorderSectionsAction, toggleSectionHiddenAction, updateSectionAction } from "../../actions";
import { PublishPageButton } from "@/components/editor/sections/publish-page-button";
import { pageLifecycleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PageSectionsPage({ params }: { params: Promise<{ businessId: string; pageId: string }> }) {
  const { businessId, pageId } = await params;
  if (!isUuid(pageId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const page = await ctx.db.page.findFirst({ where: { id: pageId, businessId }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
  if (!page) notFound();
  const options = await listEditorOptions(businessId);
  const b = `/admin/${businessId}/website`;
  const site = publicSiteUrl(ctx.business, null);
  return (
    <>
      <PageHeader title={page.title} description={`/${page.slug || ""}`} breadcrumbs={[{ label: "Website", href: b }, { label: "Pages", href: `${b}/pages` }, { label: page.title }]} actions={<><Badge tone={statusTone(page.status)}>{page.status}</Badge><ButtonLink variant="secondary" href={`${site}${page.slug ? `/${page.slug}` : ""}?__preview=draft`} target="_blank">Preview</ButtonLink><ButtonLink variant="secondary" href={`${b}/pages/${page.id}/settings`}>Settings</ButtonLink><ButtonLink variant="secondary" href={`${b}/editor?page=${page.id}`}>Live editor</ButtonLink>{ctx.can("website.publish") && <PublishPageButton businessId={businessId} pageId={page.id} action={pageLifecycleAction} />}</>} />
      <SectionEditor businessId={businessId} pageId={page.id} initial={page.sections.map(toSectionView)} options={options} actions={{ add: addSectionAction, update: updateSectionAction, reorder: reorderSectionsAction, duplicate: duplicateSectionAction, toggleHidden: toggleSectionHiddenAction, remove: deleteSectionAction }} />
    </>
  );
}
