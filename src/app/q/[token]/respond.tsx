"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { acceptPublicQuoteAction, declinePublicQuoteAction } from "./actions";

/** Accept (typed signature) / decline controls under the public quote document. */
export function PublicQuoteResponse({ token, status, expired, businessName, businessPhone, businessEmail, totalLabel, depositLabel }: { token: string; status: string; expired: boolean; businessName: string; businessPhone: string | null; businessEmail: string | null; totalLabel: string; depositLabel: string | null }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"accept" | "decline" | null>(null);
  const contact = [businessPhone, businessEmail].filter(Boolean).join(" · ");
  if (status === "ACCEPTED") return <Alert tone="success" title="Thank you — this quote is accepted.">{businessName} will be in touch to confirm the next steps.{depositLabel ? ` A deposit of ${depositLabel} secures your booking.` : ""}{contact ? ` Questions? ${contact}` : ""}</Alert>;
  if (status === "DECLINED") return <Alert tone="neutral" title="This quote was declined.">{contact ? `Changed your mind? Contact ${businessName}: ${contact}` : `Contact ${businessName} if you would like a revised quote.`}</Alert>;
  if (expired) return <Alert tone="warning" title="This quote has expired.">{contact ? `Contact ${businessName} for an updated quote: ${contact}` : `Contact ${businessName} for an updated quote.`}</Alert>;
  if (status === "DRAFT") return <Alert tone="info">This quote is still being prepared.</Alert>;
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      {!mode && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="font-medium">Ready to go ahead?</div><div className="text-sm text-neutral-600">Accept online — no printing or scanning needed. Total {totalLabel}.</div></div>
          <div className="flex gap-2"><Button onClick={() => setMode("accept")} style={{ background: "var(--color-primary)" }}>Accept quote</Button><Button variant="secondary" onClick={() => setMode("decline")}>Decline</Button></div>
        </div>
      )}
      {mode === "accept" && (
        <ActionForm action={acceptPublicQuoteAction.bind(null, token)} onSuccess={() => router.refresh()} className="space-y-4">
          {({ fieldErrors }) => (<>
            <div className="font-medium">Accept quote</div>
            <Field label="Type your full name to sign" required error={fieldErrors.name}><Input name="name" autoComplete="name" placeholder="Jane Citizen" required /></Field>
            <div><Checkbox name="agree" label={`I accept this quote${depositLabel ? ` and the deposit of ${depositLabel}` : ""} and the terms above.`} />{fieldErrors.agree && <p className="mt-1 text-xs text-red-600">{fieldErrors.agree}</p>}</div>
            <div className="flex gap-2"><SubmitButton>Accept and sign</SubmitButton><Button type="button" variant="ghost" onClick={() => setMode(null)}>Back</Button></div>
            <p className="text-xs text-neutral-500">Your typed name, the time and your device details are recorded as your electronic signature.</p>
          </>)}
        </ActionForm>
      )}
      {mode === "decline" && (
        <ActionForm action={declinePublicQuoteAction.bind(null, token)} onSuccess={() => router.refresh()} className="space-y-4">
          <div className="font-medium">Decline quote</div>
          <Field label="Let us know why (optional)"><Textarea name="reason" rows={3} placeholder="Went with someone else, timing, budget…" /></Field>
          <div className="flex gap-2"><SubmitButton variant="secondary">Decline quote</SubmitButton><Button type="button" variant="ghost" onClick={() => setMode(null)}>Back</Button></div>
        </ActionForm>
      )}
    </div>
  );
}
