"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Alert, Badge, Button, ButtonLink, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Switch, Textarea, statusTone } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import { slugify } from "@/lib/slug";
import { PRICING_METHODS } from "@/lib/content/services";
import { archiveServiceAction, deleteServiceAction, draftServiceDescriptionAction, restoreServiceAction, saveServiceAction } from "@/app/admin/[businessId]/services/actions";
import { EditorPanel, EditorTabs } from "./editor-tabs";
import { MarkdownField } from "./markdown-field";
import { IconPicker } from "./icon-picker";
import { FaqEditor, newFaqKey, type FaqDraft } from "./faq-editor";
import { CheckboxTree, type CheckboxTreeItem } from "./checkbox-tree";
import { MediaGalleryField, type GalleryItem } from "./media-gallery-field";

export interface ServiceFormValues {
  name: string;
  slug: string;
  parentId: string | null;
  shortDescription: string;
  description: string;
  icon: string;
  isEnabled: boolean;
  isFeatured: boolean;
  status: "DRAFT" | "PUBLISHED";
  pricingMethod: string;
  priceMin: string;
  priceMax: string;
  priceUnit: string;
  ctaLabel: string;
  ctaHref: string;
  featuredMediaId: string | null;
  videoMediaId: string | null;
  gallery: string[];
  faqs: Array<{ question: string; answer: string }>;
  areaIds: string[];
  materialIds: string[];
  seo: { title?: string; description?: string; noindex?: boolean; socialImageId?: string | null };
}

export interface ServiceEditorProps {
  businessId: string;
  serviceId: string | null;
  values: ServiceFormValues;
  archived: boolean;
  parents: Array<{ id: string; name: string; parentId: string | null }>;
  areas: CheckboxTreeItem[];
  materials: Array<{ id: string; name: string; category: string | null }>;
  relatedProjects: Array<{ id: string; title: string; slug: string; status: string }>;
  fieldDefs: FieldDefinitionView[];
  fieldValues: Record<string, unknown>;
  previews: { featured: PickedMedia | null; video: PickedMedia | null; social: PickedMedia | null; gallery: GalleryItem[] };
  aiAvailable: boolean;
  currency: string;
  siteSlug: string;
  references: { projects: number; children: number; leads: number; bookings: number };
}

const TAB_FIELDS: Record<string, string[]> = {
  basics: ["name", "slug", "parentId", "shortDescription", "description", "icon", "status"],
  pricing: ["pricingMethod", "priceMin", "priceMax", "priceUnit", "ctaLabel", "ctaHrefChoice", "ctaHrefCustom"],
  media: ["featuredMediaId", "videoMediaId", "gallery"],
  faqs: ["faqs"],
  areas: ["areaIds"],
  materials: ["materialIds"],
  seo: ["seo.title", "seo.description", "seo.socialImageId"],
};

export function ServiceEditor(p: ServiceEditorProps) {
  const router = useRouter();
  const editing = !!p.serviceId;
  const [tab, setTab] = React.useState("basics");
  const [name, setName] = React.useState(p.values.name);
  const [slug, setSlug] = React.useState(p.values.slug);
  const [slugTouched, setSlugTouched] = React.useState(editing);
  const [shortDescription, setShortDescription] = React.useState(p.values.shortDescription);
  const [description, setDescription] = React.useState(p.values.description);
  const [icon, setIcon] = React.useState(p.values.icon);
  const [pricingMethod, setPricingMethod] = React.useState(p.values.pricingMethod);
  const initialChoice = p.values.ctaHref === "/quote" || p.values.ctaHref === "/contact" || p.values.ctaHref === "" ? p.values.ctaHref || "/quote" : "custom";
  const [ctaChoice, setCtaChoice] = React.useState<string>(initialChoice);
  const [featured, setFeatured] = React.useState<string | null>(p.values.featuredMediaId);
  const [video, setVideo] = React.useState<string | null>(p.values.videoMediaId);
  const [social, setSocial] = React.useState<string | null>(p.values.seo.socialImageId ?? null);
  const [gallery, setGallery] = React.useState<GalleryItem[]>(p.previews.gallery);
  const [faqs, setFaqs] = React.useState<FaqDraft[]>(p.values.faqs.map((f) => ({ key: newFaqKey(), ...f })));
  const [areaIds, setAreaIds] = React.useState<Set<string>>(new Set(p.values.areaIds));
  const [materialIds, setMaterialIds] = React.useState<Set<string>>(new Set(p.values.materialIds));
  const [ai, setAi] = React.useState<{ busy: boolean; message: string | null; tone: "info" | "danger" }>({ busy: false, message: null, tone: "info" });

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const draftWithAI = async () => {
    setAi({ busy: true, message: null, tone: "info" });
    const res = await draftServiceDescriptionAction(p.businessId, { name, shortDescription, existing: description });
    if (res.ok) {
      setDescription(res.data.text);
      setAi({ busy: false, message: res.message ?? "Draft inserted. Review and edit before saving.", tone: "info" });
    } else {
      setAi({ busy: false, message: `${res.error} Write the description manually below.`, tone: "danger" });
    }
  };

  const methodHint = PRICING_METHODS.find((m) => m.value === pricingMethod)?.hint;
  const showMax = pricingMethod !== "QUOTE" && pricingMethod !== "FIXED";
  const showMin = pricingMethod !== "QUOTE";

  const tabs = [
    { key: "basics", label: "Basics" },
    { key: "pricing", label: "Pricing" },
    { key: "media", label: "Media" },
    { key: "faqs", label: "FAQs", badge: faqs.length ? <Badge>{faqs.length}</Badge> : undefined },
    { key: "areas", label: "Service areas", badge: areaIds.size ? <Badge>{areaIds.size}</Badge> : undefined },
    { key: "materials", label: "Materials", badge: materialIds.size ? <Badge>{materialIds.size}</Badge> : undefined },
    ...(editing ? [{ key: "projects", label: "Projects", badge: p.relatedProjects.length ? <Badge>{p.relatedProjects.length}</Badge> : undefined }] : []),
    ...(p.fieldDefs.length ? [{ key: "fields", label: "Custom fields" }] : []),
    { key: "seo", label: "SEO" },
    ...(editing ? [{ key: "danger", label: "Danger zone" }] : []),
  ];

  const materialGroups = React.useMemo(() => {
    const items: CheckboxTreeItem[] = p.materials.map((m) => ({ id: m.id, label: m.name, hint: m.category }));
    return items;
  }, [p.materials]);

  return (
    <div>
      <EditorTabs tabs={tabs} current={tab} onChange={setTab} />
      <ActionForm
        action={saveServiceAction}
        onSuccess={(data) => {
          if (data.created) router.push(`/admin/${p.businessId}/services/${data.id}`);
        }}
      >
        {({ fieldErrors, pending }) => {
          const errorTabs = new Set<string>();
          for (const [tabKey, fields] of Object.entries(TAB_FIELDS)) if (fields.some((f) => fieldErrors[f])) errorTabs.add(tabKey);
          if (Object.keys(fieldErrors).some((k) => k.startsWith("cf."))) errorTabs.add("fields");
          const cfErrors: Record<string, string> = {};
          for (const [k, v] of Object.entries(fieldErrors)) if (k.startsWith("cf.")) cfErrors[k.slice(3)] = v;
          return (
            <>
              <input type="hidden" name="businessId" value={p.businessId} />
              {p.serviceId && <input type="hidden" name="serviceId" value={p.serviceId} />}
              {errorTabs.size > 0 && errorTabs.size !== (errorTabs.has(tab) ? 1 : 0) && (
                <Alert tone="warning" className="mb-4">Some fields on other tabs need attention: {[...errorTabs].map((t) => tabs.find((x) => x.key === t)?.label ?? t).join(", ")}.</Alert>
              )}
              {p.archived && <Alert tone="warning" className="mb-4">This service is archived and hidden from the website. Restore it from the Danger zone tab to edit it live.</Alert>}

              <EditorPanel active={tab === "basics"}>
                <Card>
                  <CardHeader title="Basics" description="The name and descriptions shown on your website." />
                  <CardBody className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" required error={fieldErrors.name} htmlFor="svc-name">
                      <Input id="svc-name" name="name" value={name} onChange={(e) => onNameChange(e.target.value)} required maxLength={160} placeholder="e.g. Bathroom renovation" />
                    </Field>
                    <Field label="URL slug" hint={`Address on your site: /${p.siteSlug}/services/${slug || "…"}`} error={fieldErrors.slug} htmlFor="svc-slug">
                      <Input id="svc-slug" name="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} maxLength={120} />
                    </Field>
                    <Field label="Parent service" hint="Nest this under another service to build a category → sub-service tree." error={fieldErrors.parentId} htmlFor="svc-parent">
                      <Select id="svc-parent" name="parentId" defaultValue={p.values.parentId ?? ""}>
                        <option value="">— Top level —</option>
                        {p.parents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Status" hint="Draft services are only visible in preview." error={fieldErrors.status} htmlFor="svc-status">
                      <Select id="svc-status" name="status" defaultValue={p.values.status}>
                        <option value="PUBLISHED">Published</option>
                        <option value="DRAFT">Draft</option>
                      </Select>
                    </Field>
                    <Field label="Short description" hint="One or two sentences for cards and listings." error={fieldErrors.shortDescription} className="sm:col-span-2" htmlFor="svc-short">
                      <Textarea id="svc-short" name="shortDescription" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className="min-h-[64px]" maxLength={400} />
                    </Field>
                    <Field label="Full description" error={fieldErrors.description} className="sm:col-span-2">
                      <MarkdownField
                        name="description"
                        value={description}
                        onChange={setDescription}
                        placeholder="What's included, how you work, what customers can expect…"
                        extra={p.aiAvailable ? (
                          <Button type="button" variant="secondary" size="sm" onClick={draftWithAI} disabled={ai.busy || !name.trim()} title={!name.trim() ? "Enter a name first" : undefined}>
                            <Sparkles className="h-3.5 w-3.5" /> {ai.busy ? "Drafting…" : "Draft with AI"}
                          </Button>
                        ) : undefined}
                      />
                      {ai.message && <p className={ai.tone === "danger" ? "mt-1 text-xs text-red-600" : "mt-1 text-xs text-emerald-700"}>{ai.message}</p>}
                    </Field>
                    <Field label="Icon" hint="Shown on service cards and menus." error={fieldErrors.icon} className="sm:col-span-2">
                      <IconPicker name="icon" value={icon} onChange={setIcon} />
                    </Field>
                    <Switch name="isEnabled" checked={p.values.isEnabled} label="Enabled" description="Disabled services are hidden from the website and quote forms." />
                    <Switch name="isFeatured" checked={p.values.isFeatured} label="Featured" description="Featured services are highlighted on the home page." />
                  </CardBody>
                </Card>
              </EditorPanel>

              <EditorPanel active={tab === "pricing"}>
                <Card>
                  <CardHeader title="Pricing display" description="How the price is presented to visitors. Detailed rates for quotes live under Pricing." />
                  <CardBody className="grid gap-4 sm:grid-cols-2">
                    <Field label="Pricing method" hint={methodHint} error={fieldErrors.pricingMethod} htmlFor="svc-method">
                      <Select id="svc-method" name="pricingMethod" value={pricingMethod} onChange={(e) => setPricingMethod(e.target.value)}>
                        {PRICING_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Unit label" hint="Optional, e.g. m², hour, unit." error={fieldErrors.priceUnit} htmlFor="svc-unit">
                      <Input id="svc-unit" name="priceUnit" defaultValue={p.values.priceUnit} maxLength={40} disabled={pricingMethod === "QUOTE" || pricingMethod === "FIXED" || pricingMethod === "RANGE"} />
                    </Field>
                    {showMin && (
                      <Field label={pricingMethod === "FIXED" ? `Price (${p.currency})` : `Minimum / from (${p.currency})`} error={fieldErrors.priceMin} htmlFor="svc-min">
                        <Input id="svc-min" name="priceMin" type="number" min={0} step="0.01" defaultValue={p.values.priceMin} placeholder="0.00" />
                      </Field>
                    )}
                    {showMax && (
                      <Field label={`Maximum / to (${p.currency})`} error={fieldErrors.priceMax} htmlFor="svc-max">
                        <Input id="svc-max" name="priceMax" type="number" min={0} step="0.01" defaultValue={p.values.priceMax} placeholder="0.00" />
                      </Field>
                    )}
                    <Field label="Call-to-action label" hint="Button text on the service page." error={fieldErrors.ctaLabel} htmlFor="svc-cta">
                      <Input id="svc-cta" name="ctaLabel" defaultValue={p.values.ctaLabel} placeholder="Request a quote" maxLength={80} />
                    </Field>
                    <Field label="Call-to-action link" error={fieldErrors.ctaHrefChoice ?? fieldErrors.ctaHrefCustom} htmlFor="svc-href">
                      <div className="space-y-2">
                        <Select id="svc-href" name="ctaHrefChoice" value={ctaChoice} onChange={(e) => setCtaChoice(e.target.value)}>
                          <option value="/quote">Quote form (/quote)</option>
                          <option value="/contact">Contact page (/contact)</option>
                          <option value="custom">Custom link…</option>
                        </Select>
                        {ctaChoice === "custom" && <Input name="ctaHrefCustom" defaultValue={initialChoice === "custom" ? p.values.ctaHref : ""} placeholder="/book or https://…" maxLength={500} />}
                      </div>
                    </Field>
                  </CardBody>
                </Card>
              </EditorPanel>

              <EditorPanel active={tab === "media"}>
                <Card>
                  <CardHeader title="Media" description="Images and video shown on the service page." />
                  <CardBody className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Featured image" error={fieldErrors.featuredMediaId}>
                        <MediaPicker businessId={p.businessId} value={featured} onChange={(m) => setFeatured(m?.id ?? null)} name="featuredMediaId" preview={p.previews.featured} kind="IMAGE" folderKey="services" />
                      </Field>
                      <Field label="Video" hint="Optional walkthrough or explainer." error={fieldErrors.videoMediaId}>
                        <MediaPicker businessId={p.businessId} value={video} onChange={(m) => setVideo(m?.id ?? null)} name="videoMediaId" preview={p.previews.video} kind="VIDEO" label="Choose video" folderKey="services" />
                      </Field>
                    </div>
                    <Field label="Gallery" hint="Drag to reorder. The first image leads the gallery." error={fieldErrors.gallery}>
                      <MediaGalleryField businessId={p.businessId} name="gallery" items={gallery} onChange={setGallery} />
                    </Field>
                  </CardBody>
                </Card>
              </EditorPanel>

              <EditorPanel active={tab === "faqs"}>
                <Card>
                  <CardHeader title="Frequently asked questions" description="Shown on the service page with structured data for search engines." />
                  <CardBody>
                    {fieldErrors.faqs && <p className="mb-2 text-xs text-red-600">{fieldErrors.faqs}</p>}
                    <FaqEditor name="faqs" items={faqs} onChange={setFaqs} />
                  </CardBody>
                </Card>
              </EditorPanel>

              <EditorPanel active={tab === "areas"}>
                <Card>
                  <CardHeader title="Service areas" description="Where this service is offered. Area pages list the services available there." actions={<ButtonLink href={`/admin/${p.businessId}/areas`} variant="ghost" size="sm">Manage areas</ButtonLink>} />
                  <CardBody>
                    <CheckboxTree name="areaIds" items={p.areas} selected={areaIds} onChange={setAreaIds} emptyText="No service areas yet. Add suburbs, cities or regions under Service Areas first." />
                  </CardBody>
                </Card>
              </EditorPanel>

              <EditorPanel active={tab === "materials"}>
                <Card>
                  <CardHeader title="Related materials" description="Materials used or supplied for this service." actions={<ButtonLink href={`/admin/${p.businessId}/materials`} variant="ghost" size="sm">Manage materials</ButtonLink>} />
                  <CardBody>
                    <CheckboxTree name="materialIds" items={materialGroups} selected={materialIds} onChange={setMaterialIds} emptyText="No materials yet. Add them under Materials first." />
                  </CardBody>
                </Card>
              </EditorPanel>

              {editing && (
                <EditorPanel active={tab === "projects"}>
                  <Card>
                    <CardHeader title="Related projects" description="Projects tagged with this service. Link projects from the project editor." actions={<ButtonLink href={`/admin/${p.businessId}/projects/new`} variant="secondary" size="sm">New project</ButtonLink>} />
                    <CardBody>
                      {p.relatedProjects.length === 0 ? (
                        <p className="text-sm text-neutral-500">No projects are linked to this service yet.</p>
                      ) : (
                        <ul className="divide-y divide-neutral-100">
                          {p.relatedProjects.map((pr) => (
                            <li key={pr.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                              <Link href={`/admin/${p.businessId}/projects/${pr.id}`} className="font-medium text-neutral-900 hover:underline">{pr.title}</Link>
                              <Badge tone={statusTone(pr.status)}>{pr.status}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardBody>
                  </Card>
                </EditorPanel>
              )}

              {p.fieldDefs.length > 0 && (
                <EditorPanel active={tab === "fields"}>
                  <Card>
                    <CardHeader title="Custom fields" description="Extra details defined under Custom Fields → Service." />
                    <CardBody>
                      <CustomFieldsForm definitions={p.fieldDefs} values={p.fieldValues} businessId={p.businessId} errors={cfErrors} />
                    </CardBody>
                  </Card>
                </EditorPanel>
              )}

              <EditorPanel active={tab === "seo"}>
                <Card>
                  <CardHeader title="Search & social" description="Leave blank to use the service name and short description." />
                  <CardBody className="grid gap-4 sm:grid-cols-2">
                    <Field label="Meta title" error={fieldErrors["seo.title"]} htmlFor="svc-seo-title">
                      <Input id="svc-seo-title" name="seo.title" defaultValue={p.values.seo.title ?? ""} maxLength={160} />
                    </Field>
                    <Field label="Meta description" error={fieldErrors["seo.description"]} htmlFor="svc-seo-desc">
                      <Textarea id="svc-seo-desc" name="seo.description" defaultValue={p.values.seo.description ?? ""} rows={2} className="min-h-[64px]" maxLength={400} />
                    </Field>
                    <Field label="Social image" hint="Used when the page is shared." error={fieldErrors["seo.socialImageId"]}>
                      <MediaPicker businessId={p.businessId} value={social} onChange={(m) => setSocial(m?.id ?? null)} name="seo.socialImageId" preview={p.previews.social} kind="IMAGE" folderKey="services" />
                    </Field>
                    <div className="flex items-end">
                      <Checkbox name="seo.noindex" defaultChecked={!!p.values.seo.noindex} label="Hide from search engines (noindex)" />
                    </div>
                  </CardBody>
                </Card>
              </EditorPanel>

              <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white/95 py-3 backdrop-blur" hidden={tab === "danger"}>
                <div className="text-xs text-neutral-500">{editing ? "Changes go live on the next website publish." : "You can add media, FAQs and areas now or after creating."}</div>
                <div className="flex items-center gap-2">
                  <ButtonLink href={`/admin/${p.businessId}/services`} variant="secondary">Cancel</ButtonLink>
                  <SubmitButton disabled={pending || p.archived}>{editing ? "Save service" : "Create service"}</SubmitButton>
                </div>
              </div>
            </>
          );
        }}
      </ActionForm>

      {editing && p.serviceId && (
        <EditorPanel active={tab === "danger"}>
          <Card>
            <CardHeader title="Archive or delete" description="Archiving hides the service from the website and forms but keeps every quote, job and project that refers to it." />
            <CardBody className="space-y-4">
              {!p.archived ? (
                <ActionForm action={archiveServiceAction}>
                  <input type="hidden" name="businessId" value={p.businessId} />
                  <input type="hidden" name="serviceId" value={p.serviceId} />
                  <ConfirmButton variant="danger" confirm="Archive this service? It will be hidden from the website. You can restore it later.">Archive service</ConfirmButton>
                </ActionForm>
              ) : (
                <>
                  <ActionForm action={restoreServiceAction}>
                    <input type="hidden" name="businessId" value={p.businessId} />
                    <input type="hidden" name="serviceId" value={p.serviceId} />
                    <SubmitButton variant="secondary">Restore service</SubmitButton>
                  </ActionForm>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <h4 className="text-sm font-semibold text-red-900">Delete permanently</h4>
                    <p className="mt-1 text-xs text-red-800">
                      {p.references.projects + p.references.children + p.references.leads + p.references.bookings > 0
                        ? `Blocked: this service is referenced by ${[p.references.projects ? `${p.references.projects} project(s)` : null, p.references.children ? `${p.references.children} child service(s)` : null, p.references.leads ? `${p.references.leads} lead(s)` : null, p.references.bookings ? `${p.references.bookings} booking(s)` : null].filter(Boolean).join(", ")}. Unlink those first or keep it archived.`
                        : "Removes the service and its FAQs, links and custom field values. This cannot be undone."}
                    </p>
                    <ActionForm action={deleteServiceAction} className="mt-3" onSuccess={() => router.push(`/admin/${p.businessId}/services?filter=archived`)}>
                      <input type="hidden" name="businessId" value={p.businessId} />
                      <input type="hidden" name="serviceId" value={p.serviceId} />
                      <ConfirmButton variant="danger" size="sm" disabled={p.references.projects + p.references.children + p.references.leads + p.references.bookings > 0} confirm="Delete this service permanently? This cannot be undone.">Delete permanently</ConfirmButton>
                    </ActionForm>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </EditorPanel>
      )}
    </div>
  );
}
