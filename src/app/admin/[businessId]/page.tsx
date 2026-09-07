import Link from "next/link";
import { requireBusinessAccess } from "@/lib/authz";
import { computeSetupChecklist } from "@/lib/business/setup";
import { friendlyAction, loadDashboard } from "@/lib/business/dashboard";
import { formatCents } from "@/lib/money";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, Stat, formatDateTime, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function BusinessDashboard({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ denied?: string }> }) {
  const { businessId } = await params;
  const { denied } = await searchParams;
  const ctx = await requireBusinessAccess(businessId, "business.view");
  const [data, setup, primaryDomain] = await Promise.all([loadDashboard(ctx.db, businessId), computeSetupChecklist(ctx.db, businessId), ctx.db.businessDomain.findFirst({ where: { businessId, isPrimary: true, verificationStatus: "VERIFIED" } })]);
  const siteUrl = publicSiteUrl(ctx.business, primaryDomain?.hostname ?? null);
  const trend = data.leadsPrev30d === 0 ? null : Math.round(((data.leads30d - data.leadsPrev30d) / data.leadsPrev30d) * 100);
  const maxStage = Math.max(1, ...data.jobsByStage.map((s) => s.count));
  const b = `/admin/${businessId}`;
  return (
    <>
      <PageHeader
        title={`Welcome back, ${ctx.user.name.split(" ")[0]}`}
        description={`${ctx.business.name} · ${ctx.business.status === "PUBLISHED" ? "website live" : "website not published"}`}
        actions={<><ButtonLink href={`${b}/quotes/new`} variant="secondary" size="sm">New quote</ButtonLink><ButtonLink href={`${b}/leads/new`} variant="secondary" size="sm">New lead</ButtonLink><ButtonLink href={`${b}/projects/new`} variant="secondary" size="sm">Add project</ButtonLink><ButtonLink href={`${b}/website/editor`} size="sm">Edit website</ButtonLink></>}
      />
      {denied && <Alert tone="warning" className="mb-4">You don&apos;t have the <code>{denied}</code> permission. Ask a business owner to change your role.</Alert>}
      {setup.percent < 100 && (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Setup {setup.percent}% complete</div>
              <div className="mt-2 h-2 w-full rounded bg-neutral-100"><div className="h-2 rounded bg-emerald-500" style={{ width: `${setup.percent}%` }} /></div>
              <div className="mt-1 text-xs text-neutral-500">{setup.items.filter((i) => !i.done).slice(0, 3).map((i) => i.label).join(" · ")}</div>
            </div>
            <ButtonLink href={`${b}/setup`} variant="secondary" size="sm">Open checklist</ButtonLink>
          </CardBody>
        </Card>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="New leads (30d)" value={data.leads30d} hint={trend === null ? "no prior data" : `${trend >= 0 ? "+" : ""}${trend}% vs previous 30 days`} tone={trend !== null && trend < 0 ? "red" : "green"} />
        <Stat label="Open quotes" value={data.openQuotes.count} hint={formatCents(data.openQuotes.totalCents, ctx.business.currency)} />
        <Stat label="Bookings (7d)" value={data.upcomingBookings} />
        <Stat label="Unread submissions" value={data.newSubmissions} tone={data.newSubmissions > 0 ? "green" : undefined} />
        <Stat label="Page views (30d)" value={data.pageViews30d} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Jobs by stage" actions={<Link href={`${b}/jobs`} className="text-sm underline">Open board</Link>} />
          <CardBody>
            {data.jobsByStage.length === 0 ? <p className="text-sm text-neutral-500">No workflow configured.</p> : (
              <ul className="space-y-2">
                {data.jobsByStage.map((s) => (
                  <li key={s.key} className="text-sm">
                    <div className="flex justify-between"><span>{s.name}</span><span className="text-neutral-500">{s.count}</span></div>
                    <div className="mt-1 h-1.5 rounded bg-neutral-100"><div className="h-1.5 rounded" style={{ width: `${(s.count / maxStage) * 100}%`, background: s.color }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader title="Recent leads" actions={<Link href={`${b}/leads`} className="text-sm underline">All leads</Link>} />
          <CardBody>
            {data.recentLeads.length === 0 ? <p className="text-sm text-neutral-500">No leads yet. Leads arrive from your website forms.</p> : (
              <ul className="divide-y divide-neutral-100">
                {data.recentLeads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm"><Link href={`${b}/leads/${l.id}`} className="font-medium hover:underline">{l.name}</Link><span className="flex items-center gap-2 text-xs text-neutral-500">{l.source?.replace("website:", "") ?? "manual"}<Badge tone={statusTone(l.status)}>{l.status}</Badge></span></li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader title="Recent activity" actions={<Link href={`${b}/audit`} className="text-sm underline">Audit log</Link>} />
          <CardBody>
            {data.recentActivity.length === 0 ? <p className="text-sm text-neutral-500">Nothing yet.</p> : (
              <ul className="space-y-2 text-sm">
                {data.recentActivity.map((a) => (
                  <li key={a.id}><span className="font-medium">{friendlyAction(a.action)}</span><span className="block text-xs text-neutral-500">{a.actorName ?? "—"} · {formatDateTime(a.createdAt)}</span></li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
      <p className="mt-6 text-xs text-neutral-500">Public website: <a href={siteUrl} className="underline" target="_blank" rel="noreferrer">{siteUrl}</a></p>
    </>
  );
}
