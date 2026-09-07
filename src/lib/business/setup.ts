import type { TenantDb } from "@/lib/db";
import { platformDb } from "@/lib/db";

export interface SetupItem {
  key: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
  detail?: string;
}

/**
 * Setup checklist: computed from real rows so it is always truthful. Used by
 * the post-creation checklist page and the dashboard completeness bar.
 */
export async function computeSetupChecklist(db: TenantDb, businessId: string): Promise<{ items: SetupItem[]; done: number; total: number; percent: number }> {
  const b = `/admin/${businessId}`;
  const [business, theme, services, pricing, areas, projects, media, home, forms, domains, members, features] = await Promise.all([
    platformDb.business.findUniqueOrThrow({ where: { id: businessId }, select: { logoMediaId: true, status: true, phone: true, email: true } }),
    db.businessTheme.findUnique({ where: { businessId }, select: { publishedAt: true, draft: true } }),
    db.service.count({ where: { businessId, isEnabled: true } }),
    db.pricingItem.count({ where: { businessId, isActive: true } }),
    db.serviceArea.count({ where: { businessId, isEnabled: true } }),
    db.project.count({ where: { businessId, status: "PUBLISHED" } }),
    db.media.count({ where: { businessId } }),
    db.page.findFirst({ where: { businessId, systemKey: "home" }, select: { id: true, _count: { select: { sections: true } } } }),
    db.form.count({ where: { businessId, isActive: true } }),
    db.businessDomain.count({ where: { businessId, verificationStatus: "VERIFIED" } }),
    db.businessMembership.count({ where: { businessId, status: "ACTIVE" } }),
    db.businessFeature.count({ where: { businessId, isEnabled: true } }),
  ]);
  const logo = business.logoMediaId ?? (theme?.draft as { logoMediaId?: string | null } | null)?.logoMediaId ?? null;
  const items: SetupItem[] = [
    { key: "details", label: "Business details", description: "Phone and email shown on the website and used for notifications.", done: !!business.phone && !!business.email, href: `${b}/settings` },
    { key: "logo", label: "Upload your logo", description: "Appears in the header, footer and quotes.", done: !!logo, href: `${b}/website/theme` },
    { key: "theme", label: "Publish your brand & theme", description: "Colours, fonts and style go live when the theme is published.", done: !!theme?.publishedAt, href: `${b}/website/theme` },
    { key: "services", label: "Review services", description: "At least one enabled service.", done: services > 0, href: `${b}/services`, detail: `${services} enabled` },
    { key: "pricing", label: "Set pricing", description: "Rates and fees power quotes and the calculator.", done: pricing > 0, href: `${b}/pricing`, detail: `${pricing} items` },
    { key: "areas", label: "Add service areas", description: "Where you work; generates local pages.", done: areas > 0, href: `${b}/areas`, detail: `${areas} areas` },
    { key: "media", label: "Upload photos", description: "Your own images replace placeholders across the site.", done: media > 0, href: `${b}/media`, detail: `${media} files` },
    { key: "projects", label: "Add a project", description: "Portfolio work with before/after photos.", done: projects > 0, href: `${b}/projects`, detail: `${projects} published` },
    { key: "pages", label: "Check your pages", description: "The home page and other pages are generated; edit anything in the live editor.", done: !!home && home._count.sections > 0, href: `${b}/website/pages` },
    { key: "navigation", label: "Review navigation", description: "Header and footer menus.", done: true, href: `${b}/website/navigation` },
    { key: "forms", label: "Check your forms", description: "Contact and quote forms create leads automatically.", done: forms > 0, href: `${b}/forms`, detail: `${forms} active` },
    { key: "features", label: "Choose features", description: "Turn modules on or off any time.", done: features > 0, href: `${b}/features` },
    { key: "users", label: "Invite your team", description: "Owners, admins, editors and staff.", done: members > 0, href: `${b}/users`, detail: `${members} members` },
    { key: "domain", label: "Connect a domain", description: "Optional: use your own domain instead of the platform address.", done: domains > 0, href: `${b}/domains` },
    { key: "publish", label: "Publish the business", description: "Makes the website public.", done: business.status === "PUBLISHED", href: `${b}/setup` },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}
