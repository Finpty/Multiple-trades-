import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { asArray, asObject } from "@/lib/json";
import { mediaUrlMap } from "@/lib/media/service";
import { displayValue, fieldLabelFor, formFields } from "@/lib/forms/builder";
import { Badge, Card, CardBody, CardHeader, Description, PageHeader, formatDateTime, statusTone } from "@/components/ui";
import { SubmissionActions } from "@/components/admin/operations/forms/submission-actions";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ businessId: string; formId: string; submissionId: string }> }) {
  const { businessId, formId, submissionId } = await params;
  if (!isUuid(businessId) || !isUuid(formId) || !isUuid(submissionId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "forms.manage");
  const sub = await ctx.db.formSubmission.findFirst({ where: { id: submissionId, businessId, formId }, include: { form: true, lead: { select: { id: true, status: true, name: true } } } });
  if (!sub) notFound();
  const fields = formFields(sub.form);
  const data = asObject<Record<string, unknown>>(sub.data);
  const files = asArray<{ fieldKey: string; mediaId: string }>(sub.files).filter((f) => f && typeof f.mediaId === "string");
  const mediaRows = files.length ? await ctx.db.media.findMany({ where: { businessId, id: { in: files.map((f) => f.mediaId) }, deletedAt: null } }) : [];
  const urls = await mediaUrlMap(mediaRows);
  const orderedKeys = [...fields.map((f) => f.key).filter((k) => k in data), ...Object.keys(data).filter((k) => !fields.some((f) => f.key === k))];
  const base = `/admin/${businessId}/forms/${formId}/submissions`;

  return (
    <div>
      <PageHeader
        title={`Submission · ${formatDateTime(sub.createdAt)}`}
        breadcrumbs={[{ label: "Forms", href: `/admin/${businessId}/forms` }, { label: sub.form.name, href: `/admin/${businessId}/forms/${formId}` }, { label: "Submissions", href: base }, { label: "Detail" }]}
        actions={<Badge tone={statusTone(sub.status)}>{sub.status}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Answers" />
            <CardBody>
              {orderedKeys.length === 0 ? (
                <p className="text-sm text-neutral-500">This submission has no answers.</p>
              ) : (
                <dl className="divide-y divide-neutral-100">
                  {orderedKeys.map((key) => {
                    const v = data[key];
                    const isSignature = typeof v === "string" && v.startsWith("data:image/");
                    return (
                      <div key={key} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
                        <dt className="text-sm font-medium text-neutral-600">{fieldLabelFor(fields, key)}</dt>
                        <dd className="text-sm text-neutral-900">{isSignature ? <img src={v} alt="Signature" className="max-h-24 rounded border border-neutral-200 bg-white" /> : <span className="whitespace-pre-wrap">{displayValue(v) || <span className="text-neutral-400">—</span>}</span>}</dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </CardBody>
          </Card>
          {files.length > 0 && (
            <Card>
              <CardHeader title="Uploaded files" description="Private uploads open through short-lived signed links." />
              <CardBody>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {files.map((f, i) => {
                    const m = urls[f.mediaId];
                    const row = mediaRows.find((r) => r.id === f.mediaId);
                    return (
                      <li key={`${f.mediaId}-${i}`} className="rounded-md border border-neutral-200 p-2 text-sm">
                        {m?.kind === "IMAGE" ? <img src={m.thumb} alt={m.alt} className="mb-2 h-32 w-full rounded object-cover" /> : <div className="mb-2 flex h-32 items-center justify-center rounded bg-neutral-100 text-xs text-neutral-500">{row?.mimeType ?? "file"}</div>}
                        <div className="truncate font-medium">{row?.originalName ?? "Removed file"}</div>
                        <div className="text-xs text-neutral-500">{fieldLabelFor(fields, f.fieldKey)}</div>
                        {m && (
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-xs underline">
                            Open
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Actions" />
            <CardBody>
              <SubmissionActions businessId={businessId} submissionId={sub.id} status={sub.status} hasLead={!!sub.lead} canManageCrm={ctx.can("crm.manage")} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <Description
                items={[
                  { label: "Lead", value: sub.lead ? <Link href={`/admin/${businessId}/leads/${sub.lead.id}`} className="underline">{sub.lead.name} ({sub.lead.status})</Link> : "No lead" },
                  { label: "Form", value: <Link href={`/admin/${businessId}/forms/${formId}`} className="underline">{sub.form.name}</Link> },
                  { label: "Page", value: sub.pageUrl ?? "—" },
                  { label: "IP address", value: sub.ip ?? "—" },
                  { label: "Browser", value: <span className="break-all text-xs">{sub.userAgent ?? "—"}</span> },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
