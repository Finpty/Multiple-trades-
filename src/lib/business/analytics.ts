import type { TenantDb } from "@/lib/db";

export interface DayPoint { day: string; value: number }

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fillDays(days: number, counts: Map<string, number>): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const k = dayKey(d);
    out.push({ day: k, value: counts.get(k) ?? 0 });
  }
  return out;
}

export async function loadAnalytics(db: TenantDb, businessId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [events, leads, submissions, quotes, forms] = await Promise.all([
    db.analyticsEvent.findMany({ where: { businessId, createdAt: { gte: since } }, select: { type: true, path: true, referrer: true, createdAt: true, device: true } }),
    db.lead.findMany({ where: { businessId, createdAt: { gte: since } }, select: { source: true, createdAt: true, status: true } }),
    db.formSubmission.findMany({ where: { businessId, createdAt: { gte: since } }, select: { formId: true } }),
    db.quote.findMany({ where: { businessId, createdAt: { gte: since } }, select: { status: true, totalCents: true, sentAt: true, acceptedAt: true } }),
    db.form.findMany({ where: { businessId }, select: { id: true, name: true } }),
  ]);
  const countBy = <T,>(rows: T[], key: (r: T) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const views = events.filter((e) => e.type === "page_view");
  const top = (m: Map<string, number>, n = 10) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
  const formNames = new Map(forms.map((f) => [f.id, f.name]));
  const sent = quotes.filter((q) => q.sentAt).length;
  const accepted = quotes.filter((q) => q.status === "ACCEPTED");
  return {
    days,
    pageViews: fillDays(days, countBy(views, (e) => dayKey(e.createdAt))),
    leadsPerDay: fillDays(days, countBy(leads, (l) => dayKey(l.createdAt))),
    topPages: top(countBy(views, (e) => e.path)),
    referrers: top(countBy(views, (e) => e.referrer || "(direct)")),
    devices: top(countBy(views, (e) => e.device || "unknown")),
    leadSources: top(countBy(leads, (l) => l.source?.replace("website:", "") || "manual")),
    submissionsByForm: top(countBy(submissions, (s) => formNames.get(s.formId) ?? "deleted form")),
    estimates: events.filter((e) => e.type === "estimate").length,
    ctaClicks: events.filter((e) => e.type === "cta_click" || e.type === "phone_click").length,
    quoteFunnel: { created: quotes.length, sent, accepted: accepted.length, winRate: sent ? Math.round((accepted.length / sent) * 100) : 0, acceptedValueCents: accepted.reduce((s, q) => s + q.totalCents, 0) },
    totals: { pageViews: views.length, leads: leads.length, submissions: submissions.length },
  };
}
