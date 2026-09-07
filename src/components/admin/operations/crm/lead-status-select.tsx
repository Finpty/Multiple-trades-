"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LEAD_STATUSES } from "@/lib/crm/leads";
import { cn } from "@/components/ui";
import { moveLead } from "@/app/admin/[businessId]/leads/actions";

/** Inline status dropdown used on the leads list; saves immediately. */
export function LeadStatusSelect({ businessId, leadId, status, disabled }: { businessId: string; leadId: string; status: string; disabled?: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setValue(status), [status]);
  return (
    <div>
      <select
        value={value}
        disabled={disabled || pending}
        title={error ?? undefined}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          startTransition(async () => {
            const res = await moveLead(businessId, leadId, next);
            if (!res.ok) {
              setValue(prev);
              setError(res.error);
            } else {
              setError(null);
              router.refresh();
            }
          });
        }}
        className={cn("rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs", error && "border-red-500")}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
