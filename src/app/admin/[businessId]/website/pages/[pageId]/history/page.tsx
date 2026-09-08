import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listPageRevisions } from "@/lib/website/pages";
import { PageHeader } from "@/components/ui";
import { RevisionList } from "@/components/editor/sections/revision-list";
import { restoreRevisionAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function PageHistoryPage({ params }: { params: Promise<{ businessId: string; pageId: string }> }) {
  const { businessId, pageId } = await params;
  if (!isUuid(pageId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const page = await ctx.db.page.findFirst({ where: { id: pageId, businessId }, select: { title: true } });
  if (!page) notFound();
  const revisions = await listPageRevisions(ctx.db, businessId, pageId);
  const b = `/admin/${businessId}/website`;
  return (
    <>
      <PageHeader title={`${page.title} — history`} description="Every published version is kept. Restore any version into the draft, then publish." breadcrumbs={[{ label: "Website", href: b }, { label: "Pages", href: `${b}/pages` }, { label: page.title, href: `${b}/pages/${pageId}` }, { label: "History" }]} />
      <RevisionList businessId={businessId} pageId={pageId} revisions={revisions} restore={restoreRevisionAction} />
    </>
  );
}
