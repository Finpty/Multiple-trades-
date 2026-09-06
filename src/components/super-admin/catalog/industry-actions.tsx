"use client";

import * as React from "react";
import { Button } from "@/components/ui";
import { deleteIndustryAction, duplicateIndustryAction, toggleActiveAction } from "@/app/super-admin/industries/actions";

export function IndustryActions({ industryId, isActive, businesses }: { industryId: string; isActive: boolean; businesses: number }) {
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(() => toggleActiveAction(industryId, !isActive))}>{isActive ? "Deactivate" : "Activate"}</Button>
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(() => duplicateIndustryAction(industryId))}>Duplicate</Button>
      <Button variant="danger" size="sm" disabled={pending || businesses > 0} title={businesses > 0 ? "Deactivate instead: businesses use this industry" : undefined} onClick={() => { if (window.confirm("Delete this industry? This cannot be undone.")) start(async () => { const r = await deleteIndustryAction(industryId); if (!r.ok) setError(r.error); }); }}>Delete</Button>
    </div>
  );
}
