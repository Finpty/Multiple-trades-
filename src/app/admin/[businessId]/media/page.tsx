import { requireBusinessAccess } from "@/lib/authz";
import { buildFolderTree, listFolders, listLibraryMedia, listMediaTags, storageSummary, type MediaListQuery, type MediaSort } from "@/lib/media/library";
import { PageHeader } from "@/components/ui";
import { MediaLibrary } from "@/components/admin/content/media/media-library";
import { bulkMediaAction, emptyTrashAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media library" };

export default async function MediaPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { businessId } = await params;
  const sp = await searchParams;
  const ctx = await requireBusinessAccess(businessId, "media.manage");
  const query: MediaListQuery = {
    folderId: sp.folder === "root" ? null : sp.folder && sp.folder !== "all" ? sp.folder : undefined,
    kind: sp.kind && ["IMAGE", "VIDEO", "DOCUMENT", "OTHER"].includes(sp.kind) ? (sp.kind as MediaListQuery["kind"]) : null,
    q: sp.q?.trim() || undefined,
    tag: sp.tag || null,
    sort: (sp.sort as MediaSort | undefined) ?? undefined,
    trashed: sp.trashed === "1",
    page: Math.max(1, Number(sp.page ?? 1)),
    pageSize: 48,
  };
  const [folders, list, tags, summary] = await Promise.all([listFolders(ctx.db, businessId), listLibraryMedia(ctx.db, businessId, query), listMediaTags(ctx.db, businessId), storageSummary(ctx.db, businessId)]);
  return (
    <>
      <PageHeader title="Media library" description="Every image, video and document for this business. Upload here, then pick files anywhere in the admin." />
      <MediaLibrary
        businessId={businessId}
        folders={buildFolderTree(folders)}
        items={list.items}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        tags={tags}
        summary={summary}
        query={{ folder: sp.folder ?? "all", kind: sp.kind ?? "", q: sp.q ?? "", tag: sp.tag ?? "", sort: sp.sort ?? "newest", trashed: sp.trashed === "1" }}
        bulk={bulkMediaAction}
        emptyTrash={emptyTrashAction}
      />
    </>
  );
}
