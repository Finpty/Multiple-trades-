import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { toSectionView } from "@/lib/website/section-types";
import { listEditorOptions } from "@/lib/website/options";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { LiveEditor } from "@/components/editor/live/live-editor";
import { addSectionAction, deleteSectionAction, duplicateSectionAction, listSectionsAction, pageLifecycleAction, reorderSectionsAction, toggleSectionHiddenAction, updateSectionAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live editor" };

/**
 * Live visual editor: the draft site renders in an iframe (?__preview=draft&__editor=1)
 * and talks to this page over postMessage (src/lib/editor/protocol.ts).
 */
export default async function LiveEditorPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { businessId } = await params;
  const { page: requested } = await searchParams;
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const pages = await ctx.db.page.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, select: { id: true, title: true, slug: true, status: true, kind: true, systemKey: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
  if (pages.length === 0) notFound();
  const page = (requested && isUuid(requested) ? pages.find((p) => p.id === requested) : undefined) ?? pages.find((p) => p.slug === "") ?? pages[0];
  const [sections, options] = await Promise.all([
    ctx.db.pageSection.findMany({ where: { pageId: page.id, businessId }, orderBy: { sortOrder: "asc" } }),
    listEditorOptions(businessId),
  ]);
  return (
    <LiveEditor
      key={page.id}
      businessId={businessId}
      page={{ id: page.id, title: page.title, slug: page.slug, status: page.status }}
      pages={pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status }))}
      initial={sections.map(toSectionView)}
      options={options}
      siteUrl={publicSiteUrl(ctx.business, null)}
      canPublish={ctx.can("website.publish")}
      actions={{ add: addSectionAction, update: updateSectionAction, reorder: reorderSectionsAction, duplicate: duplicateSectionAction, toggleHidden: toggleSectionHiddenAction, remove: deleteSectionAction, list: listSectionsAction, lifecycle: pageLifecycleAction }}
    />
  );
}
