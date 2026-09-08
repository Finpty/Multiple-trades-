"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import type { ActionResult } from "@/lib/actions";
import { EditorPanel, EditorTabs } from "@/components/admin/content/services/editor-tabs";
import { MarkdownField } from "@/components/admin/content/services/markdown-field";
import { MediaGalleryField, type GalleryItem } from "@/components/admin/content/services/media-gallery-field";
import { CheckboxTree } from "@/components/admin/content/services/checkbox-tree";
import { PROJECT_MEDIA_STAGES } from "@/lib/content/project-types";
import { saveProjectAction, testimonialToReviewAction } from "@/app/admin/[businessId]/projects/actions";

export interface ProjectMediaItem extends GalleryItem { stage: string; caption: string }
export interface ProjectFormValues {
  title: string; slug: string; summary: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; isFeatured: boolean; locationText: string; serviceAreaId: string | null; serviceIds: string[];
  featuredMediaId: string | null; videoMediaId: string | null; media: ProjectMediaItem[]; materials: Array<{ name: string; type: string; notes: string }>; projectSize: string; completionDate: string;
  challenges: string; solutions: string; testimonial: string; testimonialAuthor: string; seo: { title?: string; description?: string; noindex?: boolean; socialImageId?: string | null };
}
export interface ProjectEditorProps {
  businessId: string;
  projectId: string | null;
  values: ProjectFormValues;
  previews: { featured: PickedMedia | null; video: PickedMedia | null };
  services: Array<{ id: string; label: string; depth: number }>;
  areas: Array<{ id: string; name: string; hint: string }>;
  materialTypes: string[];
  customFields: { definitions: FieldDefinitionView[]; values: Record<string, unknown> };
  reviewCount: number;
  siteSlug: string;
  terminology: { project: string; service: string };
}

const TABS = [
  { key: "details", label: "Details" },
  { key: "media", label: "Photos & video" },
  { key: "story", label: "Story" },
  { key: "materials", label: "Materials" },
  { key: "links", label: "Services & area" },
  { key: "seo", label: "SEO" },
];

/**
 * Project (portfolio item) editor. One form, tabbed panels (hidden, not
 * unmounted, so every field submits). Media per stage (before/progress/after/
 * video) is kept in state and submitted as `media:json`.
 */
export function ProjectEditor(p: ProjectEditorProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState("details");
  const [v, setV] = React.useState<ProjectFormValues>(p.values);
  const set = <K extends keyof ProjectFormValues>(k: K, val: ProjectFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const [reviewMsg, setReviewMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  const tabs = p.customFields.definitions.length ? [...TABS, { key: "custom", label: "Custom fields" }] : TABS;
  const stageItems = (stage: string) => v.media.filter((m) => m.stage === stage);
  const setStage = (stage: string, items: GalleryItem[]) => setV((s) => {
    const others = s.media.filter((m) => m.stage !== stage);
    const existing = new Map(s.media.filter((m) => m.stage === stage).map((m) => [m.id, m]));
    return { ...s, media: [...others, ...items.map((i) => ({ ...i, stage, caption: existing.get(i.id)?.caption ?? "" }))] };
  });
  const mediaPayload = PROJECT_MEDIA_STAGES.flatMap((st) => stageItems(st.value).map((m, i) => ({ mediaId: m.id, stage: st.value, caption: m.caption, sortOrder: i })));
  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  const onSuccess = React.useCallback((data: { id: string; created: boolean }) => { if (data.created) router.push(`/admin/${p.businessId}/projects/${data.id}`); }, [router, p.businessId]);

  return (
    <ActionForm action={saveProjectAction} onSuccess={onSuccess} refreshOnSuccess>
      {({ fieldErrors }) => {
        const errorTabs = new Set<string>();
        for (const k of Object.keys(fieldErrors)) errorTabs.add(k.startsWith("seo.") ? "seo" : k.startsWith("cf.") ? "custom" : k === "media" ? "media" : k === "materials" ? "materials" : k === "serviceIds" || k === "serviceAreaId" ? "links" : ["challenges", "solutions", "testimonial", "testimonialAuthor", "description"].includes(k) ? "story" : "details");
        return (
          <div className="space-y-4">
            <input type="hidden" name="businessId" value={p.businessId} />
            {p.projectId && <input type="hidden" name="projectId" value={p.projectId} />}
            <input type="hidden" name="media:json" value={JSON.stringify(mediaPayload)} />
            <input type="hidden" name="materials:json" value={JSON.stringify(v.materials.filter((m) => m.name.trim()))} />
            <EditorTabs tabs={tabs} current={tab} onChange={setTab} errorTabs={errorTabs} />

            <EditorPanel active={tab === "details"}>
              <Card><CardBody className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Title" required error={fieldErrors.title}><Input name="title" value={v.title} onChange={(e) => { set("title", e.target.value); if (!p.projectId) set("slug", autoSlug(e.target.value)); }} required /></Field>
                  <Field label="URL slug" hint={`/${p.siteSlug}/projects/${v.slug || "…"}`} error={fieldErrors.slug}><Input name="slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
                </div>
                <Field label="Summary" hint="One or two sentences shown in portfolio cards." error={fieldErrors.summary}><Textarea name="summary" rows={2} value={v.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Location" hint="Suburb or area shown on the card"><Input name="locationText" value={v.locationText} onChange={(e) => set("locationText", e.target.value)} placeholder="Subiaco, WA" /></Field>
                  <Field label="Completed on"><Input type="date" name="completionDate" value={v.completionDate} onChange={(e) => set("completionDate", e.target.value)} /></Field>
                  <Field label={`${p.terminology.project} size`} hint="e.g. 45 m², 3 bathrooms"><Input name="projectSize" value={v.projectSize} onChange={(e) => set("projectSize", e.target.value)} /></Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Status"><Select name="status" value={v.status} onChange={(e) => set("status", e.target.value as ProjectFormValues["status"])}><option value="PUBLISHED">Published (visible on the website)</option><option value="DRAFT">Draft (hidden)</option><option value="ARCHIVED">Archived</option></Select></Field>
                  <div className="pt-6"><Checkbox name="isFeatured" checked={v.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} label="Featured — shown first in portfolio blocks and on the home page" /></div>
                </div>
              </CardBody></Card>
            </EditorPanel>

            <EditorPanel active={tab === "media"}>
              <div className="space-y-4">
                <Card><CardHeader title="Cover image & video" description="The cover is used on cards and as the page header. A video plays on the project page." /><CardBody className="grid gap-6 md:grid-cols-2">
                  <Field label="Cover image"><MediaPicker businessId={p.businessId} name="featuredMediaId" value={v.featuredMediaId} preview={p.previews.featured} onChange={(m) => set("featuredMediaId", m?.id ?? null)} folderKey="projects" /></Field>
                  <Field label="Video"><MediaPicker businessId={p.businessId} name="videoMediaId" kind="VIDEO" value={v.videoMediaId} preview={p.previews.video} onChange={(m) => set("videoMediaId", m?.id ?? null)} folderKey="projects" /></Field>
                </CardBody></Card>
                {PROJECT_MEDIA_STAGES.map((st) => (
                  <Card key={st.value}><CardHeader title={st.label} description={st.hint} /><CardBody>
                    <MediaGalleryField businessId={p.businessId} name={`stage_${st.value}`} kind={st.kind} items={stageItems(st.value)} onChange={(items) => setStage(st.value, items)} />
                    {stageItems(st.value).length > 0 && (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {stageItems(st.value).map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-xs"><img src={m.thumb} alt="" className="h-8 w-8 rounded object-cover" /><Input value={m.caption} placeholder="Caption (optional)" onChange={(e) => setV((s) => ({ ...s, media: s.media.map((x) => (x.id === m.id && x.stage === st.value ? { ...x, caption: e.target.value } : x)) }))} /></label>
                        ))}
                      </div>
                    )}
                  </CardBody></Card>
                ))}
                {fieldErrors.media && <Alert tone="danger">{fieldErrors.media}</Alert>}
              </div>
            </EditorPanel>

            <EditorPanel active={tab === "story"}>
              <div className="space-y-4">
                <Card><CardHeader title="Description" description="The full write-up shown on the project page." /><CardBody><MarkdownField name="description" value={v.description} onChange={(val) => set("description", val)} rows={10} /></CardBody></Card>
                <Card><CardBody className="grid gap-4 md:grid-cols-2">
                  <Field label="Challenges" hint="What made this job tricky?"><Textarea name="challenges" rows={5} value={v.challenges} onChange={(e) => set("challenges", e.target.value)} /></Field>
                  <Field label="Solutions" hint="How you solved it."><Textarea name="solutions" rows={5} value={v.solutions} onChange={(e) => set("solutions", e.target.value)} /></Field>
                </CardBody></Card>
                <Card><CardHeader title="Customer testimonial" description="Quoted on the project page. You can also save it as a review so it appears in review blocks." /><CardBody className="space-y-3">
                  <Field label="Testimonial" error={fieldErrors.testimonial}><Textarea name="testimonial" rows={3} value={v.testimonial} onChange={(e) => set("testimonial", e.target.value)} /></Field>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Customer name" className="flex-1"><Input name="testimonialAuthor" value={v.testimonialAuthor} onChange={(e) => set("testimonialAuthor", e.target.value)} /></Field>
                    {p.projectId && <Button type="button" variant="secondary" disabled={pending || !v.testimonial.trim()} onClick={() => start(async () => { const r = await testimonialToReviewAction(p.businessId, p.projectId!, { testimonial: v.testimonial, author: v.testimonialAuthor }); setReviewMsg(r.ok ? { tone: "success", text: r.message ?? "Saved" } : { tone: "danger", text: r.error }); })}>Save as review</Button>}
                  </div>
                  {reviewMsg && <Alert tone={reviewMsg.tone}>{reviewMsg.text}</Alert>}
                  {p.reviewCount > 0 && <p className="text-xs text-neutral-500">{p.reviewCount} review{p.reviewCount === 1 ? "" : "s"} linked to this {p.terminology.project.toLowerCase()}.</p>}
                </CardBody></Card>
              </div>
            </EditorPanel>

            <EditorPanel active={tab === "materials"}>
              <Card><CardHeader title="Materials used" description="Listed on the project page. Type suggestions come from your industry settings." /><CardBody className="space-y-2">
                {v.materials.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_160px_1fr_auto] items-center gap-2">
                    <Input value={m.name} placeholder="Name (e.g. Carrara marble 600×600)" onChange={(e) => set("materials", v.materials.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Input list="material-types" value={m.type} placeholder="Type" onChange={(e) => set("materials", v.materials.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} />
                    <Input value={m.notes} placeholder="Notes" onChange={(e) => set("materials", v.materials.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => set("materials", v.materials.filter((_, j) => j !== i))}>✕</Button>
                  </div>
                ))}
                <datalist id="material-types">{p.materialTypes.map((t) => <option key={t} value={t} />)}</datalist>
                <Button type="button" variant="secondary" size="sm" onClick={() => set("materials", [...v.materials, { name: "", type: "", notes: "" }])}>+ Add material</Button>
                {fieldErrors.materials && <Alert tone="danger">{fieldErrors.materials}</Alert>}
              </CardBody></Card>
            </EditorPanel>

            <EditorPanel active={tab === "links"}>
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader title={`${p.terminology.service}s`} description="Which services this project showcases. Shown on those service pages." /><CardBody>
                  <CheckboxTree name="serviceIds" items={p.services} selected={new Set(v.serviceIds)} onChange={(next) => set("serviceIds", [...next])} />
                </CardBody></Card>
                <Card><CardHeader title="Service area" description="Links the project to a location page." /><CardBody>
                  <Select name="serviceAreaId" value={v.serviceAreaId ?? ""} onChange={(e) => set("serviceAreaId", e.target.value || null)}><option value="">None</option>{p.areas.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.hint})</option>)}</Select>
                </CardBody></Card>
              </div>
            </EditorPanel>

            <EditorPanel active={tab === "seo"}>
              <Card><CardBody className="space-y-4">
                <Field label="Search title" hint="Defaults to the project title." error={fieldErrors["seo.title"]}><Input name="seo.title" value={v.seo.title ?? ""} onChange={(e) => set("seo", { ...v.seo, title: e.target.value })} /></Field>
                <Field label="Search description" error={fieldErrors["seo.description"]}><Textarea name="seo.description" rows={3} value={v.seo.description ?? ""} onChange={(e) => set("seo", { ...v.seo, description: e.target.value })} /></Field>
                <Checkbox name="seo.noindex" checked={!!v.seo.noindex} onChange={(e) => set("seo", { ...v.seo, noindex: e.target.checked })} label="Hide from search engines" />
              </CardBody></Card>
            </EditorPanel>

            {p.customFields.definitions.length > 0 && (
              <EditorPanel active={tab === "custom"}>
                <Card><CardBody><CustomFieldsForm businessId={p.businessId} definitions={p.customFields.definitions} values={p.customFields.values} errors={fieldErrors} /></CardBody></Card>
              </EditorPanel>
            )}

            <div className="flex items-center gap-3">
              <SubmitButton>{p.projectId ? "Save changes" : `Create ${p.terminology.project.toLowerCase()}`}</SubmitButton>
              {p.projectId && <a href={`/${p.siteSlug}/projects/${v.slug}?__preview=draft`} target="_blank" rel="noreferrer" className="text-sm text-neutral-600 underline-offset-2 hover:underline">Preview on site ↗</a>}
            </div>
          </div>
        );
      }}
    </ActionForm>
  );
}
