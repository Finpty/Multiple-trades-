import { requireBusinessAccess } from "@/lib/authz";
import { loadAnalytics } from "@/lib/business/analytics";
import { formatCents } from "@/lib/money";
import { Card, CardBody, CardHeader, PageHeader, Stat, Tabs } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

function Bars({ points, color = "var(--color-primary, #0f172a)" }: { points: Array<{ day: string; value: number }>; color?: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 600, h = 140, bw = w / points.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" role="img" aria-label="Daily values">
      {points.map((p, i) => <rect key={p.day} x={i * bw + 1} y={h - (p.value / max) * h} width={Math.max(1, bw - 2)} height={(p.value / max) * h} fill={color} opacity={0.85}><title>{p.day}: {p.value}</title></rect>)}
      <text x={0} y={h + 14} fontSize="10" fill="#737373">{points[0]?.day}</text>
      <text x={w} y={h + 14} fontSize="10" fill="#737373" textAnchor="end">{points[points.length - 1]?.day}</text>
    </svg>
  );
}

function List({ items, total }: { items: Array<{ label: string; value: number }>; total?: number }) {
  if (items.length === 0) return <p className="text-sm text-neutral-500">No data in this period.</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return <ul className="space-y-1.5 text-sm">{items.map((i) => <li key={i.label}><div className="flex justify-between"><span className="truncate pr-2">{i.label}</span><span className="text-neutral-500">{i.value}{total ? ` (${Math.round((i.value / total) * 100)}%)` : ""}</span></div><div className="mt-0.5 h-1 rounded bg-neutral-100"><div className="h-1 rounded bg-neutral-800" style={{ width: `${(i.value / max) * 100}%` }} /></div></li>)}</ul>;
}

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ range?: string }> }) {
  const { businessId } = await params;
  const { range } = await searchParams;
  const days = [7, 30, 90].includes(Number(range)) ? Number(range) : 30;
  const ctx = await requireBusinessAccess(businessId, "analytics.view");
  const a = await loadAnalytics(ctx.db, businessId, days);
  const b = `/admin/${businessId}/analytics`;
  return (
    <>
      <PageHeader title="Analytics" description="First-party, privacy-friendly analytics collected by your website. No third-party scripts." />
      <Tabs current={String(days)} items={[{ key: "7", label: "7 days", href: `${b}?range=7` }, { key: "30", label: "30 days", href: `${b}?range=30` }, { key: "90", label: "90 days", href: `${b}?range=90` }]} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Page views" value={a.totals.pageViews} />
        <Stat label="Leads" value={a.totals.leads} />
        <Stat label="Form submissions" value={a.totals.submissions} />
        <Stat label="Estimates run" value={a.estimates} />
        <Stat label="Quote win rate" value={`${a.quoteFunnel.winRate}%`} hint={`${a.quoteFunnel.accepted} of ${a.quoteFunnel.sent} sent · ${formatCents(a.quoteFunnel.acceptedValueCents, ctx.business.currency)}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Page views per day" /><CardBody><Bars points={a.pageViews} /></CardBody></Card>
        <Card><CardHeader title="Leads per day" /><CardBody><Bars points={a.leadsPerDay} color="#059669" /></CardBody></Card>
        <Card><CardHeader title="Top pages" /><CardBody><List items={a.topPages} total={a.totals.pageViews} /></CardBody></Card>
        <Card><CardHeader title="Referrers" /><CardBody><List items={a.referrers} total={a.totals.pageViews} /></CardBody></Card>
        <Card><CardHeader title="Lead sources" /><CardBody><List items={a.leadSources} total={a.totals.leads} /></CardBody></Card>
        <Card><CardHeader title="Submissions by form" /><CardBody><List items={a.submissionsByForm} total={a.totals.submissions} /></CardBody></Card>
        <Card><CardHeader title="Devices" /><CardBody><List items={a.devices} total={a.totals.pageViews} /></CardBody></Card>
        <Card><CardHeader title="Quote funnel" /><CardBody><List items={[{ label: "Created", value: a.quoteFunnel.created }, { label: "Sent", value: a.quoteFunnel.sent }, { label: "Accepted", value: a.quoteFunnel.accepted }]} /></CardBody></Card>
      </div>
    </>
  );
}
