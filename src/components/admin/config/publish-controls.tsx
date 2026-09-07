"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export function PublishControls({ businessId, status, publish, unpublish, canPublish }: { businessId: string; status: string; publish: (id: string) => Promise<ActionResult>; unpublish: (id: string) => Promise<ActionResult>; canPublish: boolean }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const router = useRouter();
  const run = (fn: (id: string) => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const r = await fn(businessId);
      setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error });
      if (r.ok) router.refresh();
    });
  };
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-2">
        {status === "PUBLISHED" ? (
          <>
            <Button size="lg" disabled={pending || !canPublish} onClick={() => run(publish)}>{pending ? "Publishing…" : "Re-publish everything"}</Button>
            <Button size="lg" variant="secondary" disabled={pending || !canPublish} onClick={() => run(unpublish, "Take the website offline? Visitors will see a not-found page until you publish again.")}>Unpublish</Button>
          </>
        ) : (
          <Button size="lg" disabled={pending || !canPublish} onClick={() => run(publish)}>{pending ? "Publishing…" : "PUBLISH BUSINESS"}</Button>
        )}
      </div>
    </div>
  );
}
