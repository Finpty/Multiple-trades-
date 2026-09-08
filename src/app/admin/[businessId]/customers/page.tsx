import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { addressLine, customerAddress, customerName, customerTags, listCustomers } from "@/lib/crm/customers";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, TBody, Td, Th, THead, cn, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ q?: string; status?: string; tag?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "crm.view");
  const sp = await searchParams;
  const status = sp.status === "ARCHIVED" || sp.status === "all" ? sp.status : "ACTIVE";
  const rows = await listCustomers(ctx.db, businessId, { q: sp.q, status, tag: sp.tag });
  const allTags = [...new Set(rows.flatMap((c) => customerTags(c)))].sort();
  const base = `/admin/${businessId}/customers`;
  const { currency, locale } = ctx.business;
  void currency; void locale;
  return (
    <div>
      <PageHeader title="Customers" description="Everyone you have quoted, booked or invoiced. Leads become customers when you convert them." actions={ctx.can("crm.manage") && <ButtonLink href={`${base}/new`}>New customer</ButtonLink>} />
      <Card className="mb-4"><form className="flex flex-wrap items-end gap-3 p-3" action={base}>
        <div className="min-w-56 flex-1"><Input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, email, phone, company" aria-label="Search customers" /></div>
        <Select name="status" defaultValue={status} className="w-auto" aria-label="Status"><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="all">All</option></Select>
        {allTags.length > 0 && <Select name="tag" defaultValue={sp.tag ?? ""} className="w-auto" aria-label="Tag"><option value="">Any tag</option>{allTags.map((t) => <option key={t} value={t}>{t}</option>)}</Select>}
        <button type="submit" className="rounded-md border border-neutral-300 px-3 py-2 text-sm">Filter</button>
        {(sp.q || sp.tag || status !== "ACTIVE") && <Link href={base} className="text-sm text-neutral-500 underline">Clear</Link>}
      </form></Card>
      {rows.length === 0 ? <EmptyState title="No customers found" description={sp.q ? "Try a different search." : "Customers appear here when leads are converted or you add them."} action={ctx.can("crm.manage") && <ButtonLink href={`${base}/new`}>New customer</ButtonLink>} /> : (
        <Card><Table>
          <THead><tr><Th>Customer</Th><Th>Contact</Th><Th>Address</Th><Th>Activity</Th><Th>Tags</Th><Th>Added</Th></tr></THead>
          <TBody>
            {rows.map((c) => (
              <tr key={c.id} className={cn(c.status === "ARCHIVED" && "opacity-60")}>
                <Td><Link href={`${base}/${c.id}`} className="font-medium hover:underline">{customerName(c)}</Link>{c.company && <span className="block text-xs text-neutral-500">{c.company}</span>}{c.status === "ARCHIVED" && <Badge tone="neutral" className="ml-2">archived</Badge>}</Td>
                <Td><div className="text-sm">{c.email ?? ""}</div><div className="text-xs text-neutral-500">{c.phone ?? ""}</div></Td>
                <Td className="max-w-56 truncate text-xs text-neutral-600">{addressLine(customerAddress(c))}</Td>
                <Td className="text-xs text-neutral-600">{[c._count.leads ? `${c._count.leads} lead${c._count.leads === 1 ? "" : "s"}` : null, c._count.quotes ? `${c._count.quotes} quote${c._count.quotes === 1 ? "" : "s"}` : null, c._count.jobs ? `${c._count.jobs} job${c._count.jobs === 1 ? "" : "s"}` : null, c._count.invoices ? `${c._count.invoices} invoice${c._count.invoices === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "—"}</Td>
                <Td><div className="flex flex-wrap gap-1">{customerTags(c).map((t) => <Link key={t} href={`${base}?tag=${encodeURIComponent(t)}`} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs hover:bg-neutral-200">{t}</Link>)}</div></Td>
                <Td className="text-xs text-neutral-500">{formatDate(c.createdAt)}</Td>
              </tr>
            ))}
          </TBody>
        </Table></Card>
      )}
      <p className="mt-2 text-xs text-neutral-500">{rows.length} customer{rows.length === 1 ? "" : "s"}{rows.length === 200 ? " (showing the first 200 — refine your search)" : ""}</p>
    </div>
  );
}
