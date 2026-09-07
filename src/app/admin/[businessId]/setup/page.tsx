import Link from "next/link";
import { requireBusinessAccess } from "@/lib/authz";
import { computeSetupChecklist } from "@/lib/business/setup";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { mediaUrls } from "@/lib/media/service";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, cn, statusTone } from "@/components/ui";
import { Icon } from "@/components/admin/icon";
import { LogoUploader } from "@/components/admin/config/logo-uploader";
import { PublishControls } from "@/components/admin/config/publish-controls";
import { publishBusinessAction, setLogoAction, unpublishBusinessAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup" };

export default async function SetupPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ created?: string; warnings?: string }> }) {
  const { businessId } = await params;
  const { created, warnings } = await searchParams;
  const ctx = await requireBusinessAccess(businessId, "business.view");
  const [checklist, primaryDomain, logo] = await Promise.all([
    computeSetupChecklist(ctx.db, businessId),
    ctx.db.businessDomain.findFirst({ where: { businessId, isPrimary: true, verificationStatus: "VERIFIED" } }),
    ctx.business.logoMediaId ? ctx.db.media.findFirst({ where: { id: ctx.business.logoMediaId, businessId } }) : Promise.resolve(null),
  ]);
  const siteUrl = publicSiteUrl(ctx.business, primaryDomain?.hostname ?? null);
  const logoPreview = logo ? await mediaUrls(logo) : null;
  return (
    <>
      <PageHeader title={created ? `${ctx.business.name} is ready to set up` : "Setup checklist"} description="Work through these steps in any order. Everything here is done from the admin — no code, no developer." actions={<Badge tone={statusTone(ctx.business.status)}>{ctx.business.status}</Badge>} />
      {created && <Alert tone="success" className="mb-4" title="Business created">Your website, services, pricing, forms and workflow were generated from the industry settings. Customise anything below.</Alert>}
      {warnings && <Alert tone="warning" className="mb-4" title="Some steps need attention"><pre className="whitespace-pre-wrap text-xs">{warnings}</pre></Alert>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={`${checklist.done} of ${checklist.total} steps complete`} description={`${checklist.percent}% ready`} />
            <div className="h-2 w-full bg-neutral-100"><div className="h-2 bg-emerald-500 transition-all" style={{ width: `${checklist.percent}%` }} /></div>
            <ul className="divide-y divide-neutral-100">
              {checklist.items.map((it) => (
                <li key={it.key} className="flex items-center gap-4 px-5 py-3">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", it.done ? "bg-emerald-500 text-white" : "border border-neutral-300 text-neutral-400")}><Icon name={it.done ? "Check" : "Circle"} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-neutral-900">{it.label}{it.detail && <span className="ml-2 text-xs font-normal text-neutral-500">{it.detail}</span>}</span>
                    <span className="block text-xs text-neutral-500">{it.description}</span>
                  </span>
                  {it.key !== "publish" && <Link href={it.href} className="text-sm text-neutral-700 underline-offset-2 hover:underline">{it.done ? "Review" : "Set up"} →</Link>}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Logo" description="Upload your logo now; it appears once the theme is published." />
            <CardBody><LogoUploader businessId={businessId} current={logoPreview ? { id: logoPreview.id, url: logoPreview.url, thumb: logoPreview.thumb, alt: logoPreview.alt, kind: logoPreview.kind } : null} action={setLogoAction.bind(null, businessId)} /></CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Publish" description={ctx.business.status === "PUBLISHED" ? "Your website is live." : "Your website is not public yet."} />
            <CardBody>
              <PublishControls businessId={businessId} status={ctx.business.status} publish={publishBusinessAction} unpublish={unpublishBusinessAction} canPublish={ctx.can("business.publish")} />
              <div className="mt-4 space-y-1 text-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Website address</div>
                <a href={siteUrl} target="_blank" rel="noreferrer" className="block truncate text-neutral-900 underline-offset-2 hover:underline">{siteUrl}</a>
                {!primaryDomain && <Link href={`/admin/${businessId}/domains`} className="block text-xs text-neutral-500 hover:underline">Connect your own domain →</Link>}
                <a href={`${siteUrl}?__preview=draft`} target="_blank" rel="noreferrer" className="block text-xs text-neutral-500 hover:underline">Preview unpublished changes →</a>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Quick links" />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {[["Edit website", `/admin/${businessId}/website/editor`], ["Brand & theme", `/admin/${businessId}/website/theme`], ["Services", `/admin/${businessId}/services`], ["Pricing", `/admin/${businessId}/pricing`], ["Media library", `/admin/${businessId}/media`], ["Leads", `/admin/${businessId}/leads`], ["Settings", `/admin/${businessId}/settings`]].map(([l, h]) => (
                  <li key={h}><Link href={h} className="text-neutral-800 underline-offset-2 hover:underline">{l}</Link></li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
