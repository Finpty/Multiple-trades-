import { z } from "zod";
import type { NavigationMenu } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import type { NavItemSeed } from "@/lib/business/defaults";
import { recordAudit } from "@/lib/audit";
import { asArray, toJson } from "@/lib/json";

/**
 * Navigation menus. The stored shape is NavItemSeed (src/lib/business/defaults.ts)
 * extended with pageId / mega / newTab so the site renderer (resolveMenu) can
 * resolve every item without changes. Depth is limited to one level of nesting.
 */
export const NAV_ITEM_TYPES = ["page", "services", "link", "dropdown"] as const;
export type NavItemType = (typeof NAV_ITEM_TYPES)[number];

export interface NavItem extends NavItemSeed {
  type?: NavItemType;
  pageId?: string;
  mega?: boolean;
  newTab?: boolean;
  children?: NavItem[];
}

export const NAV_ITEM_TYPE_META: Record<NavItemType, { label: string; description: string }> = {
  page: { label: "Page", description: "Links to one of your pages." },
  services: { label: "Services", description: "Links to the services page; can list services in a mega menu." },
  link: { label: "Custom link", description: "Any URL, phone number or email." },
  dropdown: { label: "Dropdown", description: "A label that opens a list of child items." },
};

export const MENU_DEFINITIONS: Array<{ key: string; name: string; description: string }> = [
  { key: "header", name: "Main navigation", description: "Shown in the site header. The last item is styled as the call-to-action button." },
  { key: "footer", name: "Footer", description: "Links listed in the site footer." },
  { key: "mobile", name: "Mobile menu", description: "Menu used on small screens. Starts as a copy of the main navigation." },
];

const NavItemSchema: z.ZodType<NavItem> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(80),
    label: z.string().trim().min(1, "Label is required").max(80),
    href: z.string().trim().max(500).optional(),
    pageSystemKey: z.string().max(60).optional(),
    pageId: z.string().uuid().optional(),
    type: z.enum(NAV_ITEM_TYPES).optional(),
    children: z.array(NavItemSchema).max(50).optional(),
    mega: z.boolean().optional(),
    newTab: z.boolean().optional(),
  }),
);

export const NavItemsSchema = z.array(NavItemSchema).max(60);

/** Cleans a menu tree: strips unknown fields, enforces one level of nesting and resolvable links. */
export function normaliseNavItems(input: unknown, depth = 0): NavItem[] {
  const items = NavItemsSchema.parse(Array.isArray(input) ? input : []);
  return items.map((it) => {
    const type: NavItemType = it.type ?? (it.href ? "link" : it.pageSystemKey === "services" ? "services" : "page");
    const clean: NavItem = { id: it.id, label: it.label, type };
    if (type === "link") {
      clean.href = it.href || "#";
      if (it.newTab) clean.newTab = true;
    } else if (type === "dropdown") {
      clean.href = it.href && it.href !== "#" ? it.href : "#";
    } else {
      if (it.pageId) clean.pageId = it.pageId;
      if (it.pageSystemKey) clean.pageSystemKey = it.pageSystemKey;
      if (type === "services") {
        if (!clean.pageSystemKey && !clean.pageId) clean.pageSystemKey = "services";
        if (it.mega) clean.mega = true;
      }
      if (!clean.pageId && !clean.pageSystemKey) clean.href = it.href || "#";
    }
    if (depth === 0 && it.children && it.children.length) clean.children = normaliseNavItems(it.children, 1);
    return clean;
  });
}

export interface MenuView {
  id: string;
  key: string;
  name: string;
  description: string;
  draft: NavItem[];
  published: NavItem[] | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
}

function toMenuView(menu: NavigationMenu): MenuView {
  const def = MENU_DEFINITIONS.find((d) => d.key === menu.key);
  const draft = asArray<NavItem>(menu.draft);
  const published = menu.published === null || menu.published === undefined ? null : asArray<NavItem>(menu.published);
  return {
    id: menu.id,
    key: menu.key,
    name: def?.name ?? menu.name,
    description: def?.description ?? "",
    draft,
    published,
    publishedAt: menu.publishedAt?.toISOString() ?? null,
    hasUnpublishedChanges: JSON.stringify(draft) !== JSON.stringify(published ?? []),
  };
}

/** Loads the business menus, creating the standard ones (header, footer, mobile) when missing. */
export async function loadMenus(db: TenantDb, businessId: string, actorUserId: string | null): Promise<MenuView[]> {
  let menus = await db.navigationMenu.findMany({ where: { businessId } });
  const missing = MENU_DEFINITIONS.filter((d) => !menus.some((m) => m.key === d.key));
  if (missing.length) {
    const header = menus.find((m) => m.key === "header");
    for (const def of missing) {
      const draft = def.key === "mobile" && header ? asArray<NavItem>(header.draft) : [];
      const created = await db.navigationMenu.create({ data: { businessId, key: def.key, name: def.name, draft: toJson(draft) } });
      await recordAudit({ actorUserId, businessId, action: "navigation.menu_created", entityType: "navigation_menu", entityId: created.id, after: { key: def.key } });
    }
    menus = await db.navigationMenu.findMany({ where: { businessId } });
  }
  const order = new Map(MENU_DEFINITIONS.map((d, i) => [d.key, i]));
  return menus.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99) || a.key.localeCompare(b.key)).map(toMenuView);
}

export async function saveMenuDraft(db: TenantDb, businessId: string, key: string, items: unknown, actorUserId: string): Promise<MenuView> {
  const menu = await db.navigationMenu.findFirst({ where: { businessId, key } });
  if (!menu) throw new NavigationError("Menu not found.");
  const draft = normaliseNavItems(items);
  const updated = await db.navigationMenu.update({ where: { id: menu.id }, data: { draft: toJson(draft) } });
  await recordAudit({ actorUserId, businessId, action: "navigation.draft_saved", entityType: "navigation_menu", entityId: menu.id, before: menu.draft, after: updated.draft, metadata: { key } });
  return toMenuView(updated);
}

export class NavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NavigationError";
  }
}

export interface NavPageOption {
  id: string;
  title: string;
  slug: string;
  systemKey: string | null;
  status: string;
  kind: string;
}

/** Pages that no menu links to (helps owners spot orphaned pages). */
export function pagesNotInMenus(pages: NavPageOption[], menus: Array<{ draft: NavItem[] }>): NavPageOption[] {
  const linkedIds = new Set<string>();
  const linkedKeys = new Set<string>();
  const linkedHrefs = new Set<string>();
  const walk = (items: NavItem[]) => {
    for (const it of items) {
      if (it.pageId) linkedIds.add(it.pageId);
      if (it.pageSystemKey) linkedKeys.add(it.pageSystemKey);
      if (it.href) linkedHrefs.add(it.href.replace(/\/+$/, "") || "/");
      if (it.children) walk(it.children);
    }
  };
  for (const m of menus) walk(m.draft);
  return pages.filter((p) => !linkedIds.has(p.id) && !(p.systemKey && linkedKeys.has(p.systemKey)) && !linkedHrefs.has(`/${p.slug}`.replace(/\/+$/, "") || "/"));
}

/** Resolves an item to a display href for the admin preview list. */
export function previewHref(item: NavItem, pages: NavPageOption[]): string {
  if (item.href && item.href !== "#") return item.href;
  const page = (item.pageId && pages.find((p) => p.id === item.pageId)) || (item.pageSystemKey && pages.find((p) => p.systemKey === item.pageSystemKey));
  if (page) return `/${page.slug}`;
  return item.type === "dropdown" ? "#" : "(unresolved)";
}
