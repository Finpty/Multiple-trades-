"use client";

import Link from "next/link";
import { Button, Field, Select, buttonClass, cn, statusTone } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SubmitButton } from "@/components/ui/form-status";
import { LEAD_STATUSES } from "@/lib/crm/leads";
import { archiveLead, assignLead, convertLeadToCustomer, linkLeadCustomer, setLeadStatus } from "@/app/admin/[businessId]/leads/actions";

/** Status buttons, assignment, customer link/convert, quote shortcut and archive for one lead. */
export function LeadSideActions({ businessId, lead, members, customers, canQuote }: {
  businessId: string;
  lead: { id: string; status: string; assignedToUserId: string | null; customerId: string | null; customerName: string | null; archived: boolean };
  members: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
  canQuote: boolean;
}) {
  const base = `/admin/${businessId}`;
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Status</div>
        <div className="flex flex-wrap gap-1">
          {LEAD_STATUSES.filter((s) => s.value !== "ARCHIVED").map((s) => (
            <ActionForm key={s.value} action={setLeadStatus.bind(null, businessId)} className="inline">
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="status" value={s.value} />
              <button type="submit" disabled={lead.status === s.value || lead.archived} className={cn("rounded-full border px-2.5 py-0.5 text-xs", lead.status === s.value ? `border-transparent ${toneClass(statusTone(s.value))}` : "border-neutral-300 text-neutral-600 hover:bg-neutral-100")}>
                {s.label}
              </button>
            </ActionForm>
          ))}
        </div>
      </div>
      <ActionForm action={assignLead.bind(null, businessId)}>
        <input type="hidden" name="leadId" value={lead.id} />
        <Field label="Assigned to">
          <div className="flex gap-2">
            <Select name="assignedToUserId" defaultValue={lead.assignedToUserId ?? ""}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <SubmitButton variant="secondary" pendingText="…">
              Save
            </SubmitButton>
          </div>
        </Field>
      </ActionForm>
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Customer</div>
        {lead.customerId ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <Link href={`${base}/customers/${lead.customerId}`} className="font-medium underline">
              {lead.customerName}
            </Link>
            <ActionForm action={linkLeadCustomer.bind(null, businessId)} className="inline">
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="customerId" value="" />
              <Button type="submit" variant="ghost" size="sm">
                Unlink
              </Button>
            </ActionForm>
          </div>
        ) : (
          <div className="space-y-2">
            <ActionForm action={convertLeadToCustomer.bind(null, businessId)}>
              <input type="hidden" name="leadId" value={lead.id} />
              <SubmitButton size="sm" pendingText="Converting…">
                Convert to customer
              </SubmitButton>
            </ActionForm>
            {customers.length > 0 && (
              <ActionForm action={linkLeadCustomer.bind(null, businessId)}>
                <input type="hidden" name="leadId" value={lead.id} />
                <div className="flex gap-2">
                  <Select name="customerId" defaultValue="">
                    <option value="">Link existing customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="secondary" size="md" pendingText="…">
                    Link
                  </SubmitButton>
                </div>
              </ActionForm>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
        {canQuote && (
          <Link href={`${base}/quotes/new?leadId=${lead.id}${lead.customerId ? `&customerId=${lead.customerId}` : ""}`} className={buttonClass("primary", "sm")}>
            Create quote
          </Link>
        )}
        <Link href={`${base}/leads/${lead.id}/edit`} className={buttonClass("secondary", "sm")}>
          Edit details
        </Link>
        <ActionForm action={archiveLead.bind(null, businessId)} className="inline" refreshOnSuccess>
          <input type="hidden" name="leadId" value={lead.id} />
          {lead.archived ? (
            <>
              <input type="hidden" name="restore" value="true" />
              <Button type="submit" variant="ghost" size="sm">
                Restore
              </Button>
            </>
          ) : (
            <ConfirmButton confirm="Archive this lead? It will be hidden from the list and board." variant="ghost" size="sm" className="text-red-600">
              Archive
            </ConfirmButton>
          )}
        </ActionForm>
      </div>
    </div>
  );
}

function toneClass(tone: ReturnType<typeof statusTone>): string {
  return { neutral: "bg-neutral-200 text-neutral-800", green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", blue: "bg-sky-100 text-sky-800", purple: "bg-violet-100 text-violet-800" }[tone];
}
