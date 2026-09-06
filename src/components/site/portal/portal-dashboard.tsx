import { CalendarDays, FileText, LogIn, Receipt, Wrench } from "lucide-react";
import type { SiteContext } from "@/lib/tenant/resolve";
import { formatCents } from "@/lib/money";
import { platformUrl, siteAbsoluteUrl, siteTerminology, termPlural } from "@/lib/site/context";
import type { PortalState } from "@/lib/site/portal";

const fmtDate = (d: Date | null | undefined, locale: string, withTime = false) =>
  d ? new Intl.DateTimeFormat(locale, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(d) : "—";

function StatusBadge({ value, color }: { value: string; color?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}
      {value.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

function Panel({ title, icon: Icon, count, children, empty }: { title: string; icon: React.ComponentType<{ className?: string }>; count: number; children: React.ReactNode; empty: string }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)" }}>
      <header className="flex items-center justify-between px-5 py-3" style={{ background: "var(--color-surface)" }}>
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
          <Icon className="h-4 w-4 opacity-70" />
          {title}
        </h2>
        <span className="text-xs opacity-60">{count}</span>
      </header>
      {count === 0 ? <p className="px-5 py-6 text-sm opacity-70">{empty}</p> : <div className="overflow-x-auto">{children}</div>}
    </section>
  );
}

const th = "px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider opacity-60";
const td = "px-5 py-3 text-sm";

/** Read-only customer portal: quotes, invoices, jobs (with stage names) and bookings for the signed-in customer. */
export function PortalDashboard({ ctx, state }: { ctx: SiteContext; state: PortalState }) {
  const terms = siteTerminology(ctx);
  const locale = ctx.business.locale;
  const loginHref = platformUrl(`/login?next=${encodeURIComponent(siteAbsoluteUrl(ctx, "/portal"))}`);

  if (state.kind !== "ready") {
    return (
      <div className="site-container site-container-narrow py-20 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--color-surface)" }}>
          <LogIn className="h-6 w-6" style={{ color: "var(--color-primary)" }} aria-hidden />
        </div>
        <h1 className="mt-5 text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{terms.customer} portal</h1>
        {state.kind === "anonymous" ? (
          <>
            <p className="mt-3 opacity-80">Sign in to see your {termPlural(terms, "quote").toLowerCase()}, invoices, {termPlural(terms, "job").toLowerCase()} and bookings with {ctx.business.name}.</p>
            <a href={loginHref} className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--color-accent)" }}>
              <LogIn className="h-4 w-4" aria-hidden /> Sign in
            </a>
          </>
        ) : (
          <>
            <p className="mt-3 opacity-80">You are signed in{state.email ? ` as ${state.email}` : ""}, but this account is not linked to a {terms.customer.toLowerCase()} record at {ctx.business.name}.</p>
            <p className="mt-2 text-sm opacity-70">Contact {ctx.business.name}{ctx.business.phone ? ` on ${ctx.business.phone}` : ""}{ctx.business.email ? ` or ${ctx.business.email}` : ""} to get portal access.</p>
          </>
        )}
      </div>
    );
  }

  const { customer, quotes, invoices, jobs, bookings } = state.data;
  return (
    <div className="site-container py-12">
      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-60">{terms.customer} portal</div>
        <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--color-primary)" }}>Welcome back, {customer.firstName}</h1>
        <p className="mt-2 text-sm opacity-75">Everything {ctx.business.name} has shared with you, in one place. Open a document to view, accept or pay it.</p>
      </header>

      <div className="grid gap-8">
        <Panel title={termPlural(terms, "quote")} icon={FileText} count={quotes.length} empty={`No ${termPlural(terms, "quote").toLowerCase()} yet.`}>
          <table className="w-full">
            <thead><tr><th className={th}>Number</th><th className={th}>Title</th><th className={th}>Status</th><th className={th}>Total</th><th className={th}>Valid until</th><th className={th}></th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className={`${td} font-mono text-xs`}>{q.number}</td>
                  <td className={td}>{q.title}</td>
                  <td className={td}><StatusBadge value={q.status} /></td>
                  <td className={td}>{formatCents(q.totalCents, q.currency, locale)}</td>
                  <td className={td}>{fmtDate(q.validUntil, locale)}</td>
                  <td className={`${td} text-right`}><a href={platformUrl(`/q/${q.publicToken}`)} className="font-medium underline underline-offset-2" style={{ color: "var(--color-accent)" }}>View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Invoices" icon={Receipt} count={invoices.length} empty="No invoices yet.">
          <table className="w-full">
            <thead><tr><th className={th}>Number</th><th className={th}>Status</th><th className={th}>Total</th><th className={th}>Paid</th><th className={th}>Due</th><th className={th}></th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className={`${td} font-mono text-xs`}>{i.number}</td>
                  <td className={td}><StatusBadge value={i.status} /></td>
                  <td className={td}>{formatCents(i.totalCents, i.currency, locale)}</td>
                  <td className={td}>{formatCents(i.paidCents, i.currency, locale)}</td>
                  <td className={td}>{fmtDate(i.dueAt, locale)}</td>
                  <td className={`${td} text-right`}><a href={platformUrl(`/i/${i.publicToken}`)} className="font-medium underline underline-offset-2" style={{ color: "var(--color-accent)" }}>View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={termPlural(terms, "job")} icon={Wrench} count={jobs.length} empty={`No ${termPlural(terms, "job").toLowerCase()} yet.`}>
          <table className="w-full">
            <thead><tr><th className={th}>Number</th><th className={th}>Title</th><th className={th}>Stage</th><th className={th}>Scheduled</th><th className={th}>Status</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className={`${td} font-mono text-xs`}>{j.number}</td>
                  <td className={td}>{j.title}</td>
                  <td className={td}><StatusBadge value={j.stageName} color={j.stageColor} /></td>
                  <td className={td}>{j.scheduledStart ? `${fmtDate(j.scheduledStart, locale, true)}${j.scheduledEnd ? ` – ${fmtDate(j.scheduledEnd, locale, true)}` : ""}` : "—"}</td>
                  <td className={td}>{j.completedAt ? `Completed ${fmtDate(j.completedAt, locale)}` : <StatusBadge value={j.status} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Bookings" icon={CalendarDays} count={bookings.length} empty="No bookings yet.">
          <table className="w-full">
            <thead><tr><th className={th}>When</th><th className={th}>{terms.service}</th><th className={th}>Status</th><th className={th}>Notes</th></tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className={td}>{fmtDate(b.startsAt, locale, true)}{b.endsAt ? ` – ${fmtDate(b.endsAt, locale, true)}` : ""}</td>
                  <td className={td}>{b.serviceName ?? "—"}</td>
                  <td className={td}><StatusBadge value={b.status} /></td>
                  <td className={`${td} opacity-75`}>{b.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
