/**
 * Navigation definitions for both admin surfaces. Pure data so layouts, the
 * command palette and tests share one source of truth.
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: string; // lucide icon name
  /** Business permission required (business admin only) */
  permission?: string;
  /** Feature flag key required (business admin only) */
  feature?: string;
  group?: string;
}

export const SUPER_ADMIN_NAV: NavItem[] = [
  { key: "overview", label: "Overview", href: "/super-admin", icon: "LayoutDashboard" },
  { key: "businesses", label: "Businesses", href: "/super-admin/businesses", icon: "Building2" },
  { key: "create-business", label: "Create Business", href: "/super-admin/create-business", icon: "PlusCircle" },
  { key: "users", label: "Users", href: "/super-admin/users", icon: "Users" },
  { key: "subscriptions", label: "Subscriptions", href: "/super-admin/subscriptions", icon: "CreditCard" },
  { key: "domains", label: "Domains", href: "/super-admin/domains", icon: "Globe" },
  { key: "templates", label: "Templates", href: "/super-admin/templates", icon: "LayoutTemplate" },
  { key: "industries", label: "Industries", href: "/super-admin/industries", icon: "Factory" },
  { key: "services", label: "Services", href: "/super-admin/services", icon: "Wrench" },
  { key: "locations", label: "Locations", href: "/super-admin/locations", icon: "MapPin" },
  { key: "media", label: "Media", href: "/super-admin/media", icon: "Image" },
  { key: "design-system", label: "Design System", href: "/super-admin/design-system", icon: "Palette" },
  { key: "feature-flags", label: "Feature Flags", href: "/super-admin/feature-flags", icon: "ToggleLeft" },
  { key: "ai-providers", label: "AI Providers", href: "/super-admin/ai-providers", icon: "Sparkles" },
  { key: "integrations", label: "Integrations", href: "/super-admin/integrations", icon: "Plug" },
  { key: "analytics", label: "Analytics", href: "/super-admin/analytics", icon: "BarChart3" },
  { key: "infrastructure", label: "Infrastructure", href: "/super-admin/infrastructure", icon: "Server" },
  { key: "audit-logs", label: "Audit Logs", href: "/super-admin/audit-logs", icon: "ScrollText" },
  { key: "settings", label: "Platform Settings", href: "/super-admin/settings", icon: "Settings" },
];

export function businessNav(businessId: string): NavItem[] {
  const b = `/admin/${businessId}`;
  return [
    { key: "dashboard", label: "Dashboard", href: b, icon: "LayoutDashboard", group: "Overview" },
    { key: "website", label: "Website", href: `${b}/website`, icon: "Globe", permission: "website.edit", group: "Website" },
    { key: "pages", label: "Pages", href: `${b}/website/pages`, icon: "FileText", permission: "website.edit", group: "Website" },
    { key: "editor", label: "Live Editor", href: `${b}/website/editor`, icon: "MousePointerClick", permission: "website.edit", group: "Website" },
    { key: "navigation", label: "Navigation", href: `${b}/website/navigation`, icon: "Menu", permission: "website.edit", group: "Website" },
    { key: "branding", label: "Brand & Theme", href: `${b}/website/theme`, icon: "Palette", permission: "website.edit", group: "Website" },
    { key: "seo", label: "SEO", href: `${b}/website/seo`, icon: "Search", permission: "website.edit", group: "Website" },
    { key: "services", label: "Services", href: `${b}/services`, icon: "Wrench", permission: "services.manage", group: "Content" },
    { key: "projects", label: "Projects", href: `${b}/projects`, icon: "Hammer", permission: "projects.manage", feature: "projects", group: "Content" },
    { key: "areas", label: "Service Areas", href: `${b}/areas`, icon: "MapPin", permission: "areas.manage", group: "Content" },
    { key: "media", label: "Media Library", href: `${b}/media`, icon: "Image", permission: "media.manage", group: "Content" },
    { key: "team", label: "Team", href: `${b}/team`, icon: "Users", permission: "business.settings", group: "Content" },
    { key: "reviews", label: "Reviews", href: `${b}/reviews`, icon: "Star", permission: "projects.manage", feature: "reviews", group: "Content" },
    { key: "materials", label: "Materials", href: `${b}/materials`, icon: "Boxes", permission: "services.manage", group: "Content" },
    { key: "leads", label: "Leads", href: `${b}/leads`, icon: "Inbox", permission: "crm.view", feature: "crm", group: "Sales" },
    { key: "customers", label: "Customers", href: `${b}/customers`, icon: "Contact", permission: "crm.view", feature: "crm", group: "Sales" },
    { key: "quotes", label: "Quotes", href: `${b}/quotes`, icon: "FileSignature", permission: "quotes.manage", feature: "quotes", group: "Sales" },
    { key: "forms", label: "Forms", href: `${b}/forms`, icon: "ClipboardList", permission: "forms.manage", group: "Sales" },
    { key: "bookings", label: "Bookings", href: `${b}/bookings`, icon: "CalendarCheck", permission: "jobs.manage", feature: "online_booking", group: "Sales" },
    { key: "jobs", label: "Jobs", href: `${b}/jobs`, icon: "KanbanSquare", permission: "jobs.manage", feature: "jobs", group: "Operations" },
    { key: "tasks", label: "Tasks", href: `${b}/tasks`, icon: "CheckSquare", permission: "jobs.manage", group: "Operations" },
    { key: "workflows", label: "Workflows", href: `${b}/workflows`, icon: "GitBranch", permission: "jobs.manage", feature: "jobs", group: "Operations" },
    { key: "invoices", label: "Invoices", href: `${b}/invoices`, icon: "Receipt", permission: "invoices.manage", feature: "invoices", group: "Operations" },
    { key: "automations", label: "Automations", href: `${b}/automations`, icon: "Workflow", permission: "automation.manage", feature: "automations", group: "Operations" },
    { key: "pricing", label: "Pricing", href: `${b}/pricing`, icon: "Calculator", permission: "pricing.manage", group: "Configuration" },
    { key: "custom-fields", label: "Custom Fields", href: `${b}/custom-fields`, icon: "ListPlus", permission: "business.settings", group: "Configuration" },
    { key: "features", label: "Features", href: `${b}/features`, icon: "ToggleLeft", permission: "features.manage", group: "Configuration" },
    { key: "domains", label: "Domains", href: `${b}/domains`, icon: "Link2", permission: "domains.manage", group: "Configuration" },
    { key: "users", label: "Users & Roles", href: `${b}/users`, icon: "UserCog", permission: "users.manage", group: "Configuration" },
    { key: "integrations", label: "Integrations & AI", href: `${b}/integrations`, icon: "Plug", permission: "integrations.manage", group: "Configuration" },
    { key: "analytics", label: "Analytics", href: `${b}/analytics`, icon: "BarChart3", permission: "analytics.view", feature: "analytics", group: "Insights" },
    { key: "audit", label: "Audit Log", href: `${b}/audit`, icon: "ScrollText", permission: "audit.view", group: "Insights" },
    { key: "settings", label: "Settings", href: `${b}/settings`, icon: "Settings", permission: "business.settings", group: "Configuration" },
  ];
}
