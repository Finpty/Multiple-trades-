import type { NavItemSeed } from "@/lib/business/defaults";

/** Client-safe navigation item types (no database imports). */
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

