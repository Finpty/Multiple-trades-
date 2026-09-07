import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { LEAD_STATUSES, formatMoney, leadSources, leadStatusLabel, listLeads, type LeadListFilter } from "@/lib/crm/leads";
import { listBusinessMembers } from "@/lib/crm/members";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, TBody, Td, Th, THead, cn, formatDate, statusTone } from "@/components/ui";
import { LeadBoard, type BoardLead } from "@/components/admin/operations/crm/lead-board";
import { LeadStatusSelect } from "@/components/admin/operations/crm/lead-status-select";

export const dynamic = "force-dynamic";

type SP = { view?: string; q?: string; status?: string; assigned?: string; source?: string; serviceId?: string; from?: string; to?: string };

export default async function LeadsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<SP> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "crm.view");
  const sp = await searchParams;
  const board = sp.view === "board";
  const filter: LeadListFilter = { q: sp.q, status: board ? "all" : sp.status, assigned: sp.assigned, source: sp.source, serviceId: isUuid(sp.serviceId) ? sp.serviceId : undefined, from: sp.from, to: sp.to };
  const [leads, members, services, sources] = await Promise.all([
    listLeads(ctx.db, businessId, filter),
    listBusinessMembers(businessId),
    ctx.db.service.findMany({ where: { businessId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    leadSources(ctx.db, businessId),
  ]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const canManage = ctx.can("crm.manage");
  const base = `/admin/${businessId}/leads`;
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "view") as Array<[string, string]>);
  const hasFilters = Array.from(query.keys()).length > 0;
  const { currency, locale } = ctx.business;

  const boardLeads: BoardLead[] = leads
    .filter((l) => l.status !== "ARCHIVED")
    .map((l) => ({ id: l.id, name: l.name, status: l.status, service: l.service?.name ?? null, value: l.valueCents !== null ? formatMoney(l.valueCents, currency, locale) : null, assignee: l.assignedToUserId ? (memberName.get(l.assignedToUserId) ?? "Member") : null, createdAt: formatDate(l.createdAt), source: l.source }));

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Every enquiry from your website, phone or referrals. Move leads through the pipeline and convert them to customers and quotes."
        actions={
          <div className="flex gap-2">
            <ButtonLink href={board ? `${base}?${query}` : `${base}?${new URLSearchParams({ ...Object.fromEntries(query), view: "board" })}`} variant="secondary">
              {board ? "List view" : "Board view"}
            </ButtonLink>
            {canManage && <ButtonLink href={`${base}/new`}>New lead</ButtonLink>}
          </div>
        }
      />
      <form method="get" action={base} className="mb-4 grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-7">
        {board && <input type="hidden" name="view" value="board" />}
        <Input name="q" placeholder="Search name, email, phone" defaultValue={sp.q ?? ""} className="lg:col-span-2" />
        {!board && (
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Open leads</option>
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
        <Select name="assigned" defaultValue={sp.assigned ?? ""}>
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Select name="source" defaultValue={sp.source ?? ""}>
          <option value="">Any source</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select name="serviceId" defaultValue={sp.serviceId ?? ""}>
          <option value="">Any service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="flex gap-1">
          <Input name="from" type="date" defaultValue={sp.from ?? ""} title="From date" />
          <Input name="to" type="date" defaultValue={sp.to ?? ""} title="To date" />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-7">
          <Button type="submit" variant="secondary" size="sm">
            Apply filters
          </Button>
          {hasFilters && (
            <Link href={board ? `${base}?view=board` : base} className="self-center text-sm text-neutral-500 hover:underline">
              Clear
            </Link>
          )}
          <span className="ml-auto self-center text-xs text-neutral-500">{leads.length} lead{leads.length === 1 ? "" : "s"}</span>
        </div>
      </form>

      {leads.length === 0 ? (
        <EmptyState title={hasFilters ? "No leads match these filters" : "No leads yet"} description={hasFilters ? "Try clearing the filters." : "Leads arrive automatically from your website forms. You can also add phone or referral enquiries by hand."} action={canManage && !hasFilters ? <ButtonLink href={`${base}/new`}>Add a lead</ButtonLink> : undefined} />
      ) : board ? (
        <LeadBoard businessId={businessId} leads={boardLeads} canManage={canManage} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <Th>Lead</Th>
                  <Th>Contact</Th>
                  <Th>Service</Th>
                  <Th>Source</Th>
                  <Th>Value</Th>
                  <Th>Assigned</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </THead>
              <TBody>
                {leads.map((l) => (
                  <tr key={l.id} className={cn("hover:bg-neutral-50", l.status === "ARCHIVED" && "opacity-60")}>
                    <Td>
                      <Link href={`${base}/${l.id}`} className="font-medium text-neutral-900 hover:underline">
                        {l.name}
                      </Link>
                      {l.customer && <div className="text-xs text-neutral-500">Customer: {[l.customer.firstName, l.customer.lastName].filter(Boolean).join(" ")}</div>}
                    </Td>
                    <Td className="text-xs text-neutral-600">
                      <div>{l.email ?? ""}</div>
                      <div>{l.phone ?? ""}</div>
                    </Td>
                    <Td>{l.service?.name ?? <span className="text-neutral-400">—</span>}</Td>
                    <Td className="text-xs">{l.source ?? "—"}</Td>
                    <Td>{formatMoney(l.valueCents, currency, locale)}</Td>
                    <Td className="text-xs">{l.assignedToUserId ? (memberName.get(l.assignedToUserId) ?? "Member") : <span className="text-neutral-400">Unassigned</span>}</Td>
                    <Td>{canManage && l.status !== "ARCHIVED" ? <LeadStatusSelect businessId={businessId} leadId={l.id} status={l.status} /> : <Badge tone={statusTone(l.status)}>{leadStatusLabel(l.status)}</Badge>}</Td>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDate(l.createdAt)}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
