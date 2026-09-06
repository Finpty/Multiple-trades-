import { tenantDb } from "@/lib/db";

/**
 * Reference data the schema-driven form needs to offer pickers (pages,
 * services, projects, team members, forms). Loaded once per editor page on
 * the server and passed down to client components. Callers must already have
 * passed requireBusinessAccess for the business.
 */
export interface EditorOptionItem {
  id: string;
  label: string;
  /** Site-relative href (e.g. "/services/tiling") when the entity has a page. */
  href?: string;
  /** Extra hint shown next to the label (status, slug, …). */
  hint?: string;
}

export interface EditorOptions {
  pages: EditorOptionItem[];
  services: EditorOptionItem[];
  projects: EditorOptionItem[];
  teamMembers: EditorOptionItem[];
  /** id = form slug */
  forms: EditorOptionItem[];
}

export const EMPTY_EDITOR_OPTIONS: EditorOptions = { pages: [], services: [], projects: [], teamMembers: [], forms: [] };

export async function listEditorOptions(businessId: string): Promise<EditorOptions> {
  const db = tenantDb(businessId);
  const [pages, services, projects, teamMembers, forms] = await Promise.all([
    db.page.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true, slug: true, status: true, kind: true } }),
    db.service.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, isEnabled: true } }),
    db.project.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true, slug: true, status: true } }),
    db.teamMember.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true, isActive: true } }),
    db.form.findMany({ where: { businessId }, orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, isActive: true } }),
  ]);
  return {
    pages: pages.map((p) => ({ id: p.id, label: p.title, href: `/${p.slug}`, hint: p.status === "PUBLISHED" ? undefined : p.status.toLowerCase() })),
    services: services.map((s) => ({ id: s.id, label: s.name, href: `/services/${s.slug}`, hint: s.isEnabled ? undefined : "disabled" })),
    projects: projects.map((p) => ({ id: p.id, label: p.title, href: `/projects/${p.slug}`, hint: p.status === "PUBLISHED" ? undefined : p.status.toLowerCase() })),
    teamMembers: teamMembers.map((m) => ({ id: m.id, label: m.name, hint: m.role ?? (m.isActive ? undefined : "inactive") })),
    forms: forms.map((f) => ({ id: f.slug, label: f.name, hint: f.isActive ? undefined : "inactive" })),
  };
}
