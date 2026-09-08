"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export function PublishPageButton({ businessId, pageId, action }: { businessId: string; pageId: string; action: (b: string, p: string, a: "publish") => Promise<ActionResult<{ id?: string }>> }) {
  const [pending, start] = React.useTransition();
  const [text, setText] = React.useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="flex items-center gap-2">
      {text && <span className="text-xs text-neutral-600">{text}</span>}
      <Button disabled={pending} onClick={() => start(async () => { const r = await action(businessId, pageId, "publish"); setText(r.ok ? "Published" : r.error); router.refresh(); })}>{pending ? "Publishing…" : "Publish page"}</Button>
    </span>
  );
}
