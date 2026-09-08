import { requireBusinessAccess } from "@/lib/authz";
import { MENU_DEFINITIONS, loadMenus, pagesNotInMenus, type NavPageOption } from "@/lib/website/navigation";
import { Alert, PageHeader } from "@/components/ui";
import { NavBuilder } from "@/components/editor/navigation/nav-builder";
import { publishNavigationAction, saveMenuAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Navigation" };

export default async function NavigationPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const [menus, pageRows] = await Promise.all([loadMenus(ctx.db, businessId, ctx.user.id), ctx.db.page.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true, slug: true, systemKey: true, status: true, kind: true } })]);
  const pages: NavPageOption[] = pageRows;
  const orphans = pagesNotInMenus(pages, menus);
  const b = `/admin/${businessId}/website`;
  return (
    <>
      <PageHeader title="Navigation" description="Header, footer and mobile menus. Drag to reorder, nest items for dropdowns, then publish." breadcrumbs={[{ label: "Website", href: b }, { label: "Navigation" }]} />
      {orphans.length > 0 && <Alert tone="info" className="mb-4">Pages not linked from any menu: {orphans.map((p) => p.title).join(", ")}.</Alert>}
      <NavBuilder businessId={businessId} menus={menus} definitions={MENU_DEFINITIONS} pages={pages} save={saveMenuAction} publish={publishNavigationAction} canPublish={ctx.can("website.publish")} />
    </>
  );
}
