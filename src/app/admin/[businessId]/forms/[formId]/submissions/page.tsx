import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { formFields, submissionSummary } from "@/lib/forms/builder";
import { Badge, Card, EmptyState, PageHeader, Table, TBody, Td, Th, THead, cn, formatDateTime, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = [
  { key: "", label: "All" },
  { key: "NEW", label: "New" },
  { key: "PROCESSED", label: "Processed" },
  { key: "SPAM", label: "Spam" },
];

export default async function SubmissionsPage({ params, searchParams }: { params: Promise<{ businessId: string; formId: string }>; searchParams: Promise<{ status?: string }> }) {
  const { businessId, formId } = await params;
  if (!isUuid(businessId) || !isUuid(formId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "forms.manage");
  const { status } = await searchParams;
  const form = await ctx.db.form.findFirst({ where: { id: formId, businessId } });
  if (!form) notFound();
  const fields = formFields(form);
  const filter = STATUSES.some((s) => s.key === status) ? status : "";
  const rows = await ctx.db.formSubmission.findMany({
    where: { businessId, formId, ...(filter ? { status: filter as "NEW" | "PROCESSED" | "SPAM" } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { lead: { select: { id: true, status: true } } },
  });
  const base = `/admin/${businessId}/forms/${formId}/submissions`;

  return (
    <div>
      <PageHeader title={`${form.name} — submissions`} description="Everything sent through this form. Open a submission to see all answers and uploaded files." breadcrumbs={[{ label: "Forms", href: `/admin/${businessId}/forms` }, { label: form.name, href: `/admin/${businessId}/forms/${formId}` }, { label: "Submissions" }]} />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {STATUSES.map((s) => (
          <Link key={s.key} href={s.key ? `${base}?status=${s.key}` : base} className={cn("rounded-full px-3 py-1 text-sm", s.key === filter ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>
            {s.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-neutral-500">{rows.length} submission{rows.length === 1 ? "" : "s"}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No submissions yet" description="Submissions appear here as soon as someone sends this form from your website. Make sure the form is active and placed on a page." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <Th>Received</Th>
                  <Th>Summary</Th>
                  <Th>Status</Th>
                  <Th>Lead</Th>
                  <Th>Page</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const summary = submissionSummary(r.data, fields);
                  return (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <Td className="whitespace-nowrap">
                        <Link href={`${base}/${r.id}`} className="font-medium text-neutral-900 hover:underline">
                          {formatDateTime(r.createdAt)}
                        </Link>
                      </Td>
                      <Td>
                        <div className="max-w-md truncate">
                          {summary.length === 0 ? <span className="text-neutral-400">(no answers)</span> : summary.map((s) => `${s.label}: ${s.value}`).join(" · ")}
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                      </Td>
                      <Td>
                        {r.lead ? (
                          <Link href={`/admin/${businessId}/leads/${r.lead.id}`} className="text-sm hover:underline">
                            View lead ({r.lead.status})
                          </Link>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </Td>
                      <Td className="max-w-[12rem] truncate text-xs text-neutral-500">{r.pageUrl ?? "—"}</Td>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
