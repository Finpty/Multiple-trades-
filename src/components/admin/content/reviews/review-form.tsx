"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { saveReviewAction } from "@/app/admin/[businessId]/reviews/actions";

export interface ReviewFormValues { authorName: string; rating: number; title: string; body: string; source: string; reviewedAt: string; projectId: string | null; serviceId: string | null; isPublished: boolean; isFeatured: boolean }

export function ReviewForm({ businessId, reviewId, values, projects, services, sources }: { businessId: string; reviewId: string | null; values: ReviewFormValues; projects: Array<{ id: string; title: string }>; services: Array<{ id: string; name: string }>; sources: readonly string[] }) {
  const router = useRouter();
  const [rating, setRating] = React.useState(values.rating);
  const onSuccess = React.useCallback((d: { id: string; created: boolean }) => { if (d.created) router.push(`/admin/${businessId}/reviews/${d.id}`); }, [router, businessId]);
  return (
    <ActionForm action={saveReviewAction} onSuccess={onSuccess}>
      {({ fieldErrors }) => (
        <Card className="max-w-3xl"><CardBody className="space-y-4">
          <input type="hidden" name="businessId" value={businessId} />
          {reviewId && <input type="hidden" name="reviewId" value={reviewId} />}
          <input type="hidden" name="rating" value={rating} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer name" required error={fieldErrors.authorName}><Input name="authorName" defaultValue={values.authorName} required /></Field>
            <Field label="Rating" required error={fieldErrors.rating}>
              <div className="flex gap-1 pt-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className={n <= rating ? "text-2xl text-amber-500" : "text-2xl text-neutral-300"}>★</button>)}</div>
            </Field>
          </div>
          <Field label="Headline" hint="Optional short summary" error={fieldErrors.title}><Input name="title" defaultValue={values.title} /></Field>
          <Field label="Review" required error={fieldErrors.body}><Textarea name="body" rows={5} defaultValue={values.body} required /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Source"><Select name="source" defaultValue={values.source || "manual"}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
            <Field label="Date" error={fieldErrors.reviewedAt}><Input type="date" name="reviewedAt" defaultValue={values.reviewedAt} /></Field>
            <div />
            <Field label="Related project"><Select name="projectId" defaultValue={values.projectId ?? ""}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
            <Field label="Related service"><Select name="serviceId" defaultValue={values.serviceId ?? ""}><option value="">None</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Checkbox name="isPublished" defaultChecked={values.isPublished} label="Show on the website" />
            <Checkbox name="isFeatured" defaultChecked={values.isFeatured} label="Featured (shown first)" />
          </div>
          <div><SubmitButton>{reviewId ? "Save changes" : "Add review"}</SubmitButton></div>
        </CardBody></Card>
      )}
    </ActionForm>
  );
}
