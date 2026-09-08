import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listFieldDefinitions, loadFieldValues } from "@/lib/custom-fields";
import { addressLine, customerAddress, customerName, customerTags } from "@/lib/crm/customers";
import { formatMoney, leadStatusLabel } from "@/lib/crm/leads";
import { listBusinessMembers } from "@/lib/crm/members";
import { buildTimeline } from "@/lib/crm/timeline";
import { Badge, ButtonLink, Card, CardBody, CardHeader, Description, Field, PageHeader, Select, Stat, formatDate, formatDateTime, statusTone } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomerForm } from "@/components/admin/operations/crm/customer-form";
import { TimelineComposer } from "@/components/admin/operations/crm/timeline-composer";
import { TimelineView } from "@/components/admin/operations/crm/timeline-view";
import { mergeCustomers, setCustomerStatus, updateCustomer } from "../actions";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ businessId: string; customerId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { businessId, customerId } = await params;
  const { edit } = await searchParams;
  if (!isUuid(businessId) || !isUuid(customerId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "crm.view");
  const c = await ctx.db.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      leads: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, name: true, status: true, createdAt: true, valueCents: true } },
      quotes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, title: true, status: true, totalCents: true, createdAt: true } },
      jobs: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, title: true, status: true, stageKey: true, valueCents: true, createdAt: true } },
      invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, status: true, totalCents: true, paidCents: true, dueAt: true } },
      bookings: { orderBy: { startsAt: "desc" }, take: 10, select: { id: true, startsAt: true, status: true, service: { select: { name: true } } } },
    },
  });
  if (!c) notFound();
  const canManage = ctx.can("crm.manage");
  const [members, definitions, customValues, timeline, others, sources] = await Promise.all([
    listBusinessMembers(businessId),
    listFieldDefinitions(ctx.db, businessId, "CUSTOMER"),
    loadFieldValues(ctx.db, customerId),
    buildTimeline(ctx.db, businessId, { customerId }),
    canManage ? ctx.db.customer.findMany({ where: { businessId, deletedAt: null, NOT: { id: customerId } }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: "asc" }, take: 300 }) : Promise.resolve([]),
    ctx.db.customer.findMany({ where: { businessId, source: { not: null } }, select: { source: true }, distinct: ["source"] }),
  ]);
  const base = `/admin/${businessId}`;
  const { currency, locale } = ctx.business;
  const name = customerName(c);
  const lifetime = c.invoices.filter((i) => i.status !== "VOID").reduce((s, i) => s + i.paidCents, 0);
  const outstanding = c.invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + Math.max(0, i.totalCents - i.paidCents), 0);

  if (edit === "1" && canManage) {
    return (
      <div>
        <PageHeader title={`Edit ${name}`} breadcrumbs={[{ label: "Customers", href: `${base}/customers` }, { label: name, href: `${base}/customers/${c.id}` }, { label: "Edit" }]} />
        <CustomerForm businessId={businessId} action={updateCustomer.bind(null, businessId, c.id)} values={{ firstName: c.firstName, lastName: c.lastName ?? "", email: c.email ?? "", phone: c.phone ?? "", company: c.company ?? "", address: customerAddress(c), notes: c.notes ?? "", tags: customerTags(c), source: c.source ?? "", status: c.status }} definitions={definitions} customValues={customValues} cancelHref={`${base}/customers/${c.id}`} submitLabel="Save changes" sources={sources.map((s) => s.source!).filter(Boolean)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={name}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={c.status === "ARCHIVED" ? "neutral" : "green"}>{c.status}</Badge>{customerTags(c).map((t) => <Badge key={t}>{t}</Badge>)}<span className="text-xs text-neutral-500">customer since {formatDate(c.createdAt)}</span></span>}
        breadcrumbs={[{ label: "Customers", href: `${base}/customers` }, { label: name }]}
        actions={canManage && <><ButtonLink variant="secondary" href={`${base}/customers/${c.id}?edit=1`}>Edit</ButtonLink>{ctx.can("quotes.manage") && <ButtonLink href={`${base}/quotes/new?customerId=${c.id}`}>New quote</ButtonLink>}</>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Quotes" value={c.quotes.length} />
        <Stat label="Jobs" value={c.jobs.length} />
        <Stat label="Paid to date" value={formatMoney(lifetime, currency, locale)} />
        <Stat label="Outstanding" value={formatMoney(outstanding, currency, locale)} tone={outstanding > 0 ? "amber" : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card><CardHeader title="Contact" /><CardBody>
            <Description items={[
              { label: "Email", value: c.email ? <a href={`mailto:${c.email}`} className="underline">{c.email}</a> : null },
              { label: "Phone", value: c.phone ? <a href={`tel:${c.phone}`} className="underline">{c.phone}</a> : null },
              { label: "Company", value: c.company },
              { label: "Address", value: addressLine(customerAddress(c)) || null },
              { label: "Source", value: c.source },
              ...definitions.map((d) => ({ label: d.label, value: customValues[d.key] === undefined || customValues[d.key] === "" ? null : String(customValues[d.key]) })),
            ]} />
            {c.notes && <div className="mt-4 rounded-md bg-neutral-50 p-3 text-sm whitespace-pre-wrap">{c.notes}</div>}
          </CardBody></Card>

          <Card><CardHeader title="Quotes" actions={ctx.can("quotes.manage") && <Link href={`${base}/quotes/new?customerId=${c.id}`} className="text-sm underline">New quote</Link>} /><CardBody>
            {c.quotes.length === 0 ? <p className="text-sm text-neutral-500">No quotes yet.</p> : <ul className="divide-y text-sm">{c.quotes.map((q) => <li key={q.id} className="flex items-center justify-between py-2"><span><Link href={`${base}/quotes/${q.id}`} className="font-medium hover:underline">{q.number}</Link> <span className="text-neutral-600">{q.title}</span></span><span className="flex items-center gap-2"><Badge tone={statusTone(q.status)}>{q.status}</Badge>{formatMoney(q.totalCents, currency, locale)}</span></li>)}</ul>}
          </CardBody></Card>
          <Card><CardHeader title="Jobs" /><CardBody>
            {c.jobs.length === 0 ? <p className="text-sm text-neutral-500">No jobs yet.</p> : <ul className="divide-y text-sm">{c.jobs.map((j) => <li key={j.id} className="flex items-center justify-between py-2"><span><Link href={`${base}/jobs/${j.id}`} className="font-medium hover:underline">{j.number}</Link> <span className="text-neutral-600">{j.title}</span></span><span className="flex items-center gap-2"><Badge tone={statusTone(j.status)}>{j.stageKey}</Badge>{j.valueCents != null && formatMoney(j.valueCents, currency, locale)}</span></li>)}</ul>}
          </CardBody></Card>
          <Card><CardHeader title="Invoices" /><CardBody>
            {c.invoices.length === 0 ? <p className="text-sm text-neutral-500">No invoices yet.</p> : <ul className="divide-y text-sm">{c.invoices.map((i) => <li key={i.id} className="flex items-center justify-between py-2"><span><Link href={`${base}/invoices/${i.id}`} className="font-medium hover:underline">{i.number}</Link>{i.dueAt && <span className="ml-2 text-xs text-neutral-500">due {formatDate(i.dueAt)}</span>}</span><span className="flex items-center gap-2"><Badge tone={statusTone(i.status)}>{i.status}</Badge>{formatMoney(i.totalCents, currency, locale)}</span></li>)}</ul>}
          </CardBody></Card>
          {(c.leads.length > 0 || c.bookings.length > 0) && (
            <Card><CardHeader title="Leads & bookings" /><CardBody className="space-y-3">
              {c.leads.length > 0 && <ul className="divide-y text-sm">{c.leads.map((l) => <li key={l.id} className="flex items-center justify-between py-2"><Link href={`${base}/leads/${l.id}`} className="hover:underline">{l.name} <span className="text-xs text-neutral-500">{formatDate(l.createdAt)}</span></Link><Badge tone={statusTone(l.status)}>{leadStatusLabel(l.status)}</Badge></li>)}</ul>}
              {c.bookings.length > 0 && <ul className="divide-y text-sm">{c.bookings.map((b) => <li key={b.id} className="flex items-center justify-between py-2"><Link href={`${base}/bookings?focus=${b.id}`} className="hover:underline">{formatDateTime(b.startsAt)} {b.service?.name ? `· ${b.service.name}` : ""}</Link><Badge tone={statusTone(b.status)}>{b.status}</Badge></li>)}</ul>}
            </CardBody></Card>
          )}
          <Card><CardHeader title="Timeline" description="Notes, emails, tasks and changes for this customer." /><CardBody className="space-y-6">
            {canManage && <TimelineComposer businessId={businessId} customerId={c.id} defaultEmail={c.email} members={members} />}
            <TimelineView businessId={businessId} canManage={canManage} entries={timeline.map((e) => ({ ...e, at: e.at.toISOString(), task: e.task ? { ...e.task, dueAt: e.task.dueAt?.toISOString() ?? null } : undefined }))} />
          </CardBody></Card>
        </div>
        <div className="space-y-4">
          {canManage && (
            <Card><CardHeader title="Actions" /><CardBody className="space-y-4">
              <ActionForm action={setCustomerStatus.bind(null, businessId)}>
                <input type="hidden" name="customerId" value={c.id} />
                <input type="hidden" name="status" value={c.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED"} />
                {c.status === "ARCHIVED" ? <SubmitButton variant="secondary">Restore customer</SubmitButton> : <ConfirmButton variant="secondary" confirm="Archive this customer? Their history is kept and they can be restored.">Archive customer</ConfirmButton>}
              </ActionForm>
              {others.length > 0 && (
                <ActionForm action={mergeCustomers.bind(null, businessId)} className="space-y-2 border-t pt-4">
                  <input type="hidden" name="customerA" value={c.id} />
                  <input type="hidden" name="keep" value="a" />
                  <Field label="Merge a duplicate into this customer" hint="Leads, quotes, jobs, invoices and messages move here; the duplicate is removed.">
                    <Select name="customerB" defaultValue=""><option value="">Choose a duplicate…</option>{others.map((o) => <option key={o.id} value={o.id}>{customerName(o)}{o.email ? ` · ${o.email}` : ""}</option>)}</Select>
                  </Field>
                  <ConfirmButton variant="secondary" size="sm" confirm="Merge the selected customer into this one? This cannot be undone.">Merge</ConfirmButton>
                </ActionForm>
              )}
            </CardBody></Card>
          )}
          <Card><CardHeader title="Record" /><CardBody><Description items={[{ label: "Created", value: formatDateTime(c.createdAt) }, { label: "Updated", value: formatDateTime(c.updatedAt) }, { label: "Portal access", value: c.portalUserId ? "Linked" : "Not linked" }]} /></CardBody></Card>
        </div>
      </div>
    </div>
  );
}
