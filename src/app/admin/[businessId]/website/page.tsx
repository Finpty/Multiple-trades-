import Link from "next/link";
import { requireBusinessAccess } from "@/lib/authz";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { hasUnpublishedChanges } from "@/lib/website/overview";
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, Stat, formatDateTime, statusTone } from "@/components/ui";
import { PublishControls } from "@/components/admin/config/publish-controls";
import { publishBusinessAction, unpublishBusinessAction } from "../setup/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website" };

export default async function WebsiteOverviewPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const [pages, theme, primary] = await Promise.all([
    ctx.db.page.findMany({ where: { businessId }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    ctx.db.businessTheme.findUnique({ where: { businessId } }),
    ctx.db.businessDomain.findFirst({ where: { businessId, isPrimary: true, verificationStatus: "VERIFIED" } }),
  ]);
  const siteUrl = publicSiteUrl(ctx.business, primary?.hostname ?? null);
  const drafts = pages.filter((p) => p.status !== "ARCHIVED" && hasUnpublishedChanges(p));
  const b = `/admin/${businessId}/website`;
  return (
    <>
      <PageHeader title="Website" description="Your site is generated from pages, sections, navigation and theme. Edit anything, preview, then publish." actions={<><ButtonLink href={`${siteUrl}?__preview=draft`} variant="secondary" target="_blank">Preview draft</ButtonLink><ButtonLink href={`${b}/editor`}>Open live editor</ButtonLink></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Status" value={<Badge tone={statusTone(ctx.business.status)}>{ctx.business.status}</Badge>} hint={ctx.business.publishedAt ? `Published ${formatDateTime(ctx.business.publishedAt)}` : "Not published"} />
        <Stat label="Pages" value={pages.filter((p) => p.status !== "ARCHIVED").length} hint={`${pages.filter((p) => p.status === "PUBLISHED").length} published`} />
        <Stat label="Unpublished changes" value={drafts.length} tone={drafts.length ? "green" : undefined} hint={drafts.length ? "Publish to make them live" : "Everything is live"} />
        <Stat label="Theme" value={theme?.publishedAt ? "Published" : "Draft"} hint={theme?.publishedAt ? formatDateTime(theme.publishedAt) : "Publish from Brand & Theme"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pages" actions={<Link href={`${b}/pages`} className="text-sm underline">Manage pages</Link>} />
          <ul className="divide-y divide-neutral-100">
            {pages.filter((p) => p.status !== "ARCHIVED").map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span><Link href={`${b}/pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link><span className="ml-2 text-xs text-neutral-500">/{p.slug}</span>{p.kind === "SYSTEM" && <Badge className="ml-2">system</Badge>}</span>
                <span className="flex items-center gap-2"><Badge tone={statusTone(p.status)}>{p.status}</Badge>{hasUnpublishedChanges(p) && <Badge tone="amber">draft changes</Badge>}<Link href={`${b}/editor?page=${p.id}`} className="text-xs underline">Live edit</Link></span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card><CardHeader title="Publish" description="Publishes every page, the navigation and the theme." /><CardBody><PublishControls businessId={businessId} status={ctx.business.status} publish={publishBusinessAction} unpublish={unpublishBusinessAction} canPublish={ctx.can("website.publish")} /><p className="mt-3 text-xs text-neutral-500">Live at <a href={siteUrl} className="underline" target="_blank" rel="noreferrer">{siteUrl}</a></p></CardBody></Card>
          <Card><CardHeader title="Quick links" /><CardBody><ul className="space-y-1.5 text-sm">{[["Navigation", `${b}/navigation`], ["Brand & theme", `${b}/theme`], ["SEO & redirects", `${b}/seo`], ["Create a page", `${b}/pages/new`], ["Media library", `/admin/${businessId}/media`]].map(([l, h]) => <li key={h}><Link href={h} className="underline-offset-2 hover:underline">{l}</Link></li>)}</ul></CardBody></Card>
        </div>
      </div>
    </>
  );
}
