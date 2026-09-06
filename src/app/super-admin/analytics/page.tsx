import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { getPlatformAnalytics, type DailyPoint } from "@/lib/platform/stats";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, TBody, Table, Td, Th, THead, cn } from "@/components/ui";
import { BarChart } from "@/components/super-admin/core/bar-chart";
import { firstParam } from "@/components/super-admin/core/pagination";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const RANGES = [7, 30, 90] as const;

function dayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
}

function toPoints(series: DailyPoint[]) {
  return series.map((p) => ({ label: dayLabel(p.day), value: p.count, title: `${p.day}: ${p.count.toLocaleString("en-AU")}` }));
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export default async function PlatformAnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePlatformAdmin("ADMIN");
  const sp = await searchParams;
  const requested = Number.parseInt(firstParam(sp.range) || "30", 10);
  const days = (RANGES as readonly number[]).includes(requested) ? (requested as 7 | 30 | 90) : 30;
  const a = await getPlatformAnalytics(days);
  const quoteCurrencies = [...new Set(a.acceptedQuotesByMonth.map((q) => q.currency))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform analytics"
        description="Activity across every business. Analytics events are recorded by tenant sites; leads, submissions and quotes come from each business's CRM."
        actions={
          <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5">
            {RANGES.map((r) => (
              <Link key={r} href={`/super-admin/analytics?range=${r}`} className={cn("rounded px-3 py-1.5 text-sm", r === days ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100")}>
                {r} days
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={`Events · ${days}d`} value={a.totals.events.toLocaleString("en-AU")} />
        <Stat label={`Page views · ${days}d`} value={a.totals.pageViews.toLocaleString("en-AU")} />
        <Stat label={`Leads · ${days}d`} value={a.totals.leads.toLocaleString("en-AU")} tone="green" />
        <Stat label={`Form submissions · ${days}d`} value={a.totals.submissions.toLocaleString("en-AU")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Analytics events per day" description="All event types (page views, clicks, form starts…)." />
          <CardBody>
            <BarChart points={toPoints(a.eventsPerDay)} emptyText="No analytics events in this period. Events arrive once published sites receive visitors." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Page views per day" />
          <CardBody>
            <BarChart points={toPoints(a.pageViewsPerDay)} color="#0369a1" emptyText="No page views in this period." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Leads per day" description="New leads created in any business (forms, bookings, manual entry)." />
          <CardBody>
            <BarChart points={toPoints(a.leadsPerDay)} color="#047857" emptyText="No leads in this period." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Form submissions per day" />
          <CardBody>
            <BarChart points={toPoints(a.submissionsPerDay)} color="#7c3aed" emptyText="No form submissions in this period." />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top businesses by page views" description={`Last ${days} days.`} />
          {a.topBusinesses.length === 0 ? (
            <CardBody>
              <EmptyState title="No page views yet" description="Published sites report page views automatically." />
            </CardBody>
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <tr>
                  <Th>#</Th>
                  <Th>Business</Th>
                  <Th className="text-right">Page views</Th>
                </tr>
              </THead>
              <TBody>
                {a.topBusinesses.map((b, idx) => (
                  <tr key={b.businessId}>
                    <Td className="text-xs text-neutral-500">{idx + 1}</Td>
                    <Td>
                      <Link href={`/super-admin/businesses/${b.businessId}`} className="font-medium hover:underline">
                        {b.name}
                      </Link>
                      <div className="font-mono text-xs text-neutral-500">{b.slug}</div>
                    </Td>
                    <Td className="text-right font-medium">{b.pageViews.toLocaleString("en-AU")}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Accepted quote value by month" description="Last 12 months, grouped by currency." />
          {a.acceptedQuotesByMonth.length === 0 ? (
            <CardBody>
              <EmptyState title="No accepted quotes" description="Values appear once businesses send quotes and customers accept them." />
            </CardBody>
          ) : (
            <CardBody className="space-y-6">
              {quoteCurrencies.map((currency) => {
                const rows = a.acceptedQuotesByMonth.filter((q) => q.currency === currency);
                return (
                  <div key={currency}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{currency}</div>
                    <BarChart points={rows.map((q) => ({ label: monthLabel(q.month), value: q.totalCents / 100, title: `${monthLabel(q.month)}: ${formatCents(q.totalCents, currency)} (${q.count} quote${q.count === 1 ? "" : "s"})` }))} valueFormatter={(v) => formatCents(Math.round(v * 100), currency)} height={140} color="#b45309" />
                  </div>
                );
              })}
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}
