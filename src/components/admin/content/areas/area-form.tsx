"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { ServiceAreaType } from "@prisma/client";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, Switch, Textarea, cn } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AREA_TYPES, areaCompleteness, type AreaContent, type AreaSeo } from "@/lib/content/areas";
import { EditorPanel, EditorTabs } from "@/components/admin/content/services/editor-tabs";
import { MarkdownField } from "@/components/admin/content/services/markdown-field";
import { FaqEditor, newFaqKey, type FaqDraft } from "@/components/admin/content/services/faq-editor";
import { CheckboxTree } from "@/components/admin/content/services/checkbox-tree";
import { DragHandle, SortableList } from "@/components/admin/content/services/sortable-list";
import { archiveAreaAction, restoreAreaAction, saveAreaAction } from "@/app/admin/[businessId]/areas/actions";

export interface AreaFormValues {
  name: string;
  slug: string;
  type: ServiceAreaType;
  parentId: string | null;
  postcode: string;
  state: string;
  country: string;
  lat: string;
  lng: string;
  radiusKm: string;
  isPrimary: boolean;
  isEnabled: boolean;
  generatePage: boolean;
  content: AreaContent;
  seo: AreaSeo;
  serviceIds: string[];
}

export interface AreaFormProps {
  businessId: string;
  areaId?: string;
  archived?: boolean;
  values: AreaFormValues;
  parents: Array<{ id: string; name: string; type: ServiceAreaType; depth: number }>;
  services: Array<{ id: string; name: string; depth: number; isEnabled: boolean }>;
  projects: Array<{ id: string; title: string; status: string; completionDate: string | null; archived: boolean }>;
  previewUrl: string | null;
}

const TABS = [
  { key: "basics", label: "Basics" },
  { key: "content", label: "Local content" },
  { key: "seo", label: "SEO" },
  { key: "services", label: "Services offered here" },
  { key: "projects", label: "Projects" },
  { key: "danger", label: "Danger zone" },
];

export function AreaForm(p: AreaFormProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState("basics");
  const [name, setName] = React.useState(p.values.name);
  const [intro, setIntro] = React.useState(p.values.content.intro);
  const [body, setBody] = React.useState(p.values.content.body);
  const [highlights, setHighlights] = React.useState<Array<{ key: string; text: string }>>(p.values.content.highlights.map((text, i) => ({ key: `h-${i}`, text })));
  const [faqs, setFaqs] = React.useState<FaqDraft[]>(p.values.content.faqs.map((f) => ({ key: newFaqKey(), ...f })));
  const [seoTitle, setSeoTitle] = React.useState(p.values.seo.title ?? "");
  const [seoDescription, setSeoDescription] = React.useState(p.values.seo.description ?? "");
  const [serviceIds, setServiceIds] = React.useState<Set<string>>(new Set(p.values.serviceIds));
  const tabs = p.areaId ? TABS : TABS.filter((t) => t.key !== "projects" && t.key !== "danger");

  const completeness = areaCompleteness(
    { intro: intro.trim(), body: body.trim(), highlights: highlights.map((h) => h.text.trim()).filter(Boolean), faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()) },
    { title: seoTitle.trim() || undefined, description: seoDescription.trim() || undefined },
    { services: serviceIds.size, projects: p.projects.filter((x) => !x.archived).length },
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <ActionForm
          action={saveAreaAction}
          onSuccess={(data) => {
            if (data.created) router.push(`/admin/${p.businessId}/areas/${data.id}`);
          }}
        >
          {({ fieldErrors }) => {
            const errorTabs = new Set<string>();
            for (const key of Object.keys(fieldErrors)) {
              if (key.startsWith("content")) errorTabs.add("content");
              else if (key.startsWith("seo")) errorTabs.add("seo");
              else if (key.startsWith("serviceIds")) errorTabs.add("services");
              else errorTabs.add("basics");
            }
            return (
              <>
                <input type="hidden" name="businessId" value={p.businessId} />
                {p.areaId && <input type="hidden" name="areaId" value={p.areaId} />}
                <EditorTabs tabs={tabs} current={tab} onChange={setTab} errorTabs={errorTabs} />
                {p.archived && <Alert tone="warning" className="mb-4">This area is archived and hidden from the website. Restore it from the Danger zone tab.</Alert>}

                <EditorPanel active={tab === "basics"}>
                  <Card>
                    <CardBody className="grid gap-4 sm:grid-cols-2">
                      <Field label="Name" required error={fieldErrors.name} className="sm:col-span-2">
                        <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="e.g. a suburb, city or region" />
                      </Field>
                      <Field label="Type" required error={fieldErrors.type}>
                        <Select name="type" defaultValue={p.values.type}>
                          {AREA_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Parent area" hint="Nest suburbs under a city, cities under a region." error={fieldErrors.parentId}>
                        <Select name="parentId" defaultValue={p.values.parentId ?? ""}>
                          <option value="">— None (top level) —</option>
                          {p.parents.map((o) => (
                            <option key={o.id} value={o.id}>{`${"  ".repeat(o.depth)}${o.name}`}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="URL slug" hint="Leave blank to generate from the name." error={fieldErrors.slug}>
                        <Input name="slug" defaultValue={p.values.slug} maxLength={120} placeholder="auto" />
                      </Field>
                      <Field label="Postcode" error={fieldErrors.postcode}>
                        <Input name="postcode" defaultValue={p.values.postcode} maxLength={16} />
                      </Field>
                      <Field label="State / territory" error={fieldErrors.state}>
                        <Input name="state" defaultValue={p.values.state} maxLength={60} />
                      </Field>
                      <Field label="Country code" hint="Two letters, e.g. AU." error={fieldErrors.country}>
                        <Input name="country" defaultValue={p.values.country} maxLength={2} className="uppercase" />
                      </Field>
                      <Field label="Latitude" hint="Optional, for maps and distance." error={fieldErrors.lat}>
                        <Input name="lat" type="number" step="any" min={-90} max={90} defaultValue={p.values.lat} />
                      </Field>
                      <Field label="Longitude" error={fieldErrors.lng}>
                        <Input name="lng" type="number" step="any" min={-180} max={180} defaultValue={p.values.lng} />
                      </Field>
                      <Field label="Radius (km)" hint="How far around this point you travel." error={fieldErrors.radiusKm}>
                        <Input name="radiusKm" type="number" min={0} max={5000} defaultValue={p.values.radiusKm} />
                      </Field>
                      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                        <Switch name="isEnabled" checked={p.values.isEnabled} label="Enabled" description="Disabled areas are hidden everywhere." />
                        <Switch name="generatePage" checked={p.values.generatePage} label="Generate page" description="Publish a local landing page for this area." />
                        <Switch name="isPrimary" checked={p.values.isPrimary} label="Primary area" description="Highlighted as a main area you serve." />
                      </div>
                    </CardBody>
                  </Card>
                </EditorPanel>

                <EditorPanel active={tab === "content"}>
                  <Card>
                    <CardHeader title="Unique local content" description="Write copy that only makes sense for this area: landmarks, typical homes, common jobs, travel notes. This is what stops the page being flagged as thin." />
                    <CardBody className="space-y-5">
                      <Field label="Short intro" hint="One or two sentences shown at the top of the page." error={fieldErrors["content.intro"]}>
                        <Textarea name="content.intro" value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={600} rows={3} />
                      </Field>
                      <Field label="Body (Markdown)" error={fieldErrors["content.body"]}>
                        <MarkdownField name="content.body" value={body} onChange={setBody} rows={12} placeholder={"## Working in this area\n\nWhat’s typical here, how you get there, what customers usually ask for…"} />
                      </Field>
                      <Field label="Local highlights" hint="Short bullet points, e.g. ‘Same-week availability’, ‘Heritage homes welcome’.">
                        <HighlightsEditor items={highlights} onChange={setHighlights} />
                      </Field>
                      <Field label="Local FAQs" hint="Questions customers from this area ask.">
                        <FaqEditor name="content.faqs" items={faqs} onChange={setFaqs} />
                      </Field>
                    </CardBody>
                  </Card>
                </EditorPanel>

                <EditorPanel active={tab === "seo"}>
                  <Card>
                    <CardBody className="space-y-4">
                      <Field label="Meta title" hint={`${seoTitle.length}/160`} error={fieldErrors["seo.title"]}>
                        <Input name="seo.title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={160} />
                      </Field>
                      <Field label="Meta description" hint={`${seoDescription.length}/400`} error={fieldErrors["seo.description"]}>
                        <Textarea name="seo.description" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={400} rows={3} />
                      </Field>
                      <Switch name="seo.noindex" checked={!!p.values.seo.noindex} label="Hide from search engines (noindex)" description="Thin pages are marked noindex automatically; turn this on to force it even after adding content." />
                    </CardBody>
                  </Card>
                </EditorPanel>

                <EditorPanel active={tab === "services"}>
                  <Card>
                    <CardHeader title="Services offered here" description="Tick the services you provide in this area. If none are ticked, the page lists all enabled services." actions={<Link href={`/admin/${p.businessId}/areas/matrix`} className="text-sm underline-offset-4 hover:underline">Open service matrix</Link>} />
                    <CardBody>
                      <CheckboxTree name="serviceIds" items={p.services.map((s) => ({ id: s.id, label: s.name, depth: s.depth, hint: s.isEnabled ? null : "disabled" }))} selected={serviceIds} onChange={setServiceIds} emptyText="No services yet. Add services first, then link them here." />
                    </CardBody>
                  </Card>
                </EditorPanel>

                {p.areaId && (
                  <EditorPanel active={tab === "projects"}>
                    <Card>
                      <CardHeader title="Projects in this area" description="Projects are linked from the project editor. Linked projects prove local experience and count toward indexing." />
                      <CardBody>
                        {p.projects.length === 0 ? (
                          <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">No projects linked yet. Open a project and choose this area under its location.</p>
                        ) : (
                          <ul className="divide-y divide-neutral-100">
                            {p.projects.map((pr) => (
                              <li key={pr.id} className="flex items-center justify-between gap-3 py-2">
                                <Link href={`/admin/${p.businessId}/projects/${pr.id}`} className="text-sm font-medium text-neutral-900 hover:underline">{pr.title}</Link>
                                <span className="flex items-center gap-2 text-xs text-neutral-500">
                                  {pr.completionDate}
                                  <Badge tone={pr.archived ? "neutral" : pr.status === "PUBLISHED" ? "green" : "amber"}>{pr.archived ? "Archived" : pr.status}</Badge>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardBody>
                    </Card>
                  </EditorPanel>
                )}

                <EditorPanel active={tab !== "danger"}>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Link href={`/admin/${p.businessId}/areas`} className="text-sm text-neutral-600 hover:text-neutral-900">Cancel</Link>
                    <SubmitButton>{p.areaId ? "Save area" : "Create area"}</SubmitButton>
                  </div>
                </EditorPanel>
              </>
            );
          }}
        </ActionForm>

        {p.areaId && (
          <EditorPanel active={tab === "danger"}>
            <Card>
              <CardHeader title={p.archived ? "Restore" : "Archive"} description={p.archived ? "Put this area back on the website and in the service matrix." : "Removes the area from the website and quote forms. Sub-areas move up one level. Nothing is deleted; you can restore later."} />
              <CardBody>
                <ActionForm action={p.archived ? restoreAreaAction : archiveAreaAction}>
                  <input type="hidden" name="businessId" value={p.businessId} />
                  <input type="hidden" name="areaId" value={p.areaId} />
                  {p.archived ? <SubmitButton variant="secondary">Restore area</SubmitButton> : <ConfirmButton variant="danger" confirm={`Archive “${p.values.name}”? It will disappear from the website until restored.`}>Archive area</ConfirmButton>}
                </ActionForm>
              </CardBody>
            </Card>
          </EditorPanel>
        )}
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader title="Content completeness" />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-semibold">{completeness.score}%</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200"><span className={cn("block h-full", completeness.score >= 70 ? "bg-emerald-500" : completeness.score >= 30 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${completeness.score}%` }} /></span>
            </div>
            {completeness.thin ? <Badge tone="amber">Thin – will be noindex</Badge> : <Badge tone="green">Indexable</Badge>}
            <ul className="space-y-1 text-sm">
              {completeness.checks.map((c) => (
                <li key={c.key} className={cn("flex items-start gap-2", c.done ? "text-neutral-800" : "text-neutral-500")}>
                  <span className={cn("mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]", c.done ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500")}>{c.done ? "✓" : "·"}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Alert tone="info" title="Why unique content matters">
          Search engines penalise sites that publish dozens of near-identical “we service X” pages. Areas without their own intro or body copy and without linked projects are automatically published with <code>noindex</code>. Write a few genuine sentences per area to earn a ranking spot.
        </Alert>
        {p.previewUrl && (
          <Button type="button" variant="secondary" className="w-full" onClick={() => window.open(p.previewUrl!, "_blank", "noreferrer")}>Preview page ↗</Button>
        )}
      </aside>
    </div>
  );
}

function HighlightsEditor({ items, onChange }: { items: Array<{ key: string; text: string }>; onChange: (items: Array<{ key: string; text: string }>) => void }) {
  return (
    <div className="space-y-2">
      {items.map((h) => (
        <input key={h.key} type="hidden" name="content.highlights[]" value={h.text} />
      ))}
      <SortableList
        items={items}
        getId={(i) => i.key}
        onReorder={(next) => onChange(next)}
        className="space-y-2"
        renderItem={(item, _i, handle) => (
          <div className="flex items-center gap-2">
            <DragHandle {...handle} />
            <Input value={item.text} maxLength={200} placeholder="Highlight" onChange={(e) => onChange(items.map((x) => (x.key === item.key ? { ...x, text: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="sm" aria-label="Remove" onClick={() => onChange(items.filter((x) => x.key !== item.key))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, { key: `h-${Math.random().toString(36).slice(2, 9)}`, text: "" }])}><Plus className="h-4 w-4" /> Add highlight</Button>
    </div>
  );
}
