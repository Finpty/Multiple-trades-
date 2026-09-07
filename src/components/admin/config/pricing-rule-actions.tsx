"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

type Fn = (businessId: string, ruleId: string) => Promise<ActionResult>;
export function RuleRowActions({ businessId, ruleId, isActive, toggle, archive, duplicate }: { businessId: string; ruleId: string; isActive: boolean; toggle: (b: string, r: string, on: boolean) => Promise<ActionResult>; archive: Fn; duplicate: Fn }) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => toggle(businessId, ruleId, !isActive))}>{isActive ? "Disable" : "Enable"}</Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => duplicate(businessId, ruleId))}>Duplicate</Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (window.confirm("Archive this rule?")) run(() => archive(businessId, ruleId)); }}>Archive</Button>
    </div>
  );
}
