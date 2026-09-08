import Link from "next/link";
import { requireBusinessAccess } from "@/lib/authz";
import { hasUnpublishedChanges } from "@/lib/website/overview";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { Badge, ButtonLink, PageHeader, TBody, Table, Td, Th, THead, Tabs, formatDateTime, statusTone } from "@/components/ui";
import { PageRowActions } from "@/components/editor/sections/page-row-actions";
import { pageLifecycleAction, schedulePageAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pages" };

export default async function PagesListPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { businessId } = await params;
  const { view = "active" } = await searchParams;
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const pages = await ctx.db.page.findMany({ where: { businessId, ...(view === "archived" ? { status: "ARCHIVED" } : { status: { not: "ARCHIVED" } }) }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { title: "asc" }] });
  const b = `/admin/${businessId}/website`;
  const site = publicSiteUrl(ctx.business, null);
  return (
    <>
      <PageHeader title="Pages" description="System pages are generated for every business; add unlimited custom and landing pages." breadcrumbs={[{ label: "Website", href: b }, { label: "Pages" }]} actions={<ButtonLink href={`${b}/pages/new`}>Create page</ButtonLink>} />
      <Tabs current={view} items={[{ key: "active", label: "Pages", href: `${b}/pages` }, { key: "archived", label: "Archived", href: `${b}/pages?view=archived` }]} />
      <Table>
        <THead><tr><Th>Page</Th><Th>Type</Th><Th>Status</Th><Th>In nav</Th><Th>Updated</Th><Th></Th></tr></THead>
        <TBody>
          {pages.length === 0 && <tr><Td colSpan={6} className="text-center text-neutral-500">No pages here.</Td></tr>}
          {pages.map((p) => (
            <tr key={p.id}>
              <Td><Link href={`${b}/pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link><span className="block text-xs text-neutral-500">/{p.slug}</span></Td>
              <Td><Badge>{p.kind.toLowerCase()}</Badge>{p.audience !== "PUBLIC" && <Badge className="ml-1" tone="purple">{p.audience.toLowerCase()}</Badge>}</Td>
              <Td><Badge tone={statusTone(p.status)}>{p.status}</Badge>{p.status === "SCHEDULED" && p.scheduledAt && <span className="block text-xs text-neutral-500">{formatDateTime(p.scheduledAt)}</span>}{p.status !== "ARCHIVED" && hasUnpublishedChanges(p) && <Badge tone="amber" className="ml-1">draft changes</Badge>}</Td>
              <Td>{p.showInNav ? "Yes" : "No"}</Td>
              <Td className="text-neutral-500">{formatDateTime(p.updatedAt)}</Td>
              <Td><PageRowActions businessId={businessId} page={{ id: p.id, slug: p.slug, status: p.status, kind: p.kind }} siteUrl={site} lifecycle={pageLifecycleAction} schedule={schedulePageAction} canPublish={ctx.can("website.publish")} /></Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </>
  );
}
